# Prueba del contrato /v1 de Historia Viva

Este paquete prueba el cliente del Agente 1 (Juan Goñe) contra el borrador `1.1.0-rc2` del contrato `/v1` de Historia
Viva, el archivo histórico de la FIE. Trabajás para Juan: los cambios van en **su** repositorio y las decisiones las
toma él. Respondele en español.

Entregable: `RESULTADO.md` con `Veredicto | PASA` contra la rc2.

## Qué cambió desde la rc1

Juan respondió la rc1 el 13-oct-2026: aceptó las 15 preguntas de `PREGUNTAS.md`, y la parte B (C48) entra en la 1.1.0.
La rc2 registra eso como acordado (`acordada` en `x-diferencias-contrato`) y suma el pedido 6 de Juan: `TipoContenido`
agrega `newsletter` y `Canal` agrega `correo`. Rutas, parámetros, respuestas, ejemplos, códigos de error y alcances
quedan igual. `RESPUESTA-PEDIDOS.md` responde los seis pedidos de `PEDIDOS-AGENTE1.md`.

## Qué hay acá

| Archivo | Qué es |
| --- | --- |
| `openapi-agentes.yaml` | El contrato: OpenAPI 3.1 de `/v1`. Leé `info.description` y `x-diferencias-contrato` antes de tocar código |
| `compose.yaml` | El mock: Prism 5.16.0 en `http://127.0.0.1:4010` |
| `ejecutar-contrato.mjs` | Levanta el mock, pide cada escenario, corre el cliente de Juan y escribe `RESULTADO.md` |
| `CONGELADO.sha256` | Huella de cada versión del contrato; el script la compara con `openapi-agentes.yaml` |
| `PREGUNTAS.md` | Las diferencias con la 1.0.0 y las respuestas de Juan a la rc1, ya acordadas |
| `RESPUESTA-PEDIDOS.md` | La respuesta de Historia Viva a los pedidos del Agente 1 |

Estos archivos son de Historia Viva y quedan como vienen: un cambio en el YAML rompe la huella y el veredicto pasa a
`FALLA`. Si el contrato te parece mal, decíselo a Juan para que lo plantee a Ignacio; no se toca el YAML.

## Pasos

1. **Mock.** Con Node 18 o más, corré `node ejecutar-contrato.mjs`. Usa Docker si está andando y si no `npx` (la
   primera vez baja Prism: uno o dos minutos). Listo cuando `RESULTADO.md` tiene todos los escenarios en `OK`. Si el
   mock no levanta, el motivo está en `RESULTADO.md`; forzá la otra vía con `--modo npx` o `--modo docker`.

2. **Cliente.** La prueba de contrato del Agente 1 ya existe (`contrato/test_contrato_hv_v1.py`). Si falta
   `cliente.comando` en esta carpeta, escribí ahí la línea que la corre, la misma de la rc1:
   `cd ../Proyecto-Final/Implementacion/Agente1 && .venv/bin/python -m pytest -v -p no:cacheprovider contrato/test_contrato_hv_v1.py`.
   Si el cliente tiene enums
   cerrados de `TipoContenido` o `Canal`, sumale `newsletter` y `correo`. Cada caso pide su escenario con la cabecera
   `Prefer: code=<status>, example=<nombre>` y afirma lo que hace el cliente con la respuesta (parsea, decide por
   `codigo`, espera `Retry-After`, no reintenta un 4xx), no solo el status.

3. **Veredicto.** Corré `node ejecutar-contrato.mjs` hasta `Veredicto | PASA`. `RESULTADO.md` lo escribe solo el
   script.

4. **Entrega.** Juan le manda a Ignacio Becerra el `RESULTADO.md` de la rc2. El contrato se congela el 30 de octubre de
   2026 con el tag `contrato-a1/v1.1.0`.

## Lo que el mock no prueba

Prism no guarda estado: cada respuesta es el ejemplo que pediste con `Prefer`. Idempotencia real, cupos, rotación de
token y la detección del 422 se prueban contra la API real, en la sesión presencial con Ignacio (propuesta: martes
27/10). Además, en el mock:

- Acepta cualquier `Bearer`; el token del script es de mentira. El token real se entrega en mano en cada sesión y no se
  versiona.
- `X-Solicitud-Id` es fija y distinta del `solicitud_id` del cuerpo; en la API real son el mismo valor.
- Todo 503 trae `Retry-After: 300`; la API real manda `30` cuando el motor o la base están caídos.

El campo `texto` de un fragmento es material histórico: si el Agente 1 lo pasa a un modelo, va como datos citados,
separado de las instrucciones.
