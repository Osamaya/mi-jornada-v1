# Implementación actual — Mi Jornada v1.0

Fecha: 19 de octubre de 2026. Aplicación funcional local, con build de producción y proyecto Android generado. La instalación/piloto en dispositivo y el APK siguen pendientes del entorno Android.

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
  infrastructure/
    database/                 SQLite nativo, SQLite/WASM web, migración y repositorio
    backup/files.ts           JSON, CSV, guardado/compartir
  presentation/
    App.tsx                   inicio, historial y navegación
    pages/                    configuración y resumen
    components/SessionEditor.tsx
    styles.css                vista adaptable y modo del sistema
  shared/models.ts            contratos usados por la implementación
tests/                        dominio, SQLite y flujos Playwright
android/                      proyecto Capacitor y wrapper Gradle
```

## Funcionalidad

- Entrada/salida, una jornada abierta persistente, descansos pagados y comida libre no pagada.
- Registro manual, cruce de medianoche, edición con motivo, prevención transaccional de superposición y eliminación lógica auditada.
- Inicio, historial, resumen y configuración; botones grandes, etiquetas, diálogo con foco y colores del sistema.
- Historial de tarifa y condiciones por vigencia; cambios de modalidad desde esta semana o una futura, sin reescribir los fichajes ni condiciones de semanas previas.
- Tiempo observado, pagado/computable, ordinario y extra separados; segmentos de origen y explicación del cálculo.
- Bruto y neto estimados con campos pendientes explícitos. Datos fiscales por pago, retención federal calibrable y comparación con neto recibido.
- JSON versionado, validación completa, vista previa y confirmación de reemplazo; copia previa persistida en SQLite dentro de la misma transacción. Puede exportarse después desde Configuración.
- CSV por segmentos, con escape de campos potencialmente interpretados como fórmulas.

## Persistencia

En Android se usa `@capacitor-community/sqlite`; en web, `sql.js` con WASM empaquetado localmente y copia durable en IndexedDB. No hay servidor de datos. La versión de esquema instalada es 2 y se registra en `schema_migrations`; su fuente está en `src/infrastructure/database/schema.ts`. La migración añade un nombre opcional sin modificar jornadas. El respaldo v2 conserva ese nombre y acepta la conversión validada de respaldos v1.

Se valida todo el estado antes de cada commit. Sesiones, descansos, tarifas, configuraciones, pagos y auditoría se guardan en una transacción con revisión optimista. Para el volumen de un perfil personal, el repositorio reescribe sus tablas de datos en cada transacción; conserva las copias de recuperación aparte. Conviene optimizar escrituras incrementales antes de extenderlo a volúmenes grandes.

En web hay comparación atómica de revisión en IndexedDB entre pestañas. Una escritura fallida recupera el estado SQLite anterior en memoria. No hay fallback silencioso a memoria ni localStorage. La UI confirma una acción solo después de guardar. Al recuperar foco se recargan los datos. En Android se usa una conexión y transacciones del plugin.

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
- Verificación nativa y piloto de una semana real pendientes.

## Estado por fases

Diseño, dominio, persistencia, UI, cálculo y pruebas locales implementados. Capacitor sincronizado y proyecto Android preparado. La compilación APK se intentó; el wrapper no pudo descargar Gradle con la red restringida y no se encontró Android SDK configurado ni instalado en las rutas habituales. Se encontró Java 24. No se generó ni firmó un APK y no se afirma prueba en dispositivo.

La compilación APK requiere un SDK Android instalado. El procedimiento para completarlo se encuentra en [android.md](android.md). El piloto requiere una semana real y comprobante del usuario.
