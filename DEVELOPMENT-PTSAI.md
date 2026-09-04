# Guía de desarrollo — PTS AI CRM (fork de Twenty)

Cómo trabajamos los features propios del CRM de PTS AI sobre este fork. Producción corre en
`https://app.crm.pts-automation.cloud` con una imagen construida desde la rama **`ptsai-emails`**.

## Reglas de oro

1. **`ptsai-emails` = lo que está en producción.** Nunca se commitea directo ahí: cada feature va
   en su propia rama (`ptsai-<nombre>`) y se integra cuando está probada.
2. **El despliegue a producción lo ejecuta solo Yeison** (el VPS comparte infra crítica con n8n).
   Ventana de despliegue: fuera de 10:00–19:00 ET.
3. **AGPL:** todo cambio que llegue a producción debe estar publicado en este fork (por eso es público).
4. **Nunca** hacer replace global de la palabra "Twenty" en el código (rompe identificadores como
   `chatGptTwentyAppUrl`). La marca blanca se parchea texto por texto dentro de strings.
5. Al hacer rebase sobre una versión nueva de Twenty, los conflictos esperables están en los
   archivos tocados por nuestros commits (emails, front white-label, inbox).

## Setup local (una sola vez)

Requisitos: Node 24+, `corepack enable` (yarn 4), Docker.

```bash
git clone https://github.com/gtm-ship-it/twenty.git twenty-fork
cd twenty-fork
git checkout ptsai-emails
corepack enable && yarn install     # ~5-10 min
```

## Ciclo de trabajo

```bash
git checkout -b ptsai-mi-feature ptsai-emails
# ... código ...
yarn nx run twenty-server:typecheck    # verificar server
yarn nx run twenty-front:typecheck     # verificar front
git commit && git push origin ptsai-mi-feature
```

## Probar en un CRM local desechable (sin tocar producción)

```bash
# 1. Compilar el front en el host (el Dockerfile lo reutiliza y el build es mucho más rápido)
NX_DAEMON=false NODE_OPTIONS="--max-old-space-size=8192" yarn nx build twenty-front

# 2. Construir la imagen local
docker build -f packages/twenty-docker/twenty/Dockerfile --target twenty -t twenty-ptsai:dev .

# 3. Levantar el entorno de prueba (compose de ejemplo: pedirle a Yeison el de inbox-test,
#    corre en el puerto 3100 con su propia base de datos)
```

## Cómo llega a producción (pipeline, lo ejecuta Yeison)

1. Merge del feature a `ptsai-emails` (fast-forward o merge tras revisión).
2. Regenerar el parche: `git format-patch -N --stdout HEAD > ptsai-emails.patch`
   (N = número de commits sobre el tag base `twenty/v2.34.0`; hoy son 6).
3. `scp` del parche al VPS → `UPSTREAM_TAG=twenty/v2.34.0 ./build-twenty-ptsai.sh <version>` →
   cambiar `TAG` y `docker compose up -d --force-recreate server worker` **fuera de ventana**.
4. Siempre queda una imagen anterior como rollback instantáneo.

## Mapa de lo nuestro (commits sobre v2.34.0)

| Área | Dónde |
|---|---|
| Plantillas y asuntos de correo con marca | `packages/twenty-emails/`, `twenty-server` (subjects) |
| Marca blanca del front | iconos, títulos, sign-in, links ocultos |
| **Inbox por usuario** | server: `engine/core-modules/messaging/` (resolver + services) · front: `modules/inbox/`, `pages/inbox/` |
| Create lead desde un correo | `modules/inbox/components/CreateLeadModal.tsx` |
| Only see (lista blanca visual) | resolver de messaging (user vars) + `useInboxOnlySee` |
| Privacidad por defecto | `SettingsAccountsMessageVisibilityCard` / `...CalendarVisibilitySettingsCard` |
