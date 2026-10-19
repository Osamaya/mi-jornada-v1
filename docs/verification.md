# Verificación de implementación

Fecha: 19 de octubre de 2026. Datos de prueba sintéticos, sin usar registros personales. Los resultados siguientes corresponden a la aplicación implementada.

## Comandos y resultados

| Comprobación                             | Resultado                                                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm test`                               | **62 pruebas aprobadas**, tres archivos: dominio, perfil y repositorio SQLite.                                          |
| `npm run build`                          | **Correcto**: TypeScript estricto y build Vite de producción en `dist/`.                                                |
| `npm run test:e2e`                       | **6 pruebas aprobadas**: dos flujos completos y cuatro de personalización/ayudas en claro y oscuro, escritorio y móvil. |
| `npm run format:check`                   | **Correcto**: código y documentación vigentes con formato consistente.                                                  |
| Arranque del build de producción         | **Correcto** en vista móvil oscura, SQLite/WASM local, sin solicitudes externas ni desbordamiento horizontal.           |
| `npm exec cap sync android`              | **Correcto**: recursos y tres plugins sincronizados en el proyecto Android.                                             |
| `npm audit`                              | **0 vulnerabilidades reportadas** al cierre, con lockfile actualizado.                                                  |
| Enlaces relativos Markdown / XML Android | **Correctos** mediante revisión local de archivos y parser XML.                                                         |
| APK                                      | **No generado**; faltan Platform 36 y Build Tools 35.0.0 en el SDK detectado.                                           |

Se corrigió una cadena vulnerable de herramientas fijando Capacitor CLI en 8.4.3. La comprobación no garantiza ausencia futura de vulnerabilidades.

## Cobertura

Dominio: semanas de 35/40/45 horas; umbral inferior/igual/superior a USD 18; diario con semana corta; ambos ejemplos de AO-2025-05 y los cuatro de AO-2025-07; 4×10 regular, ejemplo 12/10/10/10 e irregularidades pendientes; medianoche, domingo, contexto anterior a semana, cambios de modalidad, DST, comida, tarifas, precisión monetaria y datos laborales incompletos.

Fiscal: porcentaje federal editable, SS y su tope 2026, Medicare y el cruce del umbral adicional, ingresos previos desconocidos, régimen sin confirmar, otras deducciones y año no verificado. No hay lógica que infiera exención por estatus migratorio o falta de identificador.

Perfil: nombre opcional con acentos, validación de longitud/caracteres, rechazo de perfiles inválidos, conversión de respaldos v1 a v2 sin alterar el archivo original y conservación de jornadas.

Repositorio SQLite: migraciones 1 y 2, actualización de una base v1 conservando jornadas, persistencia del nombre, recuperación de jornada abierta desde la base, edición/auditoría atómicas, revisión obsoleta, solapamientos, rollback por falla de escritura, copia previa de restauración y rechazo de respaldo inválido o vista previa obsoleta.

Navegador en ambos tamaños: configurar, guardar nombre y recuperar el saludo tras recargar, fichar, recargar con jornada abierta, finalizar sin red después de cargar los recursos, registro manual, cálculo bruto/neto, dejar el acumulado previo pendiente sin convertirlo en cero, editar con motivo, conservar segundos originales al cambiar solo la nota, descargar JSON, rechazar JSON corrupto y restaurar con confirmación.

Experiencia: nombres largos, ayudas FICA por toque y teclado, descuentos inicialmente plegados, campos de al menos 16 px y temas claro/oscuro. Escritorio de 1440 px, Pixel 7 y pruebas de experiencia a 360 px. Sin errores JavaScript detectados y sin desbordamiento horizontal en las vistas revisadas. Capturas en `test-results/` (excluidas de Git) se inspeccionaron visualmente.

## Límites de la verificación

La recuperación por recarga web y SQLite en memoria no sustituye un cierre forzado real en Android. No se ejecutó dispositivo ni emulador, no se probó el selector nativo ni se comprobó el manifiesto combinado por Gradle.

El intento `android/gradlew.bat assembleDebug` se detuvo al descargar Gradle por la red restringida. La revisión posterior detectó Android Studio instalado, su runtime Java 25 y un JDK 24 independiente. Durante la comprobación apareció una instalación del SDK con Platform 37.0, Build Tools 36.0.0 y Platform Tools en la ubicación habitual; no están las versiones Platform 36 y Build Tools 35.0.0 requeridas por el proyecto. `ANDROID_HOME` y `ANDROID_SDK_ROOT` no están configurados. Debe completarse el SDK y seleccionarse JDK 21 o el JDK 24 existente para el wrapper Gradle 8.14.3. El agente no instaló SDKs ni creó una firma de distribución. El procedimiento pendiente está en [android.md](android.md).

Las reglas e irregularidades no verificadas se bloquean con mensajes; no se marcan como cálculos legales aprobados. El piloto contra un recibo real y la instalación inicial sin Internet en Android quedan pendientes.

La documentación describe comprobaciones locales. El registro de cambios y publicación de código se consulta en el historial Git del repositorio.
