# Mi Jornada

Aplicación personal para registrar jornadas y estimar pago bruto y neto semanal en USD. React + TypeScript + Vite, Capacitor Android y SQLite local. Cuatro pantallas en español, sin cuentas, servidor ni APIs de datos.

**Estado: aplicación funcional y proyecto Android preparado.** Build de producción, pruebas de dominio/SQLite y flujos de escritorio/móvil comprobados. **APK pendiente:** no se encontró Android SDK en este entorno; no hay instalación ni piloto nativo verificados.

## Ejecutar en esta carpeta

Requiere Node 22.12 o posterior. En PowerShell:

```powershell
npm ci --legacy-peer-deps
npm run dev
```

Abrir la dirección local que imprime Vite (habitualmente `http://127.0.0.1:5173`). Para comprobar:

```powershell
npm test
npm run build
npm run test:e2e
npm run format:check
```

Playwright usa Edge si está instalado en la ruta habitual. En otro equipo, instalar su navegador con `npx playwright install chromium`. `--legacy-peer-deps` evita un fallo interno de npm 10.9 al resolver peers opcionales; las versiones exactas están en `package-lock.json`. Capacitor CLI permanece fijado en 8.4.3 para evitar la cadena vulnerable detectada al instalar una versión posterior.

## Uso inicial

En Configuración puedes guardar tu nombre o apodo. Es opcional: personaliza el saludo y el perfil, se conserva en el dispositivo y viaja con tus respaldos. Las copias de la versión anterior se actualizan al restaurarlas sin perder las jornadas.

La interfaz usa “antes de descuentos” y “después de descuentos” para explicar el pago bruto y neto. Las ayudas se abren al tocar “¿Qué significa?” o la pregunta correspondiente; funcionan también con teclado. En los datos del recibo se explica FICA, dónde buscar el acumulado del recibo anterior y cómo dejarlo pendiente sin adivinar un cero. Los descuentos y respaldos están en secciones desplegables para completar cuando se necesiten.

1. Configurar tarifa y vigencia; confirmar semana laboral y aplicabilidad del perfil de empleado cubierto no exento.
2. Iniciar/finalizar jornada o agregar registros manuales. La comida pagada con obligaciones no se descuenta.
3. Consultar Resumen. Para el neto, confirmar las deducciones e ingresar fecha de pago y salarios acumulados previos de ese empleador según recibo. No se supone cero.
4. Guardar respaldos JSON fuera de la app. El CSV sirve para revisión, no para restauración.

El porcentaje federal inicial de 10 % es un supuesto sin confirmar, editable y calibrable; no es una tasa universal del IRS. No se solicitan campos de estatus migratorio, SSN, ITIN ni identificación. El neto aproxima retenciones y no reemplaza una declaración fiscal.

En web, SQLite/WASM persiste en IndexedDB del navegador; en Android usa el plugin SQLite nativo. El motor es independiente de React/Capacitor. La ubicación bajo `htdocs` no implica PHP ni MySQL; ejecutar con Vite o compilar los recursos.

## Documentación

- [Implementación, estructura y límites](docs/implementation.md).
- [Reglas laborales/fiscales y situación migratoria](docs/legal-validation.md).
- [Pruebas ejecutadas y límites de verificación](docs/verification.md).
- [Compilar e instalar Android](docs/android.md).

## Cálculos y límites

El perfil inicial es un empleado por hora de Las Vegas, zona `America/Los_Angeles`. La tarifa queda pendiente hasta configurarla. El registro de tiempo sigue disponible aunque falten datos para estimar el pago.

- Semana laboral fija de 168 horas desde un ancla confirmada; el día laboral de Nevada se evalúa en periodos consecutivos de 24 horas, sin reinicio por medianoche.
- Tarifa inferior a USD 18/h: candidatos diario después de 8 horas y semanal después de 40. Tarifa igual o superior: semanal después de 40. La resolución de primas evita duplicar el recargo y conserva intervalos de origen.
- Modalidad 4×10 solo tras confirmar acuerdo y días pactados. Se implementan el patrón completo de cuatro jornadas de diez horas y el ejemplo oficial 12/10/10/10; otras irregularidades requieren revisión.
- Comida con obligaciones y descansos cortos pagados se cuentan. La comida libre no pagada de al menos 30 minutos se descuenta explícitamente.
- Dinero con enteros/BigInt; bruto redondeado una sola vez al centavo. Las tarifas y condiciones conservan vigencia e historial de cambios.
- Social Security 6.2 % con tope de base 2026 de USD 184 500; Medicare 1.45 %; Medicare adicional según umbral de retención del empleador. El neto requiere fecha de pago, régimen confirmado y salarios previos del mismo empleador.

El bruto muestra **“Pendiente”** en condiciones sin confirmar, tarifas mixtas con overtime y horarios 4×10 fuera de los escenarios verificados. El importe base puede seguir disponible y no se presenta como total. Reglas laborales verificadas desde julio de 2026 y tasas fiscales para 2026; periodos fuera de alcance requieren actualizar la validación. No se implementan declaraciones fiscales, exenciones particulares, convenios, obra pública, bonos, beneficios antes de impuestos ni cálculos anuales.

Los resultados son estimaciones explicables, no garantías de pago. Las fuentes oficiales y la demostración del cálculo concurrente se encuentran en [validación legal](docs/legal-validation.md).

## Arquitectura

```text
src/domain/          Intervalos, overtime, dinero, fechas y deducciones
src/application/     Registro, correcciones y auditoría
src/infrastructure/  SQLite, migraciones, respaldo y archivos
src/presentation/    Cuatro pantallas y componentes React
src/shared/          Contratos TypeScript
tests/               Dominio, SQLite y flujos de navegador
android/             Proyecto Capacitor y wrapper Gradle
docs/                Uso técnico, reglas y verificación
```

## Respaldo y protección de datos

Las escrituras y su auditoría son transaccionales. Se rechazan jornadas/descansos superpuestos y ediciones basadas en una revisión obsoleta. Una jornada abierta conserva su instante inicial después de recargar.

Para restaurar: seleccionar JSON, revisar conteos y confirmar el reemplazo completo. Se valida antes de escribir y se conserva una copia previa en SQLite; puede exportarse desde Configuración. La restauración no mezcla archivos automáticamente. Límite: 10 MB y 50 000 elementos por colección.

No existe sincronización cloud ni cifrado adicional configurado. Android usa almacenamiento privado y desactiva backup automático; el navegador usa su propio almacenamiento local. Desinstalar la app o borrar los datos del navegador puede eliminar los registros: guardar respaldos fuera de la aplicación.

## Verificación de esta entrega

| Comprobación                                               | Resultado                                   |
| ---------------------------------------------------------- | ------------------------------------------- |
| Vitest: dominio y SQLite                                   | 58 pruebas aprobadas                        |
| Playwright: escritorio y móvil                             | 2 flujos completos aprobados                |
| TypeScript y build Vite                                    | Correctos                                   |
| Arranque del build, móvil oscuro, sin solicitudes externas | Correcto                                    |
| Auditoría de dependencias                                  | 0 vulnerabilidades reportadas al 19/10/2026 |
| Sincronización Capacitor                                   | Correcta                                    |
| APK / dispositivo Android / piloto con recibo real         | Pendientes                                  |

Para generar el APK, completar el entorno Android y seguir la [guía de compilación e instalación](docs/android.md). No se incluye un APK inexistente ni claves de firma.

## Repositorio

[Osamaya/mi-jornada-v1](https://github.com/Osamaya/mi-jornada-v1). El repositorio incluye código, pruebas, configuración Android y documentación vigente. Se excluyen dependencias, builds, bases de datos, respaldos personales, secretos, claves de firma, instrucciones del agente y borradores locales. No se ha definido una licencia de distribución.
