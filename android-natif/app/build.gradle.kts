plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Clé de publication : celle de l'app Capacitor (moziik-release.jks), pour que
// l'app native s'installe sur les téléphones comme une mise à jour. Elle
// n'est jamais dans le dépôt ; l'intégration continue la reçoit par des
// secrets GitHub, que seul le propriétaire du dépôt renseigne.
val clePublication: String? = System.getenv("MOZIIK_KEYSTORE_FILE")

android {
    namespace = "com.moziik.app"
    compileSdk = 35

    defaultConfig {
        // Même identifiant que l'app Capacitor : l'app native la remplace.
        applicationId = "com.moziik.app"
        // Comme l'app actuelle : aucun téléphone qui l'a ne doit perdre les mises à jour.
        minSdk = 22
        targetSdk = 35
        // Supérieur à celui de l'app Capacitor (1) : sinon Android refuse la mise à jour.
        versionCode = 12
        versionName = "2.9.1"
        vectorDrawables.useSupportLibrary = true
        // Le site en production : l'app ne parle qu'à son API HTTP.
        buildConfigField("String", "SITE", "\"https://app-moziik.vercel.app/\"")
        // Identifiant client web du site (public) : la connexion Google intégrée à Android le
        // déclare comme serveur, et le site vérifie que le jeton lui est bien destiné.
        buildConfigField("String", "GOOGLE_CLIENT_WEB", "\"713014071124-c4l9ohq92q84idjl6v1t1o0arnba8d98.apps.googleusercontent.com\"")
    }

    signingConfigs {
        // Clé de test commune, versionnée exprès : chaque version de test se
        // signe pareil et remplace la précédente sans désinstallation. Elle
        // n'a aucune valeur hors des versions de test.
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "moziiktest"
            keyPassword = "android"
        }
        create("release") {
            if (clePublication != null) {
                storeFile = file(clePublication)
                storePassword = System.getenv("MOZIIK_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("MOZIIK_KEY_ALIAS")
                keyPassword = System.getenv("MOZIIK_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        // Version de test : identifiant à part, elle s'installe à côté de l'app actuelle.
        // Le relais de connexion Google rend la main à l'app par un schéma
        // propre à chaque version (app/api/mobile-auth/relais du site) : la
        // version de test, installée à côté de l'app publiée, a le sien.
        debug {
            applicationIdSuffix = ".test"
            versionNameSuffix = "-test"
            resValue("string", "app_name", "Moziik test")
            manifestPlaceholders["schemaRelais"] = "moziik-test"
            buildConfigField("String", "RELAIS", "\"android-test\"")
            // Non débogable : sinon Android n'optimise pas le code et l'interface défile
            // plusieurs fois plus lentement qu'elle ne le fera chez les auditeurs. La
            // version de test doit donner une idée juste de la fluidité. Personne ne la
            // débogue : elle n'est jamais construite sur un poste.
            isDebuggable = false
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            resValue("string", "app_name", "Moziik")
            manifestPlaceholders["schemaRelais"] = "moziik"
            buildConfigField("String", "RELAIS", "\"android\"")
            if (clePublication != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.foundation)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.browser)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.coil.compose)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services)
    implementation(libs.googleid)
    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.session)
    implementation(libs.androidx.media3.okhttp)

    testImplementation(libs.junit)
    testImplementation(libs.okhttp.mockwebserver)
    testImplementation(libs.kotlinx.coroutines.test)
}
