package com.moziik.app;

import android.os.Bundle;

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
}
