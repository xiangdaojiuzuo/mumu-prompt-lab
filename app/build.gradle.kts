plugins {
    id("com.android.application")
}

android {
    namespace = "tw.mumu.yuantaassistant"
    compileSdk = 35

    defaultConfig {
        applicationId = "tw.mumu.yuantaassistant"
        minSdk = 26
        targetSdk = 35
        versionCode = 3
        versionName = "0.3.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity:1.10.0")
    implementation("com.google.mlkit:text-recognition-chinese:16.0.1")
}
