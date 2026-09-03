# MINTRONICK Operaciones para Android

Aplicación Android en pantalla completa que abre el dashboard HTTPS y conserva la sesión de acceso. Requiere Internet; la telemetría continúa alojada únicamente en el servidor.

## Compilar APK de prueba

1. Instala JDK 17 y Android SDK 36.
2. Abre la carpeta `android-app` en Android Studio y espera la sincronización de Gradle.
3. Selecciona **Build > Build APK(s)**.
4. El archivo se genera en `app/build/outputs/apk/debug/app-debug.apk`.

Para distribuirlo, usa **Build > Generate Signed Bundle / APK**, crea una clave privada y conserva su contraseña fuera del repositorio.
