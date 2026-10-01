package com.moziik.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Imperativement AVANT super.onCreate() : c'est lui qui construit le
        // pont et fige la liste des plugins. Enregistre apres, MoziikAudio
        // serait absent de window.Capacitor.Plugins et le lecteur
        // retomberait silencieusement sur son comportement web.
        registerPlugin(MoziikAudioPlugin.class);

        super.onCreate(savedInstanceState);
    }

    /**
     * Pourquoi l'application ne s'ouvrait pas sans reseau, alors que le
     * site, lui, s'ouvre.
     *
     * Le site est hors-ligne grace a son service worker : il intercepte la
     * navigation et sert la coquille deja mise en cache. Or une WebView
     * Android ne consulte PAS le service worker pour la requete de
     * navigation principale — seulement pour les sous-ressources. Le
     * chargement de https://app-moziik.vercel.app/ echoue donc au niveau
     * reseau, avant que la moindre ligne de notre code ne tourne, et
     * Capacitor bascule sur errorPath. Aucun correctif cote web ne peut y
     * changer quoi que ce soit : il n'y a pas de code web qui tourne.
     *
     * Le seul relais qui reste est le cache HTTP de la WebView elle-meme.
     * Les pages du site partent avec « public, max-age=0, must-revalidate » :
     * elles sont donc STOCKABLES, mais revalidees a chaque fois — et hors
     * reseau la revalidation echoue, ce qui fait echouer le chargement.
     * LOAD_CACHE_ELSE_NETWORK dit exactement l'inverse : prends ce que tu
     * as, meme perime. La page se charge, le service worker prend alors la
     * main sur les sous-ressources (ca, la WebView le sait faire), et les
     * morceaux telecharges redeviennent accessibles puisqu'on est sur la
     * meme origine.
     *
     * Conditionnel, et c'est essentiel : en ligne, ce mode servirait
     * indefiniment une page perimee sans jamais aller voir le serveur.
     * L'application cesserait de suivre les deploiements, ce qui serait
     * pire que la panne qu'on corrige.
     */
    @Override
    protected void load() {
        super.load();
        appliquerModeCache();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Relu a chaque retour au premier plan : on quitte l'application
        // dans le metro et on y revient avec du reseau, ou l'inverse. Sans
        // cela, le mode choisi au lancement vaudrait pour toute la session.
        appliquerModeCache();
    }

    private void appliquerModeCache() {
        try {
            if (getBridge() == null) return;
            WebView vue = getBridge().getWebView();
            if (vue == null) return;

            WebSettings reglages = vue.getSettings();
            reglages.setCacheMode(
                reseauDisponible() ? WebSettings.LOAD_DEFAULT : WebSettings.LOAD_CACHE_ELSE_NETWORK
            );
        } catch (Exception ignore) {
            // Un reglage de cache qui echoue ne doit pas empecher
            // l'application de demarrer : on retombe sur le comportement
            // par defaut, c'est-a-dire celui d'avant ce correctif.
        }
    }

    /**
     * Y a-t-il un reseau utilisable ?
     *
     * On ne verifie pas qu'Internet repond — seulement qu'une interface
     * declare le porter. Un portail captif ou un reseau sans sortie
     * passerait donc pour « en ligne », et le chargement echouerait comme
     * avant : errorPath reste le filet, et la page d'erreur sait rejouer
     * le chargement des que la connexion revient.
     */
    private boolean reseauDisponible() {
        // getActiveNetwork() demande l'API 23 et le projet descend a 22.
        // Sous cette version on repond « en ligne » : l'application garde
        // exactement le comportement qu'elle avait avant ce correctif,
        // plutot que de planter au demarrage sur un vieil appareil.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;

        ConnectivityManager gestionnaire =
            (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (gestionnaire == null) return true;

        Network reseau = gestionnaire.getActiveNetwork();
        if (reseau == null) return false;

        NetworkCapabilities capacites = gestionnaire.getNetworkCapabilities(reseau);
        return capacites != null && capacites.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }
}
