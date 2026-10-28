plugins {
    id("com.android.application")
}

android {
    namespace = "com.henry.nightcitynav"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.henry.nightcitynav"
        minSdk = 24          // Android 7.0 ou mais novo
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.11.0")
}
