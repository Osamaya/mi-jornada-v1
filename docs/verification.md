# Verificación de implementación

Fecha: 19 de octubre de 2026. Datos de prueba sintéticos, sin usar registros personales. Los resultados siguientes corresponden a la aplicación implementada.

## Comandos y resultados

| Comprobación                             | Resultado                                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                               | **62 pruebas aprobadas**, tres archivos: dominio, perfil y repositorio SQLite.                                               |
| `npm run build`                          | **Correcto**: TypeScript estricto y build Vite de producción en `dist/`.                                                     |
| `npm run test:e2e`                       | **8 pruebas aprobadas**: dos flujos completos, cuatro de personalización/ayudas y dos de guardado lento, escritorio y móvil. |
| `npm run format:check`                   | **Correcto**: código y documentación vigentes con formato consistente.                                                       |
| Arranque del build de producción         | **Correcto** en vista móvil oscura, SQLite/WASM local, sin solicitudes externas ni desbordamiento horizontal.                |
| `npm exec cap sync android`              | **Correcto**: recursos, SQLite y App sincronizados; `LocalFiles` registrado en la actividad Android.                         |
| `npm audit`                              | **0 vulnerabilidades reportadas** al cierre, con lockfile actualizado.                                                       |
| Enlaces relativos Markdown / XML Android | **Correctos** mediante revisión local de archivos y parser XML.                                                              |
| `:app:assembleDebug`                     | **Correcto**: primera APK debug 1.0.0, `versionCode` 1.                                                                      |
| `:app:lintDebug`                         | **0 errores y 7 advertencias**: dependencias, recursos sin uso y carpeta de recursos heredada.                               |
| `apksigner verify --verbose`             | **Correcto**: firma v2 debug válida.                                                                                         |
| APK en emulador Android 17 / API 37      | **Instalada y verificada** con SQLite nativo, modo avión y selectores reales de archivos.                                    |

Se corrigió una cadena vulnerable de herramientas fijando Capacitor CLI en 8.4.3. La comprobación no garantiza ausencia futura de vulnerabilidades.

## Cobertura

Dominio: semanas de 35/40/45 horas; umbral inferior/igual/superior a USD 18; diario con semana corta; ambos ejemplos de AO-2025-05 y los cuatro de AO-2025-07; 4×10 regular, ejemplo 12/10/10/10 e irregularidades pendientes; medianoche, domingo, contexto anterior a semana, cambios de modalidad, DST, comida, tarifas, precisión monetaria y datos laborales incompletos.

Fiscal: porcentaje federal editable, SS y su tope 2026, Medicare y el cruce del umbral adicional, ingresos previos desconocidos, régimen sin confirmar, otras deducciones y año no verificado. No hay lógica que infiera exención por estatus migratorio o falta de identificador.

Perfil: nombre opcional con acentos, validación de longitud/caracteres, rechazo de perfiles inválidos, conversión de respaldos v1 a v2 sin alterar el archivo original y conservación de jornadas.

Repositorio SQLite: migraciones 1 y 2, actualización de una base v1 conservando jornadas, persistencia del nombre, recuperación de jornada abierta desde la base, edición/auditoría atómicas, revisión obsoleta, solapamientos, rollback por falla de escritura, copia previa de restauración y rechazo de respaldo inválido o vista previa obsoleta.

Navegador en ambos tamaños: configurar, guardar nombre y recuperar el saludo tras recargar, fichar, recargar con jornada abierta, finalizar sin red después de cargar los recursos, registro manual, cálculo bruto/neto, dejar el acumulado previo pendiente sin convertirlo en cero, editar con motivo, conservar segundos originales al cambiar solo la nota, descargar JSON, rechazar JSON corrupto y restaurar con confirmación.

Experiencia: nombres largos, ayudas FICA por toque y teclado, descuentos inicialmente plegados, campos de al menos 16 px y temas claro/oscuro. Escritorio de 1440 px, Pixel 7 y pruebas de experiencia a 360 px. Sin errores JavaScript detectados y sin desbordamiento horizontal en las vistas revisadas. Capturas en `test-results/` (excluidas de Git) se inspeccionaron visualmente.

La regresión de guardado lento retiene la confirmación de IndexedDB: comprueba el estado “Guardando…”, controles deshabilitados hasta terminar y conservación de un acumulado explícito de cero después de recargar. No se sustituye el cero por un dato pendiente.

## Verificación nativa ejecutada

Emulador `Medium_Phone_API_37.0`, Android 17 / API 37, WebView 145.0.7632.218, pantalla 1080×2400 y viewport de 411×914 CSS px. Instalación por ADB y acciones en la WebView de la APK; se usaron también toques, teclado, botón Atrás y selectores del sistema Android. Las capturas completas del dispositivo se inspeccionaron visualmente.

| Flujo                          | Resultado observado                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primera apertura en modo avión | La app abre sus recursos locales y crea SQLite nativo.                                                                                                                                      |
| Nombre y configuración         | Saludo e iniciales guardados; teclado en pantalla sin ocultar el campo y ayudas FICA legibles.                                                                                              |
| Entrada, descanso y salida     | Se guardan jornadas y descansos pagados; se pueden finalizar después de abrir de nuevo.                                                                                                     |
| Cierre forzado                 | Se recuperan el nombre, la jornada abierta y su descanso sin Internet.                                                                                                                      |
| Reinicio completo de Android   | Se compararon directamente las filas SQLite: mismos IDs e instantes originales para jornada y descanso abiertos.                                                                            |
| Registro manual y pago         | Jornada sintética de una hora a USD 20/h, más fichaje breve; bruto/neto disponibles al completar los datos. El acumulado desconocido permanece pendiente.                                   |
| Navegación y presentación      | Atrás vuelve al inicio y cierra el editor; teclado, zona superior y temas reales claro/oscuro revisados, sin desbordamiento horizontal. Iconos del sistema con contraste acorde al tema.    |
| Respaldo y CSV                 | Guardados físicamente en Descargas mediante el selector del sistema, en modo avión. JSON v2 y texto CSV leídos y comprobados. Cancelar el selector no muestra error ni reemplaza registros. |
| Restauración                   | JSON seleccionado desde Android, vista previa y confirmación; recupera nombre y jornadas. Se exportó y comprobó también la copia previa con el nombre anterior al reemplazo.                |
| Actualización de APK           | `adb install -r` conserva el nombre y las jornadas sintéticas existentes.                                                                                                                   |

Se comprobó el manifiesto combinado generado por Gradle: `allowBackup=false`, `fullBackupContent=false`, reglas que excluyen backup/transferencia, sin permisos de Internet, ubicación, biometría ni almacenamiento general. Se eliminó la dependencia del menú Compartir para guardar archivos locales. No se detectaron errores JavaScript en el flujo completo ni excepciones fatales de Android en la comprobación del reinicio.

La APK local está en `artifacts/MiJornada-1.0.0-debug.apk`, con SHA-256 en el mismo directorio. APK, capturas, respaldos sintéticos y herramientas temporales se excluyen de Git; las capturas Android quedan en `.tools/android-validation/`. El APK no incluye los registros de prueba del emulador.

## Límites de la verificación

La prueba nativa cubre un emulador API 37; no se probó un teléfono físico ni otros niveles de Android. El mínimo API 24 es el declarado por el proyecto, no una matriz completa de dispositivos verificados. No se realizó una revisión con TalkBack ni con una persona externa al desarrollo.

El bloqueo anterior de descarga del wrapper quedó resuelto. Se compiló con JDK 24 y Gradle 8.14.3; Gradle instaló SDK Platform 36 y Build Tools 35.0.0 usando licencias ya aceptadas. La ruta local del SDK está configurada en `android/local.properties`, excluido de Git. No se creó una firma definitiva de distribución. El procedimiento reproducible está en [android.md](android.md).

Las reglas e irregularidades no verificadas se bloquean con mensajes; no se marcan como cálculos legales aprobados. Quedan pendientes el piloto contra un recibo real y la comprobación en el teléfono de uso diario. La firma debug se entrega para pruebas.

La documentación describe comprobaciones locales. El registro de cambios y publicación de código se consulta en el historial Git del repositorio.
