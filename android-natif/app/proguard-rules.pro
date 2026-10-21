# Règles de réduction du code pour la version publiée.
# Les bibliothèques AndroidX et Compose fournissent leurs propres règles ;
# celles propres à Moziik (sérialisation de l'API) viendront avec la couche réseau.

# Connexion Google intégrée (Credential Manager) : son implémentation Play Services est chargée par réflexion.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
