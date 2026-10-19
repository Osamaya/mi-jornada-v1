# Compilar e instalar en Android

El proyecto está en `android/`, con identificador local `app.mijornada.personal`. **Android Studio ya está instalado en este equipo**. Durante la verificación apareció una instalación reciente del SDK en su ubicación habitual, con Platform 37.0, Build Tools 36.0.0 y Platform Tools. **Faltan Platform 36 y Build Tools 35.0.0 para la configuración actual del proyecto.** No hay APK generado. El primer intento de Gradle se detuvo al descargar su distribución por la red restringida.

El proyecto utiliza Capacitor 8, Android API 36, Android Gradle Plugin 8.13.0 y el wrapper Gradle 8.14.3. Node 22 y un JDK 24 ya están instalados. La comprobación del 19/10/2026 encontró Java 25 en el runtime incluido con Android Studio: seleccionar otro JDK para Gradle según el paso 2.

## Preparar el equipo

1. Abrir Android Studio → **More Actions → SDK Manager** desde la bienvenida, o **Tools → SDK Manager** dentro de un proyecto. Instalar:
   - En **SDK Platforms**: Android 16 / **Android SDK Platform 36**.
   - En **SDK Tools**, activar **Show Package Details** y seleccionar **Android SDK Build-Tools 35.0.0** y **Android SDK Platform-Tools**.
   - **Android SDK Command-line Tools (latest)** es opcional para administrar el SDK desde terminal. El emulador también es opcional si se probará con un teléfono.
   - Pulsar **Apply**, revisar las licencias y completar la descarga. Conservar la ruta mostrada en **Android SDK Location**.
2. Abrir el proyecto Android y entrar a **Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK**. Seleccionar el JDK 24 existente en `C:\Program Files\Java\jdk-24`, o instalar/seleccionar JDK 21. Capacitor compila código Java 21; Gradle 8.14.3 admite ejecutarse con Java 24. El runtime Java 25 incluido en el Studio detectado requiere Gradle 9.1 o posterior, así que no seleccionarlo para este wrapper. Fuentes: [entorno Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup) y [compatibilidad Java/Gradle](https://docs.gradle.org/current/userguide/compatibility.html).
3. Configurar el SDK en Android Studio, mediante `ANDROID_HOME` o en `android/local.properties` (archivo local excluido de Git). La plataforma 36 corresponde al proyecto; Build Tools 35.0.0 es la versión predeterminada de [Android Gradle Plugin 8.13](https://developer.android.com/build/releases/agp-8-13-0-release-notes).
4. En la carpeta del proyecto, instalar dependencias si es una copia nueva y abrir Android:

```powershell
npm ci --legacy-peer-deps
npm run android:sync
npm run android:open
```

No hace falta instalar Gradle por separado: el wrapper descarga la versión declarada por el proyecto. La primera instalación de dependencias y compilación requieren red en el equipo desarrollador. El APK empaqueta sus recursos y SQLite; no necesita Internet para arrancar ni registrar datos. Fuente: [SQLite — repositorio oficial](https://github.com/capacitor-community/sqlite).

## APK de prueba

```powershell
$env:JAVA_HOME = 'C:\Program Files\Java\jdk-24'
$env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
npm run android:apk
```

Estas variables solo afectan a la sesión actual de PowerShell. Usar la ruta real de **Android SDK Location** si difiere de la del ejemplo. El comando sincroniza los recursos web y ejecuta `assembleDebug`.

Salida esperada **solo después de una compilación exitosa**:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Ese archivo todavía no existe. El debug se firma con la clave de desarrollo del equipo y es adecuado para probar, no para establecer la firma definitiva de distribución.

## APK de distribución firmado

En Android Studio: Build → Generate Signed Bundle / APK → APK. Crear o seleccionar una clave privada, conservar una copia segura fuera del repositorio y generar la variante release. No compartir claves ni contraseñas en GitHub. Mantener la misma clave y el identificador para actualizar la instalación sin desinstalarla. No se ha generado una clave de distribución automáticamente.

## Instalar y verificar

1. Copiar el APK al teléfono, abrirlo y permitir instalación desde esa aplicación de archivos cuando Android lo solicite. También puede instalarse en un dispositivo de prueba con `adb install -r ruta-del-apk`.
2. Antes de guardar datos reales, activar modo avión, abrir por primera vez y configurar tarifa/condiciones.
3. Iniciar jornada, cerrar forzosamente la app, abrir de nuevo y comprobar que continúa; repetir tras reiniciar el teléfono.
4. Registrar/finalizar un descanso, una jornada manual que cruce medianoche y una corrección.
5. Guardar un respaldo fuera de la app mediante el selector/menú del sistema; revisar su restauración y la copia previa.
6. Comparar una semana completa con el comprobante de pago bruto y neto.

La app desactiva el backup automático y la transferencia de datos Android; usa respaldos explícitos. El manifiesto solicita la eliminación del permiso INTERNET y no incluye GPS ni permisos generales de archivos. Revisar el manifiesto combinado y probar el selector de archivos en la compilación nativa antes del piloto.
