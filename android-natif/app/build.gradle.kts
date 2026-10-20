plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
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
        versionCode = 2
        versionName = "2.0.0"
        vectorDrawables.useSupportLibrary = true
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
        debug {
            applicationIdSuffix = ".test"
            versionNameSuffix = "-test"
            resValue("string", "app_name", "Moziik test")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            resValue("string", "app_name", "Moziik")
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
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
}
