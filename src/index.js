const express = require('express');
const os = require('os');
const { version, mensaje, deploy } = require('./version');

const app = express();
const port = process.env.PORT || 3000;
const TIMEOUT_MS = 3000;

// Evita que una conexión "colgada" bloquee la respuesta HTTP.
function conTimeout(promesa, ms, etiqueta) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(() => reject(new Error(`${etiqueta}: tiempo agotado`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

function faltantes(variables) {
  return variables.filter((v) => !process.env[v]);
}

// ---------- Pruebas de conexión a las bases de datos ----------

async function probarMysql() {
  const faltan = faltantes(['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']);
  if (faltan.length) return { servicio: 'mysql', estado: 'no configurado', faltan };

  const mysql = require('mysql2/promise');
  let conexion;
  try {
    conexion = await conTimeout(
      mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        connectTimeout: TIMEOUT_MS,
      }),
      TIMEOUT_MS + 500,
      'mysql'
    );
    const [filas] = await conexion.query('SELECT VERSION() AS version, NOW() AS ahora');
    return { servicio: 'mysql', estado: 'conectado', version: filas[0].version, ahora: filas[0].ahora };
  } catch (err) {
    return { servicio: 'mysql', estado: 'error', detalle: err.code || err.message };
  } finally {
    if (conexion) await conexion.end().catch(() => {});
  }
}

async function probarPostgres() {
  const faltan = faltantes(['PG_HOST', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD']);
  if (faltan.length) return { servicio: 'postgres', estado: 'no configurado', faltan };

  const { Client } = require('pg');
  const cliente = new Client({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    database: process.env.PG_DATABASE,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    connectionTimeoutMillis: TIMEOUT_MS,
  });
  cliente.on('error', () => {});
  try {
    await conTimeout(cliente.connect(), TIMEOUT_MS + 500, 'postgres');
    const resultado = await cliente.query('SELECT version() AS version, NOW() AS ahora');
    return {
      servicio: 'postgres',
      estado: 'conectado',
      version: resultado.rows[0].version.split(' ').slice(0, 2).join(' '),
      ahora: resultado.rows[0].ahora,
    };
  } catch (err) {
    return { servicio: 'postgres', estado: 'error', detalle: err.code || err.message };
  } finally {
    await cliente.end().catch(() => {});
  }
}

async function probarRedis() {
  const faltan = faltantes(['REDIS_HOST']);
  if (faltan.length) return { servicio: 'redis', estado: 'no configurado', faltan };

  const { createClient } = require('redis');
  const cliente = createClient({
    socket: {
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      connectTimeout: TIMEOUT_MS,
      reconnectStrategy: false,
    },
    password: process.env.REDIS_PASSWORD || undefined,
  });
  cliente.on('error', () => {});
  try {
    await conTimeout(cliente.connect(), TIMEOUT_MS + 500, 'redis');
    const visitas = await cliente.incr('visitas'); // contador guardado en Redis
    return { servicio: 'redis', estado: 'conectado', visitas_a_esta_ruta: visitas };
  } catch (err) {
    return { servicio: 'redis', estado: 'error', detalle: err.code || err.message };
  } finally {
    await cliente.quit().catch(() => {});
  }
}

function responder(res, resultado) {
  res.status(resultado.estado === 'conectado' ? 200 : 503).json(resultado);
}

// ---------- Rutas ----------

app.get('/', (req, res) => {
  res.json({
    mensaje,
    version,
    deploy,
    institucion: 'Universidad del Quindío',
    programa: 'Ingeniería de Sistemas y Computación',
    curso: 'Administración de Infraestructura de TI',
    plataforma: 'Dokploy PaaS',
    app_name: process.env.APP_NAME || 'sin-definir',
    fecha: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    estado: 'saludable',
    uptime: process.uptime(),
    version,
    node: process.version,
    plataforma: 'Dokploy',
  });
});

app.get('/info', (req, res) => {
  res.json({
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    memory: {
      total: Math.round(os.totalmem() / 1024 / 1024) + ' MB',
      free: Math.round(os.freemem() / 1024 / 1024) + ' MB',
    },
  });
});

app.get('/db/mysql', async (req, res) => responder(res, await probarMysql()));
app.get('/db/postgres', async (req, res) => responder(res, await probarPostgres()));
app.get('/db/redis', async (req, res) => responder(res, await probarRedis()));

app.get('/db', async (req, res) => {
  const resultados = await Promise.all([probarMysql(), probarPostgres(), probarRedis()]);
  const todasOk = resultados.every((r) => r.estado === 'conectado');
  res.status(todasOk ? 200 : 503).json({ todas_conectadas: todasOk, servicios: resultados });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${port} (v${version})`);
  console.log('Plataforma: Dokploy PaaS');
});
