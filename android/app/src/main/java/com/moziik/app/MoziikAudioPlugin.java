package com.moziik.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Pont entre le lecteur web (context/PlayerProvider.tsx) et
 * {@link MoziikAudioService}.
 *
 * Cote JavaScript, l'API est volontairement minuscule - voir
 * lib/native/audio.ts :
 *
 *   MoziikAudio.activer()                  demarre le service de lecture
 *   MoziikAudio.mettreAJour({ ... })       pousse l'etat courant
 *   MoziikAudio.desactiver()               arrete tout
 *   MoziikAudio.addListener('transport')   recoit play/pause/next/...
 *
 * Rien n'est duplique : le plugin ne decide jamais de l'etat de lecture,
 * il le recopie. C'est ce qui garantit que la notification et l'ecran de
 * lecture de l'app ne peuvent pas diverger.
 */
@CapacitorPlugin(
    name = "MoziikAudio",
    permissions = {
        // Android 13+ seulement. En dessous, la permission est accordee a
        // l'installation et la demande est un no-op.
        @Permission(alias = MoziikAudioPlugin.ALIAS_NOTIFS, strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class MoziikAudioPlugin extends Plugin {

    static final String ALIAS_NOTIFS = "notifications";

    private boolean actif = false;

    @Override
    public void load() {
        // Le service ne connait pas le plugin : il appelle cet ecouteur,
        // qui traduit la commande native en evenement JavaScript.
        MoziikAudioService.definirEcouteur(new MoziikAudioService.EcouteurTransport() {
            @Override
            public void surCommande(String action, long positionMs) {
                JSObject evenement = new JSObject();
                evenement.put("action", action);
                // -1 signifie « non pertinent » (tout sauf un seek) : le JS
                // teste positionMs >= 0 plutot que de recevoir un 0 qui
                // ressemblerait a un retour au debut du morceau.
                evenement.put("positionMs", positionMs);
                notifyListeners("transport", evenement);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        // La reference dans le service est statique : sans ce nettoyage,
        // elle retiendrait un plugin mort - et surtout, apres un
        // rechargement de la page, les commandes partiraient vers l'ancien
        // pont plutot que vers le nouveau.
        MoziikAudioService.definirEcouteur(null);
        arreterService();
        super.handleOnDestroy();
    }

    /**
     * Appele au premier appui sur Lecture, pas au chargement de la page :
     * demarrer un service de premier plan alors que personne n'ecoute
     * afficherait une notification vide, et Android 12+ refuse de toute
     * facon un demarrage hors interaction.
     */
    @PluginMethod
    public void activer(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationsAutorisees()) {
            // L'appel n'est pas resolu ici : il l'est dans reponsePermission,
            // une fois la boite de dialogue fermee. Inutile d'appeler
            // bridge.saveCall() en plus - requestPermissionForAlias fait
            // deja savePermissionCall(), et un second enregistrement
            // laisserait l'appel indefiniment dans savedCalls.
            requestPermissionForAlias(ALIAS_NOTIFS, call, "reponsePermission");
            return;
        }
        actif = true;
        call.resolve(etat());
    }

    @PermissionCallback
    private void reponsePermission(PluginCall call) {
        // Refus possible : Android 13+ permet de bloquer les
        // notifications. Sans elles, pas de service de premier plan
        // possible - mais la lecture, elle, continue dans la WebView tant
        // que l'app reste ouverte. On le dit au JS plutot que d'echouer,
        // pour qu'il puisse prevenir l'auditeur que le son s'arretera
        // ecran eteint.
        actif = notificationsAutorisees();
        call.resolve(etat());
    }

    private boolean notificationsAutorisees() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
            == PackageManager.PERMISSION_GRANTED;
    }

    private JSObject etat() {
        JSObject o = new JSObject();
        o.put("actif", actif);
        o.put("notifications", notificationsAutorisees());
        return o;
    }

    /**
     * Recopie l'etat du lecteur web vers le service. Appele a chaque
     * changement de morceau, de lecture/pause, et une fois par seconde
     * pendant la lecture pour la barre de progression.
     */
    @PluginMethod
    public void mettreAJour(PluginCall call) {
        if (!actif) {
            // Ni erreur ni notification fantome : tant qu'activer() n'a pas
            // ete appele (ou que la permission a ete refusee), on ignore
            // proprement.
            call.resolve();
            return;
        }

        Intent i = new Intent(getContext(), MoziikAudioService.class)
            .setAction(MoziikAudioService.ACTION_UPDATE)
            .putExtra(MoziikAudioService.EXTRA_TITRE, call.getString("titre", ""))
            .putExtra(MoziikAudioService.EXTRA_ARTISTE, call.getString("artiste", ""))
            .putExtra(MoziikAudioService.EXTRA_ALBUM, call.getString("album", ""))
            .putExtra(MoziikAudioService.EXTRA_POCHETTE, call.getString("pochette", ""))
            .putExtra(MoziikAudioService.EXTRA_EN_LECTURE, Boolean.TRUE.equals(call.getBoolean("enLecture", false)))
            .putExtra(MoziikAudioService.EXTRA_POSITION_MS, arrondi(call.getDouble("positionMs", 0d)))
            .putExtra(MoziikAudioService.EXTRA_DUREE_MS, arrondi(call.getDouble("dureeMs", 0d)))
            .putExtra(MoziikAudioService.EXTRA_VITESSE, call.getFloat("vitesse", 1f))
            .putExtra(MoziikAudioService.EXTRA_A_SUIVANT, Boolean.TRUE.equals(call.getBoolean("aSuivant", false)))
            .putExtra(MoziikAudioService.EXTRA_A_PRECEDENT, Boolean.TRUE.equals(call.getBoolean("aPrecedent", false)));

        try {
            // startService et non startForegroundService : le service
            // appelle lui-meme startForeground des la premiere mise a jour,
            // et startForegroundService imposerait un delai de 5 s sous
            // peine de ANR meme pour une simple mise a jour de position.
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (IllegalStateException e) {
            // Android 12+ : l'app est passee en arriere-plan entre-temps.
            // La lecture n'est pas affectee, seule la notification manque.
            call.resolve();
        }
    }

    /** Les durees viennent du JS en millisecondes flottantes (currentTime * 1000). */
    private static long arrondi(Double d) {
        return d == null ? 0L : Math.round(d);
    }

    @PluginMethod
    public void desactiver(PluginCall call) {
        arreterService();
        actif = false;
        call.resolve();
    }

    private void arreterService() {
        try {
            getContext().stopService(new Intent(getContext(), MoziikAudioService.class));
        } catch (Exception ignore) {
            // Service deja arrete : rien a faire.
        }
    }
}
