# HANDOFF — Migrar LIA a config desde la DB + play/pause

**Fecha:** 2026-08-05
**Origen:** sesión en `hubility-agents-sdk` (ver `memory-bank/sessions/2026-08-05_config-desde-db-y-play-pause.md` y el `HANDOFF.md` de ese repo).
**Estado previo ya completado:** SQL de `Agent.adminSystemPrompt` **aplicado** en la DB compartida; `main`/`dev` del SDK pusheados; publicados `@hubility/agents-amber@0.1.0-alpha.23` (tag latest) y `@hubility/provider-telegram@1.0.3` en GitHub Packages.
**Piloto completado:** Socorro (`BOTS/hubility/socorro-meta-sdk`) ya está migrado y funcionando en producción con esta misma receta. Su `HANDOFF-migracion-config-db.md` documenta 9 incidencias — resumidas abajo en «Aprendizajes del piloto Socorro», **leerlas antes de empezar**.

## Objetivo

Que LIA lea toda su configuración de la DB al arrancar (`loadAgentConfig()`), soporte play/pause en caliente (`createStatusGate()` via `messageGate`) y quede en la cadena de estado por `previous_response_id` (alpha.23). Los prompts pasan a la DB.

## Contexto de LIA (verificado hoy)

- Proyecto: `C:\Users\david\DESARROLLO\HUBILITY\DARCY\agente-LIA`, **npm** (package-lock.json), no pnpm.
- Deps actuales: `agents-amber@0.1.0-alpha.19`, `provider-telegram@1.0.2` — ambas **anticuadas**. alpha.19 es anterior a la migración a `previous_response_id` y a `loadAgentConfig`; telegram 1.0.2 **no tiene `messageGate`**.
- `src/app.ts`: instancia `AgentService` con `instructions: systemPrompt` y `admin.instructions: adminSystemPrompt` importados de `src/prompts/`, `model: 'gpt-5.4-mini'`, sin `messageGate`, puerto 3010.
- Tiene modo admin habilitado → necesita `Agent.adminSystemPrompt` en la DB (columna ya existe).

## Pasos

1. **Actualizar deps** en `package.json`:
   - `@hubility/agents-amber` → `0.1.0-alpha.23`
   - `@hubility/provider-telegram` → `1.0.3`
   - `npm install` (requiere `NPM_TOKEN` para GitHub Packages, revisa `.npmrc`).

2. **`app.ts` — config desde la DB**:
   - Primera línea del arranque: `const config = await loadAgentConfig()` (export de `@hubility/agents-amber`, top-level await; hidrata `process.env` antes de leer nada más — ojo: hoy `adapterProvider` y `liaApi` se crean a nivel de módulo leyendo `process.env`, hay que crearlos DESPUÉS de cargar la config).
   - Usar `config.instructions`, `config.adminInstructions`, `config.model`, `config.temperature`, `config.verbosity` en el `AgentService` en lugar de los imports de `src/prompts/` y el modelo hardcodeado.
   - Modo db es fail-fast al boot; `HUBILITY_CONFIG_SOURCE=env` es el switch de emergencia (comportamiento clásico sin DB).

3. **Play/pause**: pasar al provider
   `messageGate: composeGates(createStatusGate(), createWelcomeGate())`
   (exports de `@hubility/agents-amber`; verificar si LIA usa welcomeGate — si no, solo `createStatusGate()`). El gate lee `Agent.isActive` con microcaché 5 s, fail-open.

4. **Prompts a la DB**: copiar el contenido de `src/prompts/system-prompt-lia.ts` → `Agent.systemPrompt` y `system-prompt-lia-admin.ts` → `Agent.adminSystemPrompt` (la plataforma web aún NO edita adminSystemPrompt; hacerlo por SQL/Prisma Studio). Mantener los ficheros como backup versionado o borrarlos según decida David.

5. **Env → DB**: ejecutar `scripts/env-to-db.mjs` del repo del SDK con el `.env` de LIA (`node scripts/env-to-db.mjs --env <ruta> --agent <HUBILITY_AGENT_ID>`; soporta `--dry-run`, primero en dry-run). Las claves bootstrap (`DATABASE_URL`, `HUBILITY_AGENT_ID`, `HUBILITY_CONFIG_SOURCE`, `NPM_TOKEN`, `PORT`) se quedan en Railway; el resto va a `AgentEnvVariable`.

6. **⚠️ `temperature`**: el default de la columna es **0.7** y LIA venía usando 0.1 (comentado en app.ts). Fijar el valor deseado en `Agent.temperature` ANTES de arrancar con el loader, o LIA se vuelve creativa.

7. **Probar en real**:
   - Cadena `previous_response_id`: conversación multi-turno, incluidos contactos con `conv_...` heredado en `Contact.threadId` (arrancan de cero por diseño, sin error).
   - Mensajes concurrentes del mismo contacto (el fix de bifurcación de alpha.23).
   - Pause/play desde la plataforma (`Agent.isActive`): en pausa el mensaje muere antes del router; al reactivar, responde en ≤5 s de caché.
   - Modo admin con el prompt leído de la DB.

## Gotchas

- alpha.19 → alpha.23 salta la migración de Conversations a response-chaining: revisar el CHANGELOG/README de agents-amber si algo de la API de `AgentService` cambió (p. ej. opción nueva `verbosity` 1-3).
- `loadAgentConfig()` necesita `DATABASE_URL` + `HUBILITY_AGENT_ID` en el env de Railway y que exista la fila `Agent` correspondiente.
- No parchear bugs de terceros en el SDK: cualquier workaround va aquí, en el agente.

## Aprendizajes del piloto Socorro (2026-08-05) — LEER ANTES DE EMPEZAR

Socorro se migró primero y salió con 9 incidencias (detalle completo en
`socorro-meta-sdk/HANDOFF-migracion-config-db.md`). Las que aplican a LIA:

1. **Schema Prisma local**: `loadAgentConfig()` y el SDK usan el cliente
   `@prisma/client` DEL PROYECTO. Antes del primer boot en modo db, alinear en
   `prisma/schema.prisma` de LIA TODOS los modelos que el SDK toca:
   `Agent` (schema canónico, con welcome/adminSystemPrompt), `AgentEnvVariable`,
   `AgentEvent`, `AgentRule`, `Contact`, `HubMessage` — y `prisma generate`.
   En Socorro faltaban `Agent` canónico y `AgentRule` y dio un crash y un
   warning por mensaje respectivamente.

2. **¿A qué DB apunta la `DATABASE_URL` local?** En Socorro la local era la dev
   (Neon) y no producción (Supabase): hubo que aplicar los SQL de welcome y
   adminSystemPrompt en dev y repetir prompt+temperature+env-to-db contra
   producción antes del deploy. Verificarlo en LIA antes de escribir nada.

3. **Vars import-time del SDK — quedan en Railway sí o sí**: `agents-amber` lee
   en el import (antes de que la DB hidrate) `OPENAI_API_KEY` (crash al boot si
   falta), y `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_BUCKET` (sin crash,
   pero el cliente de storage queda null para siempre → media rota en
   silencio). Env final de Railway = bootstrap oficial + esas 4. Copiar la
   ANON_KEY con cuidado (en Socorro una key mal pegada dio «Invalid Compact
   JWS» al subir imagen).

4. **Comparar la fila `Agent` con el código ANTES de arrancar**: en Socorro la
   DB traía `model=gpt-5.2` y `temperature=0` mientras el código usaba
   gpt-5.1/0.1 — el switch a config-db habría cambiado de modelo en silencio.
   LIA hardcodea `gpt-5.4-mini` y temperature comentada: fijar la fila acorde.

5. **`temperature` y modelos GPT-5.x razonadores**: rechazan el parámetro con
   400 «Unsupported parameter». En Socorro bastó no pasar `temperature` en las
   opciones del AgentService. Con `gpt-5.4-mini` (LIA) probablemente igual:
   no pasar temperature salvo necesidad, y vigilar el fallback `?? 0.1` de
   `buildModelSettings` (si aparece el 400, el fix de fondo es del SDK).

6. **Gates**: el `messageGate` del provider corre dentro del func de `message`
   antes del emit. Si LIA tuviera algún guard propio estilo monkey-patch,
   convertirlo en gate y componer: `composeGates(createStatusGate(), otroGate)`
   (patrón aplicado en Socorro). Con welcome:
   `composeGates(createStatusGate(), createWelcomeGate())`.

7. **Node 20**: fijar `"engines": { "node": ">=20" }` en package.json — Railway
   tiraba de 18, deprecado por supabase-js.

Pendiente aún en Socorro (no bloquea LIA): probar llamada de voz y pause/play
desde la plataforma; fix de fondo en el SDK (clientes OpenAI/Supabase lazy,
temperature omitible). LIA no tiene voz, así que el punto de voice-worker no aplica.
