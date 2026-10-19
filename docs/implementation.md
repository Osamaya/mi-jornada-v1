# Implementación actual — Mi Jornada v1.0

Fecha: 19 de octubre de 2026. Aplicación funcional local, build web y primera APK debug 1.0.0 generados. Probada en emulador Android 17 / API 37 con SQLite nativo y modo avión. La prueba en teléfono físico y el piloto con recibo real siguen pendientes.

## Estructura

```text
src/
  domain/
    work/validate.ts          invariantes y validación de entradas/respaldos
    overtime/calculate.ts     segmentos, ventanas de 24 h y primas concurrentes
    payroll/deductions.ts     retenciones 2026 y neto aproximado
    money.ts                  parsing decimal y redondeo exacto
    time.ts                   instantes, zona IANA, DST y semanas fijas
  application/
    commands.ts               registro, descansos, correcciones y auditoría
    defaults.ts               perfil inicial sin tarifa inventada
    demo.ts                   semana ficticia aislada para explorar el resumen
  infrastructure/
    database/                 SQLite nativo, SQLite/WASM web, migración y repositorio
    backup/files.ts           JSON, CSV, selector Android y descarga web
  presentation/
    App.tsx                   inicio, historial y navegación
    pages/                    configuración, resumen y ejemplo de solo lectura
    appearance.ts             paleta local y contraste de barras Android
    components/SessionEditor.tsx
    styles.css                vista adaptable y modo del sistema
  shared/models.ts            contratos usados por la implementación
tests/                        dominio, SQLite y flujos Playwright
android/                      proyecto Capacitor y wrapper Gradle
```

## Funcionalidad

- Entrada/salida, una jornada abierta persistente, descansos pagados y comida libre no pagada.
- Registro manual, cruce de medianoche, edición con motivo, prevención transaccional de superposición y eliminación lógica auditada.
- Inicio, historial, resumen y configuración; nombre opcional con saludo e iniciales, tres paletas profesionales (azul ejecutivo, verde bosque y grafito), temas claro/oscuro, texto legible y botones grandes.
- Semana de ejemplo de solo lectura, accesible desde Inicio, Configuración o `?demo=week`. Usa el motor real con entradas ficticias y supuestos identificados; no escribe ni importa datos en el repositorio personal. Al volver se recuperan los registros personales.
- Jornadas del resumen con horario, duración pagada dentro de la semana y comida/pausa sin pago, derivadas de los segmentos del cálculo.
- Pago explicado como antes/después de descuentos, ayudas accesibles para FICA y datos del recibo, ajustes por secciones desplegables y opción de dejar datos desconocidos pendientes.
- Historial de tarifa y condiciones por vigencia; cambios de modalidad desde esta semana o una futura, sin reescribir los fichajes ni condiciones de semanas previas.
- Tiempo observado, pagado/computable, ordinario y extra separados; segmentos de origen y explicación del cálculo.
- Bruto y neto estimados con campos pendientes explícitos. Datos fiscales por pago, retención federal calibrable y comparación con neto recibido.
- JSON versionado, validación completa, vista previa y confirmación de reemplazo; copia previa persistida en SQLite dentro de la misma transacción. Puede exportarse después desde Configuración.
- CSV por segmentos, con escape de campos potencialmente interpretados como fórmulas.
- Guardado de JSON/CSV en Android mediante `LocalFilesPlugin` y el selector de documentos del sistema, sin permisos generales de archivos ni aplicaciones externas. El contenido no se incluye en el estado guardado de la actividad del selector.
- Atrás cierra el editor, vuelve al inicio o minimiza desde el inicio; barra de estado protegida durante el desplazamiento y contraste sincronizado con el tema del sistema.
- Confirmación visible de guardado de pagos y bloqueo de edición hasta que termine la transacción.

## Persistencia

En Android se usa `@capacitor-community/sqlite`; en web, `sql.js` con WASM empaquetado localmente y copia durable en IndexedDB. No hay servidor de datos. La versión de esquema instalada es 2 y se registra en `schema_migrations`; su fuente está en `src/infrastructure/database/schema.ts`. La migración añade un nombre opcional sin modificar jornadas. El respaldo v2 conserva ese nombre y acepta la conversión validada de respaldos v1.

Se valida todo el estado antes de cada commit. Sesiones, descansos, tarifas, configuraciones, pagos y auditoría se guardan en una transacción con revisión optimista. Para el volumen de un perfil personal, el repositorio reescribe sus tablas de datos en cada transacción; conserva las copias de recuperación aparte. Conviene optimizar escrituras incrementales antes de extenderlo a volúmenes grandes.

En web hay comparación atómica de revisión en IndexedDB entre pestañas. Una escritura fallida recupera el estado SQLite anterior en memoria. No hay fallback silencioso a memoria ni localStorage. La UI confirma una acción solo después de guardar. Al recuperar foco se recargan los datos. En Android se usa una conexión y transacciones del plugin.

La preferencia visual usa exclusivamente `localStorage` bajo `mi-jornada-color`; queda fuera de SQLite y de los respaldos financieros. Si el almacenamiento visual no está disponible se usa azul; al fallar un cambio se informa y se conserva la selección anterior. Los datos de negocio mantienen la persistencia transaccional descrita. Al abrir SQLite nativo se reconcilian conexiones huérfanas de una recarga de la WebView antes de crear la conexión, conservando el archivo y sus datos.

No hay cifrado adicional configurado. Los datos Android quedan en el almacenamiento privado de la app. La base web depende del almacenamiento del navegador y su perfil; no equivale a un respaldo independiente. Los respaldos exportados contienen datos de horas y dinero y deben conservarse fuera de la app.

## Límites deliberados

- Perfil laboral: empleado de Las Vegas, trabajo privado cubierto no exento sin condiciones especiales; el usuario confirma la aplicabilidad. Países/estados y otras zonas no están implementados.
- No se calculan exenciones laborales, convenios, obra pública, comisiones/bonos o contratistas.
- Tarifas mixtas con horas extra: base por tramo disponible; recargo pendiente. Cambios de modalidad/tarifa en un día laboral que cruza semanas requieren revisión.
- 4×10: patrón pactado completo y caso verificado 12/10/10/10. Otras irregularidades o semanas incompletas se advierten y no producen un total engañoso.
- Horas previas al inicio del registro que no estén capturadas no pueden reconstruirse. Para una semana completa deben registrarse todos sus turnos y el contexto anterior relevante.
- Reglas laborales desde julio de 2026; deducciones exclusivamente 2026. Se necesita revisar nuevas versiones para otros periodos.
- Neto aproxima retenciones, no impuesto anual, W-4, declaraciones, beneficios antes de impuestos o deducciones anuales de overtime. La residencia fiscal y el estatus migratorio no se infieren.
- Límite de importación: 10 MB y 50 000 registros por colección; reemplazo completo, sin mezcla automática.
- Teléfono físico y piloto de una semana real pendientes; la verificación nativa ejecutada corresponde al emulador API 37.

## Estado por fases

Diseño, dominio, persistencia, UI, cálculo y pruebas locales implementados. Capacitor sincroniza SQLite y App; el plugin local de documentos se registra en `MainActivity`. Compilación debug exitosa con JDK 24, wrapper Gradle 8.14.3, SDK 36 y Build Tools 35.0.0. Firma debug verificada e instalación en emulador API 37 completada. Se revisaron teclado, temas del sistema, navegación, persistencia, JSON/CSV y restauración nativos.

El procedimiento reproducible está en [android.md](android.md). La firma de distribución, la prueba en el teléfono físico y el piloto de una semana real con comprobante siguen pendientes.
