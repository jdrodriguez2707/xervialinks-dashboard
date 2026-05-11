# Despliegue en producción (Vercel + Railway)

Guía operativa para el monorepo **ad-manager-dashboard**: frontend estático en **Vercel**, API Node en **Railway**, SQLite con volumen opcional, y PWA instalable.

## Resumen de arquitectura

- **Vercel**: build de `frontend/` (Vite). Variables `VITE_*` se inyectan en **build time**.
- **Railway**: servicio Node ejecutando `backend/` (`npm start`). Variables en **runtime**.
- **CORS**: el backend solo acepta orígenes listados en `CORS_ORIGIN` cuando `NODE_ENV=production`.
- **PWA**: `vite-plugin-pwa` genera `manifest.webmanifest` y `sw.js` en `dist/`; no se cachean llamadas cross-origin al API.

## 1. Backend (Railway)

### Variables de entorno obligatorias en producción

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Cadena larga y aleatoria (el servidor **no arranca** si sigue siendo el placeholder por defecto). |
| `CORS_ORIGIN` | URL(s) del frontend, separadas por coma. Ej: `https://tu-app.vercel.app` |
| `PORT` | Railway lo define automáticamente; no hace falta tocarlo. |

### Recomendadas

| Variable | Descripción |
|----------|-------------|
| `DATABASE_PATH` | Ruta del SQLite, p. ej. `/data/app.db` montada en un **volume** persistente. |
| `GAM_CREDENTIALS_JSON` | JSON del service account en una sola línea (Railway Secret). |
| `USE_REAL_GAM_API` | `true` para datos reales de GAM. |
| `CRON_SECRET` | Activa `POST /api/internal/sync-reports` con cabecera `X-Cron-Secret: <valor>`. |
| `ENABLE_SYNC_SCHEDULER` | `false` para desactivar `setInterval` en el proceso y usar solo cron externo. |
| `SKIP_STARTUP_SYNC` | `true` para no ejecutar sync al arrancar (solo si todo lo hace cron). |
| `REPORTS_BACKFILL_WINDOW_DAYS` | Días de historial que pide el backfill a GAM en una sola corrida (por defecto en código: **120**). Sube p. ej. a `370` si necesitas ~12 meses y la API lo acepta. |

Ver [backend/.env.example](../backend/.env.example) para el listado completo.

### `GAM_CREDENTIALS_JSON` en una sola línea

No compartas el JSON de la cuenta de servicio en chats, tickets ni commits: incluye la clave privada. Genera el valor **solo en tu entorno** y pégalo en Railway como variable secreta.

Desde el directorio `backend/` (ajusta la ruta si tu clave está en otro sitio):

```bash
cd backend && jq -c . credentials/gam-service-account.json
```

La salida es **una sola línea** válida para `JSON.parse` en el backend ([`backend/src/infrastructure/integrations/gamClient.js`](../backend/src/infrastructure/integrations/gamClient.js)). Cópiala entera en `GAM_CREDENTIALS_JSON`.

Si no tienes `jq`:

```bash
cd backend && node -e "const fs=require('fs');console.log(JSON.stringify(JSON.parse(fs.readFileSync('credentials/gam-service-account.json','utf8'))))"
```

Tras pegar en Railway, haz **Redeploy**. Si el JSON quedó truncado o con comillas rotas al pegar, fallará `JSON.parse` al usar GAM; vuelve a generar y pegar la línea completa.

### Persistencia SQLite

El disco del contenedor en Railway es **efímero**. Sin volumen, cada redeploy borra la base.

1. En el servicio → **Volumes** → montar p. ej. `/data`.
2. Definir `DATABASE_PATH=/data/app.db`.

### Health check

Configurar el health check HTTP contra `GET /api/health`.

### Cron (sync de reportes)

- Con `ENABLE_SYNC_SCHEDULER=true` (por defecto), el proceso ejecuta sync al arrancar y cada 3h / backfill diario.
- Con `ENABLE_SYNC_SCHEDULER=false`, usar **Railway Cron** (u otro) llamando:

```bash
curl -X POST "https://<tu-api>/api/internal/sync-reports" \
  -H "X-Cron-Secret: <CRON_SECRET>"
```

`CRON_SECRET` debe estar definido; si está vacío, el endpoint responde **404** (oculto).

### Redeploy Railway

- Push a la rama conectada, o **Redeploy** manual en el dashboard.
- Tras cambiar variables de entorno, hace falta **Redeploy** para que el proceso las lea.

## 2. Frontend (Vercel)

### Variable de build

| Variable | Descripción |
|----------|-------------|
| `VITE_API_BASE_URL` | URL del backend **sin** barra final. Debe incluir el esquema: `https://xxx.up.railway.app`. Si solo pegas el host sin `https://`, el navegador trata la URL como ruta relativa en Vercel y verás **405** en `/api/...`. El cliente antepone `https://` si falta (tras redeploy del frontend). |

Si está vacía, en local el proxy de Vite sigue sirviendo `/api` contra `localhost:3001`.

### Configuración del proyecto

- **Root directory**: `frontend`
- **Build command**: `npm run build` (ejecuta `prebuild` que genera iconos PWA).
- **Output**: `dist`

### PWA e instalación

Tras el deploy, en Chrome: **Instalar aplicación** / Lighthouse (categoría PWA). Tras un nuevo deploy, el service worker se actualiza con `registerType: "autoUpdate"`; puede bastar con recargar la página.

### Redeploy Vercel

- Push a producción o **Redeploy** en el dashboard.
- Si solo cambia el backend, no es necesario redeploy del frontend salvo que cambie la URL del API.

## 3. Seguridad (checklist)

- [ ] `JWT_SECRET` único y fuerte por entorno.
- [ ] `CORS_ORIGIN` acotado al dominio real del frontend.
- [ ] Credenciales GAM solo en secrets (nunca en el repo).
- [ ] Rate limit en `POST /api/auth/login` (activo en todos los entornos; límites más altos en desarrollo).
- [ ] `helmet` y límite de tamaño del body JSON en la API.

## 4. Rotación de secretos

- **JWT**: al cambiar `JWT_SECRET`, todos los tokens vigentes quedan inválidos; los usuarios deben iniciar sesión de nuevo.
- **CRON_SECRET**: rotar en Railway y actualizar el job de cron el mismo día.
