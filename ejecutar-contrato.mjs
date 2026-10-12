#!/usr/bin/env node
// Prueba el contrato /v1 de Historia Viva contra el mock Prism y escribe RESULTADO.md.
// Uso: node ejecutar-contrato.mjs [--modo docker|npx]   (Node 18 o más; sin --modo usa Docker si está andando, si no npx)
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { arch, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const PRISM = "5.16.0";
const PUERTO = 4010;
const BASE = `http://127.0.0.1:${PUERTO}`;
const TOKEN = "hv_00000000_" + "x".repeat(43); // el mock acepta cualquier Bearer
const WINDOWS = platform() === "win32";
const ID = /^req_[0-9A-Za-z]+$/;
let terminarMock = () => {};

const COMUNES = [
  ["tokenInvalido", 401, "token_invalido"],
  ["sinAlcance", 403, "operacion_no_permitida"],
  ["limite", 429, "limite_superado"],
  ["pausado", 503, "servicio_no_disponible"],
  ["motorCaido", 503, "servicio_no_disponible"],
];
const PERIODO = [
  ["conResultados", 200],
  ["sinResultados", 200],
  ["sinPeriodo", 400, "parametros_invalidos"],
  ["periodoLargo", 400, "parametros_invalidos"],
  ["rutaInexistente", 404, "ruta_inexistente"],
];
const APORTE = {
  titulo: "La FIE celebra diez años de cooperación con la UTN",
  cuerpo: "La Facultad de Ingeniería del Ejército conmemora una década del convenio marco con la UTN, firmado en abril de 2016.",
  tipo_contenido: "gacetilla",
  canal: null,
  piezas_fuente: ["pza_5b2e9c40-7a13-4d88-9f06-1c3a8e4d2b77"],
  fragmentos_fuente: ["frg_e41d0c7a-2f95-5b3e-a8c1-96d7f0b3c254"],
};
// [ejemplo, status, codigo de error, "C48" si está pendiente de C48]
const RUTAS = [
  {
    ruta: "GET /v1/fragmentos",
    pedido: "/v1/fragmentos?q=convenio",
    ejemplos: [
      ["conResultados", 200], ["precisionDecada", 200], ["precisionRango", 200], ["planillaConSeccion", 200],
      ["videoDescrito", 200], ["sinResultados", 200], ["sinCriterio", 400, "parametros_invalidos"],
      ["parametroDesconocido", 400, "parametros_invalidos"], ["rutaInexistente", 404, "ruta_inexistente"],
    ],
  },
  {
    ruta: "GET /v1/piezas/{pieza_id}",
    pedido: "/v1/piezas/pza_5b2e9c40-7a13-4d88-9f06-1c3a8e4d2b77",
    ejemplos: [
      ["convenio", 200], ["videoAnalizadoPorPersona", 200], ["aporteValidado", 200, null, "C48"],
      ["idMalFormado", 400, "parametros_invalidos"], ["noDisponible", 404, "pieza_no_disponible"],
    ],
  },
  { ruta: "GET /v1/efemerides", pedido: "/v1/efemerides?desde=2026-04-01&hasta=2026-04-30", c48: true, ejemplos: PERIODO },
  { ruta: "GET /v1/relatos", pedido: "/v1/relatos?desde=2026-11-01&hasta=2026-11-30", c48: true, ejemplos: PERIODO },
  {
    ruta: "POST /v1/aportes",
    pedido: "/v1/aportes",
    cuerpo: APORTE,
    ejemplos: [
      ["creado", 201], ["repetido", 200], ["claveReutilizada", 400, "idempotency_key_reutilizada"],
      ["claveAusente", 400, "parametros_invalidos"], ["cuerpoGrande", 400, "parametros_invalidos"],
      ["fuenteInexistente", 400, "fuente_inexistente"], ["rutaInexistente", 404, "ruta_inexistente"],
      ["aporteRechazado", 422, "aporte_rechazado", "C48"],
    ],
  },
];
const ESCENARIOS = RUTAS.flatMap((r) =>
  [...r.ejemplos, ...COMUNES].map(([ejemplo, status, codigo, c48]) => ({ ...r, ejemplo, status, codigo, c48: r.c48 || !!c48 })),
);

function huella() {
  const texto = readFileSync(join(AQUI, "openapi-agentes.yaml"), "utf8").replace(/\r\n/g, "\n");
  const version = texto.match(/^info:[\s\S]*?^ {2}version:\s*["']?([^"'\s]+)/m)?.[1] ?? "desconocida";
  const sha = createHash("sha256").update(texto).digest("hex");
  const congelada = readFileSync(join(AQUI, "CONGELADO.sha256"), "utf8")
    .split("\n")
    .map((l) => l.trim().split(/\s+/))
    .find(([h, v]) => !h.startsWith("#") && v === version)?.[0];
  return { version, sha, coincide: congelada === sha, congelada };
}

function correr(comando, opciones = {}) {
  return spawnSync(comando, { shell: true, cwd: AQUI, encoding: "utf8", ...opciones });
}

function puertoLibre() {
  return new Promise((ok) => {
    const s = createServer().once("error", () => ok(false));
    s.listen(PUERTO, "127.0.0.1", () => s.close(() => ok(true)));
  });
}

async function levantarMock(modo) {
  if (!(await puertoLibre())) throw new Error(`el puerto ${PUERTO} está ocupado: bajá lo que corre ahí (¿un docker compose up anterior?)`);
  let salida, terminar;
  if (modo === "docker") {
    const r = correr("docker compose up -d");
    if (r.status !== 0) throw new Error("docker compose up falló:\n" + r.stdout + r.stderr);
    terminar = () => correr("docker compose down");
    salida = () => { const l = correr("docker compose logs"); return l.stdout + l.stderr; };
  } else {
    const proceso = spawn(`npx --yes @stoplight/prism-cli@${PRISM} mock -h 127.0.0.1 -p ${PUERTO} openapi-agentes.yaml`, {
      shell: true, cwd: AQUI, detached: !WINDOWS, stdio: ["ignore", "pipe", "pipe"],
    });
    let bitacora = "";
    proceso.stdout.on("data", (d) => (bitacora += d));
    proceso.stderr.on("data", (d) => (bitacora += d));
    salida = () => bitacora;
    terminar = () => {
      if (proceso.exitCode !== null) return;
      if (WINDOWS) correr(`taskkill /PID ${proceso.pid} /T /F`); // npx deja hijos de node: hay que matar el árbol
      else try { process.kill(-proceso.pid, "SIGTERM"); } catch {}
    };
  }
  terminarMock = terminar;
  const limite = Date.now() + 240_000; // la primera vez baja Prism (y la imagen de Node)
  while (Date.now() < limite) {
    try {
      await fetch(BASE + RUTAS[3].pedido, { signal: AbortSignal.timeout(2000) });
      return { terminar, salida };
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const bitacora = salida(); // antes de bajarlo: docker compose down borra los logs
  terminar();
  throw new Error("Prism no levantó en 240 s:\n" + bitacora);
}

async function probar(e) {
  const cabeceras = { Authorization: `Bearer ${TOKEN}`, Accept: "application/json", Prefer: `code=${e.status}, example=${e.ejemplo}` };
  if (e.cuerpo) Object.assign(cabeceras, { "Content-Type": "application/json", "Idempotency-Key": "3f1c9a12-7f0b-4a2e-9a7d-0c5b6e2f1d44" });
  const [metodo] = e.ruta.split(" ");
  let r;
  try {
    r = await fetch(BASE + e.pedido, { method: metodo, headers: cabeceras, body: e.cuerpo && JSON.stringify(e.cuerpo), signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    return { obtenido: "—", fallas: [`sin respuesta: ${error.message}`] };
  }
  const texto = await r.text();
  const fallas = [];
  const h = (n) => r.headers.get(n);
  let cuerpo;
  try { cuerpo = JSON.parse(texto); } catch { fallas.push("el cuerpo no es JSON"); }
  if (r.status !== e.status) fallas.push(`status ${r.status}: ${texto.slice(0, 200).replace(/\s+/g, " ")}`);
  if (!ID.test(h("X-Solicitud-Id") ?? "")) fallas.push("falta X-Solicitud-Id req_…");
  if (e.codigo && cuerpo) {
    if (cuerpo.codigo !== e.codigo) fallas.push(`codigo ${cuerpo.codigo}, se esperaba ${e.codigo}`);
    if (!ID.test(cuerpo.solicitud_id ?? "")) fallas.push("falta solicitud_id req_…");
    const extra = Object.keys(cuerpo).filter((k) => !["codigo", "mensaje", "solicitud_id"].includes(k));
    if (extra.length) fallas.push(`campos de más en el error: ${extra.join(", ")}`);
  }
  if (e.status === 429 && h("Retry-After") !== "30") fallas.push(`Retry-After ${h("Retry-After")}, se esperaba 30`);
  if (e.status === 503 && !/^\d+$/.test(h("Retry-After") ?? "")) fallas.push("falta Retry-After");
  if (e.status === 201 && !h("Location")) fallas.push("falta Location");
  if (e.status !== 401) {
    const faltan = ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"].filter((n) => !h(n));
    if (faltan.length) fallas.push(`faltan ${faltan.join(", ")}`);
  }
  return { obtenido: r.status, fallas };
}

function leerComandoDelCliente() {
  const archivo = join(AQUI, "cliente.comando");
  if (!existsSync(archivo)) return null;
  return readFileSync(archivo, "utf8").split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith("#")) ?? null;
}

function correrCliente(comando) {
  const inicio = Date.now();
  const r = correr(`${comando} 2>&1`, {
    env: { ...process.env, HV_BASE_URL: BASE, HV_TOKEN: TOKEN },
    timeout: 600_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1);
  const salida = ((r.stdout ?? "") + (r.error ? `\n[ejecutar-contrato] ${r.error.message}` : "")).split(/\r?\n/).slice(-200).join("\n");
  return { comando, codigo: r.status ?? "sin código (cortado)", segundos, salida, ok: r.status === 0 };
}

const celda = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function escribirResultado({ h, modo, resultados, cliente, errorMock }) {
  const ok = resultados.filter((r) => !r.fallas.length).length;
  const c48 = resultados.filter((r) => r.c48).length;
  const todoOk = h.coincide && !errorMock && ok === ESCENARIOS.length;
  const veredicto = !todoOk || (cliente && !cliente.ok) ? "FALLA" : cliente ? "PASA" : "SIN CLIENTE";
  const textoCliente = !cliente
    ? "NO EJECUTADO (no hay cliente.comando)"
    : errorMock ? "NO EJECUTADO (el mock no levantó)"
    : `${cliente.ok ? "OK" : "FALLA"}, código de salida ${cliente.codigo} en ${cliente.segundos} s`;
  const lineas = [
    "# RESULTADO del contrato /v1",
    "",
    "| Campo | Valor |",
    "| --- | --- |",
    `| Veredicto | ${veredicto} |`,
    `| Versión | ${h.version} |`,
    `| Huella | \`${h.sha}\` (${h.coincide ? "coincide con CONGELADO.sha256" : `NO coincide con CONGELADO.sha256: ${h.congelada ?? "sin huella para la versión"}`}) |`,
    `| Mock | Prism ${PRISM} con ${modo} en ${BASE} |`,
    `| Escenarios | ${ok}/${ESCENARIOS.length} OK (${c48} pendientes de C48) |`,
    `| Cliente del Agente 1 | ${textoCliente} |`,
    `| Fecha | ${new Date().toISOString()} |`,
    `| Equipo | ${platform()} ${arch()}, Node ${process.version} |`,
    "",
    "## Escenarios",
    "",
  ];
  if (errorMock) lineas.push("El mock no levantó:", "", "```text", errorMock.trim().split(/\r?\n/).slice(-60).join("\n"), "```", "");
  lineas.push("| # | Ruta | Ejemplo | C48 | Esperado | Obtenido | Resultado | Detalle |", "| --- | --- | --- | --- | --- | --- | --- | --- |");
  resultados.forEach((r, i) =>
    lineas.push(`| ${i + 1} | ${r.ruta} | ${r.ejemplo} | ${r.c48 ? "sí" : ""} | ${r.status} | ${r.obtenido} | ${r.fallas.length ? "FALLA" : "OK"} | ${celda(r.fallas.join("; "))} |`),
  );
  lineas.push("", "## Cliente del Agente 1", "");
  if (cliente && !errorMock) {
    lineas.push(`Comando: \`${cliente.comando}\``, "", `Código de salida: ${cliente.codigo} · Duración: ${cliente.segundos} s`, "", "Últimas 200 líneas de la salida:", "", "```text", cliente.salida.replace(/```/g, "ˋˋˋ"), "```");
  } else {
    lineas.push(textoCliente + ".");
  }
  writeFileSync(join(AQUI, "RESULTADO.md"), lineas.join("\n") + "\n");
  return veredicto;
}

for (const senal of ["SIGINT", "SIGTERM"]) process.on(senal, () => { terminarMock(); process.exit(130); });

const pedido = process.argv.indexOf("--modo");
const modo = pedido > 0 ? process.argv[pedido + 1] : correr("docker info", { timeout: 20_000 }).status === 0 ? "docker" : "npx";
if (!["docker", "npx"].includes(modo)) {
  console.error("--modo es docker o npx");
  process.exit(2);
}
const h = huella();
const comandoCliente = leerComandoDelCliente();
let resultados = ESCENARIOS.map((e) => ({ ...e, obtenido: "—", fallas: ["no se probó"] }));
let cliente = comandoCliente && { comando: comandoCliente };
let errorMock = null;
let mock;
console.log(`Levantando Prism ${PRISM} con ${modo}…`);
try {
  mock = await levantarMock(modo);
  resultados = [];
  for (const e of ESCENARIOS) resultados.push({ ...e, ...(await probar(e)) });
  if (comandoCliente) {
    console.log(`Corriendo el cliente: ${comandoCliente}`);
    cliente = correrCliente(comandoCliente);
  }
} catch (error) {
  errorMock = error.message;
} finally {
  mock?.terminar();
}
const veredicto = escribirResultado({ h, modo, resultados, cliente, errorMock });
console.log(`${veredicto}: ver RESULTADO.md`);
process.exitCode = veredicto === "PASA" ? 0 : 1;
