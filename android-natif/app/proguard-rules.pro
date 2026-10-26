# Règles de réduction du code pour la version publiée (R8).
# AndroidX, Compose, Media3, OkHttp, Retrofit, Coil et Firebase fournissent
# leurs propres règles ; restent celles qui tiennent aux choix de Moziik.

# Connexion Google intégrée (Credential Manager) : son implémentation Play Services est chargée par réflexion.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }

# Sérialisation (kotlinx.serialization) : les sérialiseurs générés et l'accès
# par le compagnon de chaque classe @Serializable. Sans eux, la lecture des
# réponses de l'API échouerait seulement dans la version publiée.
-keepattributes *Annotation*, InnerClasses, Signature, Exceptions, EnclosingMethod, RuntimeVisibleAnnotations
-dontnote kotlinx.serialization.**
-keepclassmembers @kotlinx.serialization.Serializable class com.moziik.app.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keepclasseswithmembers class com.moziik.app.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.moziik.app.**$$serializer { *; }

# Retrofit lit les annotations et les types génériques de l'interface de l'API,
# y compris ceux des fonctions suspendues.
-keep,allowobfuscation,allowshrinking interface com.moziik.app.donnees.reseau.MoziikApi
-keep,allowobfuscation,allowshrinking class kotlin.coroutines.Continuation
-keep,allowobfuscation,allowshrinking class retrofit2.Response
