# dokploy-practica

Aplicación de prueba para la práctica **Administración de Contenedores con Dokploy**
(Universidad del Quindío - Ingeniería de Sistemas y Computación - Administración de Infraestructura de TI).

## Contenido

| Archivo | Para qué sirve |
|---|---|
| `src/index.js` | API Express (rutas `/`, `/health`, `/info`, `/db`, `/db/mysql`, `/db/postgres`, `/db/redis`) |
| `src/version.js` | Versión y mensaje de la app (se edita en la Fase 7 para probar el despliegue continuo) |
| `package.json` / `package-lock.json` | Dependencias de Node.js |
| `Dockerfile` | Alternativa a Nixpacks para construir la imagen |
| `docker-compose.yml` | Aplicación multi-servicio de la Fase 5 (app + MongoDB + MySQL + phpMyAdmin) |
| `minio/docker-compose.yml` | MinIO (S3 local) usado como destino de respaldos |
| `.env.example` | Plantilla de variables de entorno (las reales se cargan en Dokploy) |

## Variables de entorno

Ver `.env.example`. En Dokploy se configuran en la pestaña **Environment** de la aplicación.

## Ejecución local (opcional)

```bash
npm install
npm start
# http://localhost:3000/health
```

## Rutas

- `GET /` mensaje de bienvenida con la versión actual
- `GET /health` estado de salud
- `GET /info` información del entorno de ejecución
- `GET /db` prueba de conexión a MySQL, PostgreSQL y Redis
