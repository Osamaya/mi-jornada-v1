# Compilar e instalar en Android

El proyecto está en `android/`, con identificador local `app.mijornada.personal`. No hay APK generado en esta entrega: no se encontró Android SDK y el primer intento de Gradle fue bloqueado al descargar su distribución por la red restringida. Java 24 está presente; usar el JDK compatible de Android Studio al preparar el entorno.

## Preparar el equipo

1. Instalar Android Studio compatible con Capacitor 8 y su JDK incluido.
2. En SDK Manager, instalar Android SDK Platform 36, Build Tools y Platform Tools; aceptar las licencias.
3. Configurar la ruta del SDK con Android Studio, `ANDROID_HOME` o `android/local.properties` (no se versiona). Seleccionar el JDK de Gradle compatible; Capacitor 8 utiliza Java 21 como referencia.
4. En la carpeta del proyecto:

```powershell
npm ci --legacy-peer-deps
npm run android:sync
npm run android:open
```

La instalación de dependencias y compilación requieren red en el equipo desarrollador. El APK empaqueta sus recursos y SQLite; no necesita Internet para arrancar ni registrar datos. Fuentes: [Capacitor — entorno](https://capacitorjs.com/docs/getting-started/environment-setup), [SQLite — repositorio oficial](https://github.com/capacitor-community/sqlite).

## APK de prueba

```powershell
npm run android:apk
```

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
