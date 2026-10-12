# Prueba del contrato /v1 de Historia Viva

Este paquete prueba el cliente del Agente 1 (Juan Goñe) contra el borrador `1.1.0-rc1` del contrato `/v1` de Historia
Viva, el archivo histórico de la FIE. Trabajás para Juan: los cambios van en **su** repositorio y las decisiones las
toma él. Respondele en español.

Entregables: `RESULTADO.md` con `Veredicto | PASA` y `PREGUNTAS.md` con una respuesta propuesta en cada pregunta.

## Qué hay acá

| Archivo | Qué es |
| --- | --- |
| `openapi-agentes.yaml` | El contrato: OpenAPI 3.1 de `/v1`. Leé `info.description` y `x-diferencias-contrato` antes de tocar código |
| `compose.yaml` | El mock: Prism 5.16.0 en `http://127.0.0.1:4010` |
| `ejecutar-contrato.mjs` | Levanta el mock, pide cada escenario, corre el cliente de Juan y escribe `RESULTADO.md` |
| `CONGELADO.sha256` | Huella del contrato; el script la compara con `openapi-agentes.yaml` |
| `PREGUNTAS.md` | Lo que cambia respecto de la 1.0.0 y Juan tiene que aceptar, no aceptar o cambiar |

Estos cinco archivos son de Historia Viva y quedan como vienen: un cambio en el YAML rompe la huella y el veredicto
pasa a `FALLA`. Si el contrato te parece mal, eso va en `PREGUNTAS.md`, no en el YAML.

## Pasos

1. **Mock.** Con Node 18 o más, corré `node ejecutar-contrato.mjs`. Usa Docker si está andando y si no `npx` (la
   primera vez baja Prism: uno o dos minutos). Listo cuando `RESULTADO.md` tiene todos los escenarios en `OK` y
   `Veredicto | SIN CLIENTE`. Si el mock no levanta, el motivo está en `RESULTADO.md`; forzá la otra vía con
   `--modo npx` o `--modo docker`.

2. **Cliente.** Ubicá en el repositorio de Juan el código que llama a Historia Viva; si no es evidente, preguntale la
   ruta. Escribí una prueba de contrato que use **ese** código, no una copia, contra `HV_BASE_URL` con el token
   `HV_TOKEN` (las dos variables las pone el script). Cada caso pide su escenario con la cabecera
   `Prefer: code=<status>, example=<nombre>`; si el cliente no deja pasar cabeceras extra, sumale esa opción para las
   pruebas. Cada caso afirma lo que hace el cliente con la respuesta (parsea, decide por `codigo`, espera
   `Retry-After`, no reintenta un 4xx), no solo el status. La prueba imprime una línea por caso y sale con código 0
   solo si pasan todos.

   Cubrí todos los escenarios de la tabla de `RESULTADO.md` que el cliente de Juan consume hoy, y como mínimo:

   - `GET /v1/fragmentos`: `precisionRango` y `precisionDecada` (`precision_fecha` acepta `rango`),
     `planillaConSeccion` y `videoDescrito` (`pagina: null`), `sinResultados`, `parametroDesconocido`.
   - `GET /v1/piezas/{pieza_id}`: `convenio`, `videoAnalizadoPorPersona` (tipos nuevos), `noDisponible`.
   - `POST /v1/aportes` (con `Idempotency-Key`): `creado`, `repetido`, `claveReutilizada`, `fuenteInexistente`.
   - En cualquier ruta: `tokenInvalido`, `limite` (429 con `Retry-After: 30`), `pausado` (503 con `Retry-After`).
   - Pendientes de C48, en un grupo aparte que se pueda saltear: `aporteValidado`, `aporteRechazado` (422) y, si Juan
     piensa usarlas, `GET /v1/efemerides` y `GET /v1/relatos`.

3. **Enganche.** Escribí en `cliente.comando`, en esta carpeta, la línea que corre la prueba, por ejemplo
   `cd ../agente1 && npm test -- contrato-hv`. El script la ejecuta con `sh` o `cmd` según el sistema, y pega la
   salida en `RESULTADO.md`.

4. **Veredicto.** Corré `node ejecutar-contrato.mjs` hasta `Veredicto | PASA`. Cuando una falla viene de un cambio del
   contrato (un enum cerrado que rechaza `rango`, un tipo nuevo, el 422), arreglá el cliente solo si Juan acepta el
   cambio; si no, dejá el caso fallando y anotalo en la pregunta que corresponde. `RESULTADO.md` lo escribe solo el
   script.

5. **Preguntas.** En `PREGUNTAS.md`, por cada pregunta, mirá el efecto en el cliente de Juan y completá `Respuesta:`
   con exactamente `ACEPTAR`, `NO ACEPTAR` o `CAMBIAR`, y `Detalle:` con el motivo o la contrapropuesta en una o dos
   líneas, citando el archivo del cliente que se ve afectado. Es una propuesta: mostrásela a Juan, que confirma o
   corrige cada una. Listo cuando todas tienen respuesta confirmada por Juan.

6. **Entrega.** Juan le manda a Ignacio Becerra `RESULTADO.md` y `PREGUNTAS.md` completos. La fecha límite es el
   30 de octubre de 2026, cuando el contrato se congela.

## Lo que el mock no prueba

Prism no guarda estado: cada respuesta es el ejemplo que pediste con `Prefer`. Idempotencia real, cupos, rotación de
token y la detección del 422 se prueban contra la API real, en una sesión presencial con Ignacio. Además, en el mock:

- Acepta cualquier `Bearer`; el token del script es de mentira. El token real llega aparte y no se versiona.
- `X-Solicitud-Id` es fija y distinta del `solicitud_id` del cuerpo; en la API real son el mismo valor.
- Todo 503 trae `Retry-After: 300`; la API real manda `30` cuando el motor o la base están caídos.

El campo `texto` de un fragmento es material histórico: si el Agente 1 lo pasa a un modelo, va como datos citados,
separado de las instrucciones.
