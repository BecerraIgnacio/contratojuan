# Preguntas sobre el contrato /v1 1.1.0-rc1

Este archivo reúne lo que cambia entre el contrato /v1 1.0.0 (cerrado el 6-sep-2026) y el borrador 1.1.0-rc1 (`openapi-agentes.yaml`, con su mock Prism). Lo contesta Juan Goñe, con su asistente de IA si quiere, mirando el cliente del Agente 1. Fecha límite: 30-oct-2026, cuando el OpenAPI `/v1` se congela por tag.
Una respuesta CAMBIAR o NO ACEPTAR en la parte A se discute antes del congelado.
Si no hay respuesta a la parte B, esos cambios salen aparte en una 1.2.0 aditiva y la 1.1.0 congela el resto.

## Cómo contestar

Completá solo las líneas `Respuesta:` y `Detalle:` de cada pregunta. `Respuesta` es exactamente una de ACEPTAR, NO ACEPTAR, CAMBIAR. Con CAMBIAR o NO ACEPTAR, `Detalle` dice qué proponés o por qué. No toques los ids ni el resto del texto.

## A. Propuestas del borrador

### P-02 · `precision_fecha` suma `rango`

- **Contrato 1.0.0:** `precision_fecha` tiene 4 valores: `dia`, `mes`, `anio`, `decada` (§7).
- **Propuesta 1.1.0:** suma un quinto valor, `rango`, para fechas del tipo «entre 2015 y 2019»; se redacta «entre X y Y».
- **Qué toca en tu cliente:** si tu cliente tiene un enum cerrado de 4 valores, falla o descarta el fragmento con `rango`; tiene que aceptar el valor nuevo y redactar sin presentarlo como fecha exacta.
- **Probalo en el mock:** `GET /v1/fragmentos` con `Prefer: code=200, example=precisionRango` (y `example=precisionDecada` para comparar).

Respuesta: ACEPTAR
Detalle: `historia_viva.py` suma `rango` a `PRECISIONES_FECHA` y `RangoHistorico.expresion_temporal` lo redacta «entre X y Y», nunca como fecha exacta. Probado con `precisionRango`.

### P-03 · Forma de los ids

- **Contrato 1.0.0:** los ids son strings con patrón `^pza_[A-Za-z0-9._-]{1,60}$` para la Pieza; los ejemplos usan `pza_2016-0412`, `frg_01H9…-0003`, `apt_2026-0475`.
- **Propuesta 1.1.0:** el patrón no cambia; los ejemplos y los ids reales pasan a llevar un UUID (`pza_<uuid>`, `frg_<uuid>`, `apt_<uuid>`, `lot_<uuid>`). Un id con forma inválida da 400 `parametros_invalidos`.
- **Qué toca en tu cliente:** si validás o guardás ids con una forma más estricta que el patrón (largo fijo, solo fecha-número), los UUID no pasan; tratalos como strings opacos.
- **Probalo en el mock:** `GET /v1/piezas/{pieza_id}` con `Prefer: code=200, example=convenio` y con `Prefer: code=400, example=idMalFormado`.

Respuesta: ACEPTAR
Detalle: `historia_viva_cliente.py` trata los ids como strings opacos con el patrón del contrato 1.0.0 (`PIEZA_ID_RE` y afines) y no valida el UUID.

### P-04 · `TipoPieza` suma 4 tipos

- **Contrato 1.0.0:** enum abierto de 5 tipos: `fotografia`, `acta`, `resolucion`, `convenio`, `memoria`.
- **Propuesta 1.1.0:** 9 tipos: suma `nota`, `plano`, `planilla` y `video`. Un tipo nuevo a futuro sube la versión menor del contrato.
- **Qué toca en tu cliente:** si el tipo es un enum cerrado, un `planilla` o `video` rompe el parseo; tiene que tolerar valores nuevos o incorporar los cuatro.
- **Probalo en el mock:** `GET /v1/fragmentos` con `Prefer: code=200, example=planillaConSeccion` y `example=videoDescrito`; `GET /v1/piezas/{pieza_id}` con `Prefer: code=200, example=videoAnalizadoPorPersona`.

Respuesta: ACEPTAR
Detalle: En `historia_viva_cliente.py` el `tipo` es un string opaco: un tipo nuevo no rompe el parseo. Probado con `planillaConSeccion`, `videoDescrito` y `videoAnalizadoPorPersona`.

### P-05 · Códigos de error nuevos

- **Contrato 1.0.0:** `parametros_invalidos`, `idempotency_key_reutilizada`, `token_invalido`, `operacion_no_permitida`, `pieza_no_disponible`, `limite_superado`, `servicio_no_disponible` (§5).
- **Propuesta 1.1.0:** suma `fuente_inexistente` (400, una pieza de `piezas_fuente` que no existe o no está Validada) y `ruta_inexistente` (404). No hay 413 ni 500: el cuerpo grande y la cabecera ausente dan 400 `parametros_invalidos`, y una falla no prevista da 503.
- **Qué toca en tu cliente:** tu cliente tiene que decidir por `codigo` con un caso por defecto para códigos desconocidos; todo 4xx no se reintenta, y no esperes un 413 ni un 500.
- **Probalo en el mock:** `POST /v1/aportes` con `Prefer: code=400, example=fuenteInexistente` y `example=cuerpoGrande`; `GET /v1/fragmentos` con `Prefer: code=404, example=rutaInexistente`.

Respuesta: ACEPTAR
Detalle: `historia_viva_http.py` decide por `codigo` (`CODIGOS_V1`) y, si el código es desconocido, cae por familia: todo 4xx es definitivo y todo 5xx es indisponibilidad. Ningún 4xx se reintenta.

### P-06 · Parámetros desconocidos dan 400

- **Contrato 1.0.0:** no dice qué pasa con un parámetro que no existe.
- **Propuesta 1.1.0:** un parámetro desconocido da 400 `parametros_invalidos`; un `limit` mal escrito en vez de `limite` no se ignora.
- **Qué toca en tu cliente:** si tu cliente manda parámetros extra (de trazabilidad, de prueba), ahora falla; mandá solo los que define el OpenAPI.
- **Probalo en el mock:** `GET /v1/fragmentos` con `Prefer: code=400, example=parametroDesconocido` (y `example=sinCriterio` para la consulta sin criterio).

Respuesta: ACEPTAR
Detalle: `historia_viva_http.py` manda solo `q`, `desde`, `hasta`, `tipo` y `limite`. La trazabilidad de A1 no viaja en la query.

### P-07 · Idempotencia sin vencimiento

- **Contrato 1.0.0:** Historia Viva recuerda una `Idempotency-Key` 30 días; un reintento posterior crea un aporte nuevo (§6).
- **Propuesta 1.1.0:** la clave se recuerda sin vencimiento y el contrato dice «al menos 30 días».
- **Qué toca en tu cliente:** un reintento pasados los 30 días ya no crea un aporte nuevo: devuelve el original (200) o 400 `idempotency_key_reutilizada` si cambió el cuerpo; no reutilices claves entre aportes distintos.
- **Probalo en el mock:** no aplica: el mock no guarda estado. Solo se ven los formatos con `POST /v1/aportes` y `Prefer: code=201, example=creado`, `code=200, example=repetido`, `code=400, example=claveReutilizada` o `example=claveAusente`; el comportamiento real se prueba en la sesión presencial.

Respuesta: ACEPTAR
Detalle: Una clave por aporte (`Aporte.clave_idempotencia`, mínimo 8 caracteres). El reintento de aportes sigue apagado por defecto (`PoliticaCliente.reintentar_aportes`) hasta probar la idempotencia real en la sesión presencial.

### P-09 · `url_original` apunta a Historia Viva

- **Contrato 1.0.0:** `url_original` es el enlace al documento en Drive, que el Agente 1 hoy no puede abrir (§3.1, §3.2, §10).
- **Propuesta 1.1.0:** sigue siendo un campo requerido de tipo `uri`, pero apunta a la Pieza en Historia Viva (`{HV_URL_PUBLICA}/validar.html?pieza=<uuid>`), que abre una persona de la FIE con su sesión. Tu cliente no puede abrirlo. Mientras no haya servidor, el enlace solo abre en la PC del alumno.
- **Qué toca en tu cliente:** no lo descargues ni lo sigas desde el Agente 1; usalo solo como referencia para una persona y no esperes un dominio de Drive.
- **Probalo en el mock:** `GET /v1/fragmentos` con `Prefer: code=200, example=conResultados`; `GET /v1/piezas/{pieza_id}` con `Prefer: code=200, example=convenio`.

Respuesta: ACEPTAR
Detalle: `historia_viva_cliente.py` guarda `url_original` como referencia para una persona y nunca la sigue. Solo exige `http(s)`, sin dominio de Drive.

### P-10 · Límites de consultas

- **Contrato 1.0.0:** el número del límite no está acordado; se propone antes del 30-oct y se ajusta en la prueba de integración (§8, §10).
- **Propuesta 1.1.0:** 60 consultas por minuto, 10 aportes por minuto y 2 búsquedas en vuelo por token. Las respuestas traen `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` y, en el 429, `Retry-After`.
- **Qué toca en tu cliente:** una publicación que dispare muchas búsquedas en paralelo puede pasar las 2 en vuelo; tu cliente tiene que serializar o encolar y esperar `Retry-After` en el 429, nunca en ráfaga.
- **Probalo en el mock:** el mock no cuenta consultas, así que no aplica el cupo real; solo el formato con `Prefer: code=429, example=limite` en cualquier endpoint.

Respuesta: ACEPTAR
Detalle: A1 consulta en serie, sin búsquedas en paralelo. Ante un 429 o 503 espera el `Retry-After` hasta 30 s (`PoliticaCliente.espera_maxima_segundos`); si le piden más, falla sin reintentar en ráfaga.

### P-13 · Rotación de token

- **Contrato 1.0.0:** la rotación emite un token nuevo y revoca el anterior, con una «ventana de solapamiento acordada por las partes» (§4).
- **Propuesta 1.1.0:** pueden convivir varios tokens activos; formato `hv_<8 hex>_<43 base64url>`; cada token vence a los 180 días; ventana de solapamiento de 7 días.
- **Qué toca en tu cliente:** tu cliente tiene que poder cambiar el token sin reiniciar y tratarlo como string opaco; un token vencido o revocado da 401 `token_invalido`.
- **Probalo en el mock:** no aplica la rotación (el mock acepta cualquier token `Bearer`); solo el error con `Prefer: code=401, example=tokenInvalido` en cualquier endpoint.

Respuesta: ACEPTAR
Detalle: `historia_viva_http.py` lee el token en cada envío, así que se puede rotar sin reiniciar. Lo trata como string opaco y un 401 es definitivo. El token tiene que llegar por fuera de banda (ver `PEDIDOS-AGENTE1.md`).

## B. Pendiente de C48

### C48-1 · Efemérides por `GET /v1/efemerides`

- **Contrato 1.0.0:** el punto 7 de §1 y §11 dicen que la efeméride deja de ser un producto de Historia Viva; no hay endpoint de efemérides y el Agente 1 consulta por período y redacta la suya.
- **Propuesta 1.1.0:** `GET /v1/efemerides?desde&hasta` devuelve solo las Efemérides Aprobadas, redactadas por Historia Viva y firmadas por una persona de la SEU.
- **Qué toca en tu cliente:** endpoint nuevo opcional: podés seguir redactando la tuya o consumir la aprobada; hay que decidir cuál usa tu flujo.
- **Probalo en el mock:** `GET /v1/efemerides` con `Prefer: code=200, example=conResultados` y `example=sinResultados`.

Respuesta: ACEPTAR
Detalle: Se acepta que exista, pero A1 no lo consume. A1 compone su propia efeméride con `GET /v1/fragmentos` (`posts_efemeride.py`, ADR 0008) y no pide `efemerides:leer`.

### C48-2 · Aportes Validados vuelven por `/v1`

- **Contrato 1.0.0:** `GET /v1/piezas/{pieza_id}` da 404 hasta que una persona valide la Pieza; después sí la devuelve (§5).
- **Propuesta 1.1.0:** un Aporte Validado se devuelve por `/v1/piezas/{pieza_id}` y `/v1/fragmentos` como cualquier otra Pieza, y también vale como fuente en `piezas_fuente`. Desaparece el 404 permanente que habíamos avisado.
- **Qué toca en tu cliente:** tus propios aportes, una vez Validados, vuelven en las búsquedas y en `GET /v1/piezas/{pieza_id}` como cualquier Pieza; decidí si tu flujo los cita igual que al resto.
- **Probalo en el mock:** `GET /v1/piezas/{pieza_id}` con `Prefer: code=200, example=aporteValidado`; `Prefer: code=404, example=noDisponible` para una Pieza no Validada.

Respuesta: ACEPTAR
Detalle: `historia_viva_cliente.py` parsea un Aporte Validado como cualquier Pieza (probado con `aporteValidado`). Los aportes de A1 no entran en la demo del 18/11; cómo citarlos se define después.

### C48-3 · `422 aporte_rechazado`

- **Contrato 1.0.0:** `POST /v1/aportes` no define rechazo por contenido; solo 400, 401, 403, 429 y 503.
- **Propuesta 1.1.0:** devuelve `422` con `codigo: aporte_rechazado` si el contenido trae etiquetas de control de modelos (`### Instruction:`, `[SYSTEM]`, `<|im_start|>`, `<|system|>`, `[INST]` y variantes). No crea Pieza ni registra la `Idempotency-Key`.
- **Qué toca en tu cliente:** es el primer 422 de `/v1`: tu cliente no debe reintentar con la misma clave ni el mismo texto; tiene que sanear el texto o marcar el aporte como fallido.
- **Probalo en el mock:** `POST /v1/aportes` con `Prefer: code=422, example=aporteRechazado`. La detección real solo se prueba contra la API.

Respuesta: ACEPTAR
Detalle: `historia_viva_http.py` traduce el 422 a `historia_viva_aporte_rechazado`, que es definitivo: no se reintenta con la misma clave ni con el mismo texto, y el aporte queda fallido para revisión humana.

### C48-4 · Relatos por `GET /v1/relatos`

- **Contrato 1.0.0:** no hay endpoint de Relatos.
- **Propuesta 1.1.0:** `GET /v1/relatos?desde&hasta` devuelve solo los Relatos Aprobados (texto de difusión sobre un hito, no atado a una fecha), con `desde` y `hasta` sobre la fecha de aprobación e ids `rel_<uuid>`.
- **Qué toca en tu cliente:** endpoint nuevo y opcional; un Relato no tiene fecha de hito, así que no lo trates como una efeméride de fecha fija.
- **Probalo en el mock:** `GET /v1/relatos` con `Prefer: code=200, example=conResultados` y `example=sinResultados`.

Respuesta: ACEPTAR
Detalle: Se acepta que exista, pero A1 no consume relatos ni pide el alcance.

### C48-5 · Alcance de token `efemerides:leer`

- **Contrato 1.0.0:** los alcances del token son `fragmentos:leer`, `piezas:leer` y `aportes:escribir` (§4).
- **Propuesta 1.1.0:** alcance nuevo `efemerides:leer`, que cubre `GET /v1/efemerides` y `GET /v1/relatos`. Los tokens existentes no lo tienen: hay que emitir uno con el alcance.
- **Qué toca en tu cliente:** con el token actual, los dos endpoints nuevos dan 403; hace falta un token nuevo y manejar el 403 como error definitivo.
- **Probalo en el mock:** `GET /v1/efemerides` o `GET /v1/relatos` con `Prefer: code=403, example=sinAlcance`.

Respuesta: ACEPTAR
Detalle: A1 no pide `efemerides:leer`. Con el token actual, un 403 es definitivo (`historia_viva_forbidden`).

### C48-6 · Semántica de `GET /v1/efemerides`

- **Contrato 1.0.0:** no existe el endpoint, así que no hay semántica definida.
- **Propuesta 1.1.0:** devuelve las Efemérides Aprobadas cuyo intervalo de difusión se solapa con el pedido (día: la misma fecha; mes: el mes entero). `desde` y `hasta` son obligatorios y el máximo es 92 días. Los ids son `efe_<uuid>` y `rel_<uuid>`; el máximo de 92 días y los dos parámetros obligatorios valen también para `GET /v1/relatos`.
- **Qué toca en tu cliente:** una efeméride de mes aparece en cualquier pedido que toque ese mes; tu cliente tiene que partir períodos de más de 92 días en varios pedidos y mandar siempre ambas fechas.
- **Probalo en el mock:** `GET /v1/efemerides` con `Prefer: code=400, example=sinPeriodo` y `example=periodoLargo` (igual en `GET /v1/relatos`); `Prefer: code=200, example=conResultados`.

Respuesta: ACEPTAR
Detalle: Sin efecto en A1: no consume `GET /v1/efemerides` ni `GET /v1/relatos`.
