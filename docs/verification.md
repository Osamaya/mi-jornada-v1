# Verificación de implementación

Fecha: 19 de octubre de 2026. Datos de prueba sintéticos, sin usar registros personales. Los resultados siguientes corresponden a la aplicación implementada.

## Comandos y resultados

| Comprobación                             | Resultado                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test`                               | **58 pruebas aprobadas**, dos archivos: dominio y repositorio SQLite.                                         |
| `npm run build`                          | **Correcto**: TypeScript estricto y build Vite de producción en `dist/`.                                      |
| `npm run test:e2e`                       | **2 flujos aprobados**: escritorio 1440 px y móvil Pixel 7, Chromium/Edge.                                    |
| Arranque del build de producción         | **Correcto** en vista móvil oscura, SQLite/WASM local, sin solicitudes externas ni desbordamiento horizontal. |
| `npm exec cap sync android`              | **Correcto**: recursos y tres plugins sincronizados en el proyecto Android.                                   |
| `npm audit`                              | **0 vulnerabilidades reportadas** al cierre, con lockfile actualizado.                                        |
| Enlaces relativos Markdown / XML Android | **Correctos** mediante revisión local de archivos y parser XML.                                               |
| APK                                      | **No generado**; el entorno no tiene SDK Android detectado/configurado.                                       |

Se corrigió una cadena vulnerable de herramientas fijando Capacitor CLI en 8.4.3. La comprobación no garantiza ausencia futura de vulnerabilidades.

## Cobertura

Dominio: semanas de 35/40/45 horas; umbral inferior/igual/superior a USD 18; diario con semana corta; ambos ejemplos de AO-2025-05 y los cuatro de AO-2025-07; 4×10 regular, ejemplo 12/10/10/10 e irregularidades pendientes; medianoche, domingo, contexto anterior a semana, cambios de modalidad, DST, comida, tarifas, precisión monetaria y datos laborales incompletos.

Fiscal: porcentaje federal editable, SS y su tope 2026, Medicare y el cruce del umbral adicional, ingresos previos desconocidos, régimen sin confirmar, otras deducciones y año no verificado. No hay lógica que infiera exención por estatus migratorio o falta de identificador.

Repositorio SQLite: migración, recuperación de jornada abierta desde la base, edición/auditoría atómicas, revisión obsoleta, solapamientos, rollback por falla de escritura, copia previa de restauración y rechazo de respaldo inválido o vista previa obsoleta.

Navegador en ambos tamaños: configurar, fichar, recargar con jornada abierta, finalizar sin red después de cargar los recursos, registro manual, cálculo bruto/neto, editar con motivo, conservar segundos originales al cambiar solo la nota, descargar JSON, rechazar JSON corrupto y restaurar con confirmación. Sin errores JavaScript detectados y sin desbordamiento horizontal en las vistas revisadas. Capturas en `test-results/` (excluidas de Git) se inspeccionaron visualmente.

## Límites de la verificación

La recuperación por recarga web y SQLite en memoria no sustituye un cierre forzado real en Android. No se ejecutó dispositivo ni emulador, no se probó el selector nativo ni se comprobó el manifiesto combinado por Gradle.

El intento `android/gradlew.bat assembleDebug` se detuvo al descargar Gradle por la red restringida. Se comprobó Java 24 y ausencia de `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `adb`, `sdkmanager` y de SDK en las rutas habituales. No se instalaron SDKs ni se creó una firma de distribución. El procedimiento pendiente está en [android.md](android.md).

Las reglas e irregularidades no verificadas se bloquean con mensajes; no se marcan como cálculos legales aprobados. El piloto contra un recibo real y la instalación inicial sin Internet en Android quedan pendientes.

La documentación describe comprobaciones locales. El registro de cambios y publicación de código se consulta en el historial Git del repositorio.
