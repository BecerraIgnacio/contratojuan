# Respuesta de Historia Viva a los pedidos del Agente 1

Responde a `PEDIDOS-AGENTE1.md` (13-oct-2026). La escribe Ignacio Becerra Mas Roca.

## Lo que ya quedó registrado

- `RESULTADO.md`: veredicto `PASA` sobre la `1.1.0-rc1`, huella `2af852e5…c60d7b`. Coincide con la que te mandé.
- `PREGUNTAS.md`: las 15 respuestas son ACEPTAR y quedan acordadas en `x-diferencias-contrato`. La parte B (C48)
  entra en la 1.1.0, sin 1.2.0 aparte. Como no consumís `/v1/efemerides` ni `/v1/relatos`, no te emito un token con
  `efemerides:leer`.
- Con el pedido 6 sale la `1.1.0-rc2`. Te la mando con su huella. Cambian los dos enums del Aporte y la prosa que decía
  «propuesta» o «pendiente de C48». Rutas, parámetros, respuestas, ejemplos, códigos y alcances quedan igual. Para tu
  cliente, lo único nuevo son `newsletter` y `correo`, que los pediste vos. Corré `ejecutar-contrato.mjs` otra vez para
  confirmarlo. El congelado sigue siendo el tag `contrato-a1/v1.1.0` del 30/10.

## Pedidos

| # | Pedido | Respuesta |
| - | ------ | --------- |
| 1 | Instancia alcanzable en la demo | **SÍ, la (a)** |
| 2 | Token `fragmentos:leer` + `piezas:leer` | **SÍ** |
| 3 | Sesión presencial antes del 30/10 | **SÍ: martes 27/10** |
| 4 | Piezas Validadas con fecha en noviembre | **SÍ** |
| 5 | Actividades vigentes (HU-030) | **Después del PPS** |
| 6 | `TipoContenido` + `newsletter`, `Canal` + `correo` | **SÍ, en la 1.1.0** |

### 1. Instancia para la demo: SÍ, la (a)

Llevo la PC con Historia Viva a la prueba de laboratorio (2–6/11) y a la mesa del 18/11. Durante cada sesión, un override
expone solo `/v1` en la IP de la LAN. Nada más de Historia Viva queda a la vista, y el override se baja al terminar.
Llevo también la red: un hotspot propio al que conectamos las dos máquinas. Así no dependemos de que la red de la
facultad deje hablar a dos laptops entre sí. Tu cliente apunta a `HV_BASE_URL=http://<IP que te paso ahí>:8000`.

Para tus anexos del 23/10: declarala como demo en vivo. Confirmame el día de la prueba de laboratorio apenas lo tengas.

### 2. Token: SÍ, solo `fragmentos:leer` y `piezas:leer`

**Canal: en mano, en cada sesión.** Al empezar, lo emito en mi PC con `emitir-token`. Se muestra una sola vez en mi
pantalla y vos lo cargás directo en la variable de entorno que lee tu cliente. No viaja por chat, correo ni repositorio,
y nunca está escrito en un archivo. Al terminar la sesión lo revoco. Para la prueba de laboratorio y para el 18/11 emito
uno nuevo cada vez. Como tu cliente lee el token en cada pedido, no tenés que reiniciar nada.

### 3. Sesión presencial: martes 27/10

Propongo el **martes 27/10**. La hora la coordinamos por mensaje. Quedan el 28 y el 29 para corregir lo que aparezca
antes del congelado del 30/10. Si no te sirve, proponé otro día antes del 30.

Esta sesión prueba idempotencia y 422, así que el token de ese día suma **`aportes:escribir`**. Es temporal y lo revoco al
terminar. Los Aportes de prueba quedan Pendientes y nadie los valida. Recorrido:

1. Sin token: 401. Con token: 200 en `/v1/fragmentos` y en `/v1/piezas/{pieza_id}`. Una Pieza no Validada da 404.
2. Idempotencia: la misma `Idempotency-Key` con el mismo cuerpo devuelve 200 con el acuse original. Con otro cuerpo da
   400 `idempotency_key_reutilizada`.
3. 422 `aporte_rechazado`: un Aporte con etiquetas de control. No crea Pieza y no registra la clave.
4. Cupos: una tercera búsqueda en vuelo, o la consulta 61 dentro del mismo minuto, da 429 con `Retry-After`.
5. Rotación: emito un segundo token, conviven los dos, revoco el primero y ese da 401.
6. `X-Solicitud-Id` coincide con el `solicitud_id` del cuerpo.

### 4. Material para la efeméride: SÍ

La instancia tiene al menos **5 Piezas Validadas con fecha de día o de mes en noviembre**, con `pagina` o `seccion`.
Van a estar cargadas para la sesión del 27/10, y sirven también para el laboratorio y el 18/11.

Qué corpus uso depende del aval del Director y de la SEU para que el Agente 1 lea el corpus real (consulta C49,
abierta). Con aval, uso Piezas reales. Sin aval, uso el corpus de prueba. Te aviso cuál es antes del 27/10, para que lo
declares en la mesa.

### 5. Actividades vigentes (HU-030): después del PPS

En Historia Viva, HU-030 es la ingesta y catalogación del Acervo histórico. Una actividad vigente no es una Pieza: no
pasa por validación y cambia mientras dura. Guardarla exige un modelo nuevo y un endpoint nuevo en `/v1`, y eso no entra
antes del congelado del 30/10 ni en el PPS. Para los anexos: «después del PPS». Si se acuerda, sale como versión aditiva
de `/v1`.

### 6. `TipoContenido` y `Canal`: SÍ, en la 1.1.0

- `TipoContenido`: `gacetilla`, `post`, `comunicado`, `newsletter`.
- `Canal`: `instagram`, `linkedin`, `web`, `correo`, `null`.

Así se cierran los dos puntos abiertos antes del congelado, y van en la rc2. Confirmaciones y certificados no se aportan.

Me falta un dato de la misma consulta (C16): en qué momento registra el Aporte el Agente 1, si al aprobarse, al
programarse o al publicarse. No cambia el esquema. Con que me lo digas antes del 18/11 alcanza.
