package com.moziik.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.media.session.MediaButtonReceiver;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Service de premier plan qui maintient la lecture quand l'application
 * passe en arriere-plan, et publie la notification media.
 *
 * POURQUOI CE SERVICE EXISTE
 *
 * Le son n'est pas produit ici : il sort du lecteur audio de la WebView
 * (components/player/hooks/useAudioEngine.ts). Capacitor, contrairement a
 * ce qu'on suppose souvent, n'appelle PAS webView.onPause() quand
 * l'activite passe en arriere-plan - verifie dans Bridge.onPause(), qui ne
 * fait que notifier les plugins. La lecture continue donc « toute seule »...
 * pendant quelques minutes seulement : sans composant de premier plan,
 * Android place le processus en cache, puis le gele (Cached App Freezer,
 * Android 12+) ou le tue sous pression memoire. Le son s'arrete alors sans
 * prevenir, typiquement apres le verrouillage de l'ecran.
 *
 * Ce service resout exactement ca : tant qu'il tourne en premier plan, le
 * processus est intouchable. Il apporte au passage ce qu'une PWA ne peut
 * pas avoir sur Android - une vraie notification media avec pochette, des
 * commandes sur l'ecran verrouille, et la prise en charge des boutons des
 * casques Bluetooth.
 *
 * SENS DE CIRCULATION
 *
 *   WebView --update()--> plugin --Intent--> service --> notification
 *   WebView <--evenement-- plugin <-ecouteur- service <-- MediaSession
 *
 * Le JavaScript reste la source de verite de l'etat de lecture ; le
 * service n'est qu'un miroir, et les commandes recues sont renvoyees au
 * JavaScript plutot qu'appliquees ici.
 */
public class MoziikAudioService extends Service {

    private static final String TAG = "MoziikAudio";

    /** Un seul canal : l'auditeur peut couper la notif media sans perdre le reste. */
    private static final String CANAL_ID = "moziik_lecture";
    private static final int NOTIF_ID = 0x4D5A; // "MZ"

    public static final String ACTION_UPDATE = "com.moziik.app.audio.UPDATE";
    public static final String ACTION_PLAY = "com.moziik.app.audio.PLAY";
    public static final String ACTION_PAUSE = "com.moziik.app.audio.PAUSE";
    public static final String ACTION_NEXT = "com.moziik.app.audio.NEXT";
    public static final String ACTION_PREVIOUS = "com.moziik.app.audio.PREVIOUS";
    public static final String ACTION_STOP = "com.moziik.app.audio.STOP";

    public static final String EXTRA_TITRE = "titre";
    public static final String EXTRA_ARTISTE = "artiste";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_POCHETTE = "pochette";
    public static final String EXTRA_EN_LECTURE = "enLecture";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_DUREE_MS = "dureeMs";
    public static final String EXTRA_VITESSE = "vitesse";
    public static final String EXTRA_A_SUIVANT = "aSuivant";
    public static final String EXTRA_A_PRECEDENT = "aPrecedent";

    /** Commandes remontees au JavaScript. */
    public interface EcouteurTransport {
        void surCommande(String action, long positionMs);
    }

    // Statique parce que le plugin Capacitor et le service ont des cycles de
    // vie independants : le plugin est instancie au chargement de la page,
    // le service peut demarrer et s'arreter plusieurs fois derriere. La
    // reference est explicitement relachee dans handleOnDestroy du plugin,
    // donc pas de fuite au-dela du processus.
    @Nullable
    private static EcouteurTransport ecouteur;

    public static void definirEcouteur(@Nullable EcouteurTransport e) {
        ecouteur = e;
    }

    private MediaSessionCompat session;
    private NotificationManager gestionnaireNotifs;
    private final Handler filPrincipal = new Handler(Looper.getMainLooper());

    // Un seul fil, non parallele : les pochettes arrivent dans l'ordre des
    // morceaux, et une piste sautee rapidement n'a pas besoin de sa
    // pochette. Un pool ne ferait que multiplier les telechargements
    // perimes.
    private final ExecutorService telechargeur = Executors.newSingleThreadExecutor();

    // Etat courant, miroir de celui du lecteur web.
    private String titre = "";
    private String artiste = "";
    private String album = "";
    private String urlPochette = "";
    private boolean enLecture = false;
    private long positionMs = 0;
    private long dureeMs = 0;
    private float vitesse = 1f;
    private boolean aSuivant = false;
    private boolean aPrecedent = false;

    // Cache d'une seule pochette : celle du morceau affiche. Retelecharger
    // a chaque pause/reprise ferait clignoter la notification et
    // consommerait des donnees sur un forfait mobile.
    @Nullable private Bitmap pochette;

    private boolean premierPlanDemarre = false;

    // Signature de la derniere notification publiee. Le JS pousse la
    // position toutes les deux secondes ; sans cette comparaison, on
    // reconstruirait la notification 30 fois par minute alors que rien de
    // ce qu'elle affiche n'a change. La position, elle, part quand meme :
    // elle passe par PlaybackStateCompat, qui est bien plus leger et
    // alimente la barre de progression de l'ecran verrouille.
    /**
     * Separateur des champs de la signature. Code 31 (unit separator),
     * ecrit en decimal plutot qu'avec un echappement Unicode : Java resout
     * ces echappements AVANT l'analyse lexicale, si bien qu'ils ne
     * compilent pas dans un litteral char - ni meme, et c'est la que le
     * piege se referme, dans un simple commentaire comme celui-ci. Ecrire
     * la sequence ici, ne serait-ce que pour l'expliquer, suffit a casser
     * la compilation de tout le fichier.
     *
     * Un caractere de controle plutot qu'un simple "|" : il ne peut pas
     * apparaitre dans un titre ou un nom d'artiste, donc deux etats
     * differents ne peuvent pas produire la meme signature.
     */
    private static final char SEP = 31;

    @Nullable private String signatureNotif;

    /** Derniere notification batie, reutilisee tant que la signature ne bouge pas. */
    @Nullable private Notification notifCourante;

    @Override
    public void onCreate() {
        super.onCreate();
        gestionnaireNotifs = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        creerCanal();
        creerSession();
    }

    private void creerCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel canal = new NotificationChannel(
            CANAL_ID,
            getString(R.string.canal_lecture_nom),
            // LOW et non DEFAULT : une notification de lecture ne doit ni
            // sonner ni vibrer a chaque changement de morceau.
            NotificationManager.IMPORTANCE_LOW
        );
        canal.setDescription(getString(R.string.canal_lecture_description));
        canal.setShowBadge(false);
        canal.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        gestionnaireNotifs.createNotificationChannel(canal);
    }

    private void creerSession() {
        session = new MediaSessionCompat(this, TAG);
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { remonter("play", -1); }
            @Override public void onPause() { remonter("pause", -1); }
            @Override public void onSkipToNext() { remonter("next", -1); }
            @Override public void onSkipToPrevious() { remonter("previous", -1); }
            @Override public void onStop() { remonter("stop", -1); }
            @Override public void onSeekTo(long pos) { remonter("seek", pos); }
        });
        session.setActive(true);
    }

    /**
     * Renvoie une commande au JavaScript. Toujours poste sur le fil
     * principal : les callbacks MediaSession arrivent depuis un fil
     * systeme, et le pont Capacitor exige le fil UI pour evaluer du JS.
     */
    private void remonter(String action, long pos) {
        final EcouteurTransport e = ecouteur;
        if (e == null) {
            // Page rechargee, ou app tuee alors que la notif survit un
            // instant : plus personne pour appliquer la commande. On se
            // retire plutot que de laisser une notification morte.
            Log.w(TAG, "Commande " + action + " sans ecouteur, arret du service.");
            arreter();
            return;
        }
        filPrincipal.post(new Runnable() {
            @Override public void run() { e.surCommande(action, pos); }
        });
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        // Boutons des casques filaires et Bluetooth : le systeme les
        // delivre ici sous forme d'Intent, a traduire en callbacks de
        // session. Sans cette ligne, le bouton « pause » d'un casque ne
        // fait rien.
        MediaButtonReceiver.handleIntent(session, intent);

        String action = intent != null ? intent.getAction() : null;
        if (action == null) {
            // Redemarrage par le systeme apres une mise a mort : on n'a
            // plus d'etat a afficher et le JS est parti avec le processus.
            arreter();
            return START_NOT_STICKY;
        }

        switch (action) {
            case ACTION_UPDATE:
                appliquer(intent);
                break;
            case ACTION_PLAY:
                remonter("play", -1);
                break;
            case ACTION_PAUSE:
                remonter("pause", -1);
                break;
            case ACTION_NEXT:
                remonter("next", -1);
                break;
            case ACTION_PREVIOUS:
                remonter("previous", -1);
                break;
            case ACTION_STOP:
                remonter("stop", -1);
                arreter();
                return START_NOT_STICKY;
            default:
                break;
        }

        // START_NOT_STICKY : si Android tue quand meme le processus, il ne
        // faut surtout pas relancer un service de lecture sans lecteur.
        return START_NOT_STICKY;
    }

    private void appliquer(Intent intent) {
        titre = valeur(intent.getStringExtra(EXTRA_TITRE));
        artiste = valeur(intent.getStringExtra(EXTRA_ARTISTE));
        album = valeur(intent.getStringExtra(EXTRA_ALBUM));
        enLecture = intent.getBooleanExtra(EXTRA_EN_LECTURE, false);
        positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0);
        dureeMs = intent.getLongExtra(EXTRA_DUREE_MS, 0);
        vitesse = intent.getFloatExtra(EXTRA_VITESSE, 1f);
        aSuivant = intent.getBooleanExtra(EXTRA_A_SUIVANT, false);
        aPrecedent = intent.getBooleanExtra(EXTRA_A_PRECEDENT, false);

        String nouvellePochette = valeur(intent.getStringExtra(EXTRA_POCHETTE));
        boolean pochetteChange = !nouvellePochette.equals(urlPochette);
        urlPochette = nouvellePochette;

        if (pochetteChange) {
            // Videe AVANT la publication : garder l'ancienne afficherait la
            // pochette du morceau precedent sous le nouveau titre, ce qui
            // se voit immediatement sur l'ecran verrouille.
            pochette = null;
        }

        publier();

        if (pochetteChange && !urlPochette.isEmpty()) {
            chargerPochette(urlPochette);
        }
    }

    private static String valeur(@Nullable String s) {
        return s == null ? "" : s;
    }

    /** Pousse l'etat courant vers la session ET la notification. */
    private void publier() {
        session.setMetadata(new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, titre)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artiste)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            // Sans la duree, l'ecran verrouille n'affiche aucune barre de
            // progression, seulement un temps qui defile.
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, dureeMs > 0 ? dureeMs : -1)
            .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, pochette)
            .build());

        long actions = PlaybackStateCompat.ACTION_PLAY_PAUSE
            | PlaybackStateCompat.ACTION_PLAY
            | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_STOP
            | PlaybackStateCompat.ACTION_SEEK_TO;
        if (aSuivant) actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;
        if (aPrecedent) actions |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;

        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            // La vitesse reelle permet au systeme d'extrapoler la position
            // entre deux mises a jour : la barre avance en continu alors
            // que le JS n'envoie qu'un point par seconde.
            .setState(
                enLecture ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                positionMs,
                enLecture ? vitesse : 0f
            )
            .build());

        // Tout ce que la notification donne a voir - et rien d'autre. La
        // position en est volontairement absente : elle change en
        // permanence sans rien modifier a l'affichage de la carte.
        String signature = titre + SEP + artiste + SEP + album + SEP
            + enLecture + SEP + aSuivant + SEP + aPrecedent + SEP
            + (pochette != null);

        // La notification n'est RECONSTRUITE que si son contenu a change.
        // C'est la seule economie faite ici, et elle est reelle : batir la
        // carte suppose de resoudre des chaines, des icones et des
        // PendingIntent, 30 fois par minute pour rien.
        if (notifCourante == null || !signature.equals(signatureNotif)) {
            notifCourante = construireNotification();
            signatureNotif = signature;
        }

        // En revanche startForeground est appele a CHAQUE fois, meme sur
        // une notification inchangee. Ce n'est pas une maladresse : le
        // plugin passe par startForegroundService, qui impose au service
        // d'appeler startForeground dans les 5 s sous peine de voir le
        // processus tue (« did not then call Service.startForeground() »).
        // Sortir plus haut sans l'appeler, comme le faisait une premiere
        // version de ce fichier, exposait a une mort du processus en pleine
        // lecture - exactement ce que ce service est cense empecher.
        // Appele alors que le service est deja au premier plan, il se
        // contente de mettre la notification a jour.
        demarrerPremierPlan(notifCourante);
    }

    private void demarrerPremierPlan(Notification notif) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIF_ID, notif);
            }
            premierPlanDemarre = true;
        } catch (Exception e) {
            // Android 12+ refuse le demarrage d'un service de premier plan
            // depuis l'arriere-plan (ForegroundServiceStartNotAllowedException).
            // Ce cas ne devrait pas se produire - le JS n'appelle enable()
            // qu'au premier appui sur Lecture, app visible - mais un plantage
            // ici couperait toute l'ecoute. On degrade : la lecture continue
            // dans la WebView tant que le processus vit, sans notification.
            Log.w(TAG, "Premier plan refuse, lecture en mode degrade.", e);
            arreter();
        }
    }

    private Notification construireNotification() {
        // Ouvre l'app sur le morceau en cours plutot qu'une nouvelle
        // instance : singleTask + CLEAR_TOP ramene l'activite existante,
        // donc la WebView et sa lecture en cours.
        Intent ouvrir = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contenu = PendingIntent.getActivity(
            this, 0, ouvrir, PendingIntent.FLAG_UPDATE_CURRENT | drapeauImmuable()
        );

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CANAL_ID)
            .setSmallIcon(R.drawable.ic_stat_moziik)
            .setContentTitle(titre.isEmpty() ? getString(R.string.lecture_titre_inconnu) : titre)
            .setContentText(artiste)
            .setSubText(album.isEmpty() ? null : album)
            .setLargeIcon(pochette)
            .setContentIntent(contenu)
            .setDeleteIntent(intentService(ACTION_STOP))
            .setColor(ContextCompat.getColor(this, R.color.moziik_accent))
            .setColorized(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            .setOnlyAlertOnce(true)
            // Non balayable tant que ca joue (comportement attendu d'un
            // lecteur) ; balayable une fois en pause, pour pouvoir s'en
            // debarrasser sans rouvrir l'app.
            .setOngoing(enLecture)
            .setPriority(NotificationCompat.PRIORITY_LOW);

        // L'ordre des actions determine les index passes a
        // setShowActionsInCompactView plus bas - ne pas reordonner sans
        // ajuster les index.
        int index = 0;
        int[] compact;

        if (aPrecedent) {
            b.addAction(new NotificationCompat.Action(
                android.R.drawable.ic_media_previous,
                getString(R.string.lecture_precedent),
                intentService(ACTION_PREVIOUS)
            ));
            index++;
        }

        b.addAction(new NotificationCompat.Action(
            enLecture ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
            getString(enLecture ? R.string.lecture_pause : R.string.lecture_lire),
            intentService(enLecture ? ACTION_PAUSE : ACTION_PLAY)
        ));
        int indexLecture = index;
        index++;

        if (aSuivant) {
            b.addAction(new NotificationCompat.Action(
                android.R.drawable.ic_media_next,
                getString(R.string.lecture_suivant),
                intentService(ACTION_NEXT)
            ));
            compact = aPrecedent ? new int[] { 0, indexLecture, index } : new int[] { indexLecture, index };
        } else {
            compact = aPrecedent ? new int[] { 0, indexLecture } : new int[] { indexLecture };
        }

        b.setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
            // Ce jeton est ce qui fait apparaitre les commandes sur
            // l'ecran verrouille et dans la zone media des parametres
            // rapides. Sans lui, la notification reste une notification
            // ordinaire.
            .setMediaSession(session.getSessionToken())
            .setShowActionsInCompactView(compact)
            .setShowCancelButton(true)
            .setCancelButtonIntent(intentService(ACTION_STOP)));

        return b.build();
    }

    private PendingIntent intentService(String action) {
        Intent i = new Intent(this, MoziikAudioService.class).setAction(action);
        return PendingIntent.getService(
            this,
            action.hashCode(),
            i,
            PendingIntent.FLAG_UPDATE_CURRENT | drapeauImmuable()
        );
    }

    private static int drapeauImmuable() {
        // Obligatoire a partir d'Android 12 : un PendingIntent ni mutable
        // ni immuable explicitement leve une IllegalArgumentException.
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    private void chargerPochette(final String url) {
        telechargeur.execute(new Runnable() {
            @Override public void run() {
                final Bitmap bmp = telechargerBitmap(url);
                if (bmp == null) return;
                filPrincipal.post(new Runnable() {
                    @Override public void run() {
                        // Le morceau a pu changer pendant le telechargement :
                        // sans ce test, la pochette du titre precedent viendrait
                        // ecraser celle du titre courant.
                        if (!url.equals(urlPochette)) return;
                        pochette = bmp;
                        publier();
                    }
                });
            }
        });
    }

    @Nullable
    private Bitmap telechargerBitmap(String url) {
        HttpURLConnection co = null;
        try {
            co = (HttpURLConnection) new URL(url).openConnection();
            co.setConnectTimeout(8000);
            co.setReadTimeout(8000);
            co.setInstanceFollowRedirects(true);
            co.connect();
            if (co.getResponseCode() != 200) return null;

            InputStream flux = co.getInputStream();
            // Les pochettes Cloudinary peuvent faire 3000 px de cote. Un
            // bitmap de cette taille depasse la limite de la transaction
            // Binder qui transporte la notification, et la notif
            // disparait silencieusement. On sous-echantillonne a la
            // volee : 512 px suffisent pour l'ecran verrouille.
            byte[] octets = lireTout(flux);
            flux.close();

            BitmapFactory.Options mesure = new BitmapFactory.Options();
            mesure.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(octets, 0, octets.length, mesure);

            int echelle = 1;
            int cote = Math.max(mesure.outWidth, mesure.outHeight);
            while (cote / echelle > 512) echelle *= 2;

            BitmapFactory.Options decode = new BitmapFactory.Options();
            decode.inSampleSize = echelle;
            return BitmapFactory.decodeByteArray(octets, 0, octets.length, decode);
        } catch (Exception e) {
            // Une pochette absente n'est pas une panne : la notification
            // reste correcte avec la seule icone de l'app.
            Log.w(TAG, "Pochette non chargee : " + url, e);
            return null;
        } finally {
            if (co != null) co.disconnect();
        }
    }

    private static byte[] lireTout(InputStream in) throws IOException {
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        byte[] tampon = new byte[8192];
        int lu;
        while ((lu = in.read(tampon)) != -1) sortie.write(tampon, 0, lu);
        return sortie.toByteArray();
    }

    private void arreter() {
        if (premierPlanDemarre) {
            stopForeground(true);
            premierPlanDemarre = false;
        }
        // Sans cette remise a zero, une reprise de lecture sur le meme
        // morceau reutiliserait la notification batie pour le service
        // precedent, avec ses PendingIntent pointant sur une instance
        // morte.
        signatureNotif = null;
        notifCourante = null;
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // L'auditeur a balaye l'app depuis les recents : la WebView, donc
        // le lecteur, n'existe plus. Laisser la notification serait
        // trompeur - elle proposerait des commandes sans effet.
        super.onTaskRemoved(rootIntent);
        arreter();
    }

    @Override
    public void onDestroy() {
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        telechargeur.shutdownNow();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        // Pilote uniquement par Intents (voir MoziikAudioPlugin) : la
        // liaison ajouterait un cycle de vie a gerer sans rien apporter.
        return null;
    }
}
