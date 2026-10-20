# Compilar e instalar en Android

El proyecto está en `android/`, con identificador `app.mijornada.personal`, `versionName` 1.1.0 y `versionCode` 2. **La APK debug actual está generada, su firma verificada y se instaló como actualización de 1.0.0 en el emulador Medium Phone con Android 17 / API 37.** El teléfono físico y el piloto con recibo real siguen pendientes.

En este equipo ya están instalados Android Studio, Platform Tools, SDK Platform 36 y Build Tools 35.0.0. Gradle completó los dos últimos paquetes utilizando las licencias previamente aceptadas. `android/local.properties` apunta al SDK local y se excluye de Git. La primera descarga del wrapper que antes fallaba por la red ya se completó.

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

Salida de la compilación exitosa:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

La copia actual para instalar se encuentra en `artifacts/MiJornada-1.1.0-debug.apk`; incluye pago configurable de horas extra, selección de colores, semana de ejemplo y reapertura SQLite después de recargar la WebView. Las primeras compilaciones 1.0.0 se conservan en `artifacts/`. El archivo `.sha256` de cada APK permite comprobarla. Son artefactos locales excluidos de Git. La APK contiene las arquitecturas arm64-v8a, armeabi-v7a, x86 y x86_64; declara Android mínimo API 24 y target API 36. La ejecución nativa se comprobó en API 37.

Huella SHA-256 de la compilación actual:

```text
970c08fa85cadd25a096c8320518cd8b53a5fd216397a00fc8745685da4b5eb4
```

Para verla desde Android Studio, seleccionar el emulador y pulsar **Run ▶** después de `npm run android:sync`. Ya se instaló la compilación actual en el emulador conectado. En **Configuración → 1. Tu pago por hora** se puede indicar el pago completo por hora extra o conservar el cálculo automático. El ejemplo de solo lectura continúa disponible desde Inicio y Configuración.

El debug se firma con la clave de desarrollo del equipo. `apksigner verify --verbose` confirmó una firma v2 válida. Es adecuado para probar; no establece la firma definitiva de distribución. El APK contiene código y recursos, sin los datos sintéticos de la instalación del emulador.

Para repetir la revisión nativa, después de sincronizar:

```powershell
.\android\gradlew.bat -p android :app:lintDebug
```

El análisis terminó con cero errores y siete advertencias: sugerencias de actualización de dependencias, cuatro recursos sin uso y una carpeta de recursos heredada del proyecto Android. No se suprimieron los avisos.

## APK de distribución firmado

En Android Studio: Build → Generate Signed Bundle / APK → APK. Crear o seleccionar una clave privada, conservar una copia segura fuera del repositorio y generar la variante release. No compartir claves ni contraseñas en GitHub. Mantener la misma clave y el identificador para actualizar la instalación sin desinstalarla. No se ha generado una clave de distribución automáticamente.

## Compartir esta APK para pruebas personales

1. En el Explorador de Windows, abrir `C:\xampp\htdocs\MiJornada\artifacts` y seleccionar **MiJornada-1.1.0-debug.apk**.
2. Enviar ese archivo como documento, o copiarlo al teléfono por USB. También puede enviarse adjunto por correo o mediante un enlace privado a un archivo que tú subas. La APK contiene la aplicación; los registros de tu instalación se pasan por separado con un respaldo JSON si se necesitan.
3. En el teléfono Android, descargar y abrir el archivo. Si el sistema solicita **Permitir desde esta fuente**, autorizar la aplicación desde la que se abre el APK y completar la instalación. Las etiquetas exactas dependen del teléfono. [Android: distribución directa e instalación desde otras fuentes](https://developer.android.com/distribute/marketing-tools/alternative-distribution).
4. Abrir Mi Jornada y configurar el nombre, pago normal, pago extra y condiciones. Para actualizar una instalación anterior firmada con la misma clave, abrir la nueva APK y elegir actualizar; se comprobó con `adb install -r`. Conviene exportar primero un respaldo de los registros reales.

Para estas pruebas no se necesita Android Studio en el teléfono ni publicar en Play Store. La APK compartida aquí usa firma debug; antes de una distribución definitiva se debe preparar la firma release descrita arriba. El código se publica en GitHub, pero la APK no se adjunta automáticamente al hacer push: sigue siendo un archivo local.

## Instalar y verificar

1. Copiar el APK al teléfono, abrirlo y permitir instalación desde esa aplicación de archivos cuando Android lo solicite. También puede instalarse en un dispositivo de prueba con `adb install -r ruta-del-apk`.
2. Antes de guardar datos reales, activar modo avión, abrir por primera vez y configurar tarifa/condiciones.
3. Iniciar jornada, cerrar forzosamente la app, abrir de nuevo y comprobar que continúa; repetir tras reiniciar el teléfono.
4. Registrar/finalizar un descanso, una jornada manual que cruce medianoche y una corrección.
5. En Configuración → Copias de mis registros → Guardar respaldo, elegir una carpeta local como Descargas y confirmar Guardar. Revisar respaldo abre el selector para elegir el JSON; comprobar la vista previa antes de confirmar el reemplazo. Verificar también la exportación de la copia previa y el CSV de Resumen.
6. Comparar una semana completa con el comprobante de pago bruto y neto.

La app desactiva el backup automático y la transferencia de datos Android; usa respaldos explícitos. Se revisó el manifiesto combinado: no contiene permisos de Internet, ubicación, biometría ni almacenamiento general. El guardado usa un plugin local `LocalFiles` con `ACTION_CREATE_DOCUMENT`, sin depender de otra app para guardar en Descargas. Cancelar el selector conserva los datos. Referencias: [documentos de Android](https://developer.android.com/training/data-storage/shared/documents-files) y [plugins Android de Capacitor](https://capacitorjs.com/docs/plugins/android).

La cobertura ejecutada y sus límites están en [verification.md](verification.md). Las pruebas del emulador utilizaron datos sintéticos.
