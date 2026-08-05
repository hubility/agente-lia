# Session: Migración de LIA a config desde la DB + play/pause
Date: 2026-08-05
Project: agente-LIA

## Goal
Ejecutar el HANDOFF-migracion-config-db.md: que LIA lea toda su configuración de la DB al arrancar (`loadAgentConfig()`), soporte pause/play en caliente (`createStatusGate()`) y entre en la cadena de estado por `previous_response_id` (agents-amber alpha.23).

## Decisions
- `temperature` omitida a propósito en el `AgentService` (aprendizaje nº 5 de Socorro: los GPT-5.x razonadores la rechazan con 400 «Unsupported parameter»). La fila `Agent` queda con 0.1 solo como registro.
- Sin welcome gate: `Agent.welcomeMessage` es null en la fila de Lia, solo `messageGate: createStatusGate()`.
- Los ficheros de prompts en `src/prompts/` se mantienen como fallback versionado (`config.instructions ?? systemPrompt`), patrón idéntico a Socorro.
- Schema Prisma alineado con el canónico de la plataforma pero **conservando `Contact.isAdmin`** (Socorro no lo tiene; LIA lo necesita para el modo admin).
- `engines.node` acabó en `>=22` (no `>=20` como decía el handoff): ver Learnings.

## Work Done
- Deps: `@hubility/agents-amber` 0.1.0-alpha.19 → 0.1.0-alpha.23, `@hubility/provider-telegram` 1.0.2 → 1.0.3.
- `prisma/schema.prisma`: Agent canónico (model/temperature/verbosity/systemPrompt/adminSystemPrompt/welcome*/isActive), `AgentEnvVariable` nuevo, `AgentRule` con relación a Agent.
- `src/app.ts`: `import 'dotenv/config'` + `await loadAgentConfig()` como primera línea (provider y `LiaApiClient` se crean después de hidratar el env); `config.instructions/adminInstructions/model/verbosity` en el AgentService; `messageGate: createStatusGate()`; log del `config.source` al arrancar.
- DB producción (Supabase): fila `Agent cmpupul530003qc1d7058f2rf` corregida — traía `model=gpt-5.2`, `temperature=0` y systemPrompt placeholder de 4 chars (gotcha nº 4 del piloto, clavado). Subidos systemPrompt (15.427 chars) y adminSystemPrompt (4.488 chars) evaluando los módulos TS con tsx; `model=gpt-5.4-mini`, `temperature=0.1`.
- `env-to-db.mjs` del SDK (dry-run y real): 9 claves en `AgentEnvVariable` (DIRECT_URL, OPENAI_API_KEY, EVENT_TOKEN, TELEGRAM_*, TZ, LIA_API_URL, LIA_API_KEY, VOICE_ID); bootstrap fuera (DATABASE_URL, HUBILITY_AGENT_ID, NPM_TOKEN, PORT).
- Verificado: typecheck y build limpios, boot local en modo db OK (`config source: db`, Connected Provider).
- Merge a `main` y deploy: commits `2972b7a` (migración) y `48c98da` (fix Node 22).
- Probado en real por David: conversación nueva tras borrar `threadId`, funcionando.

## Learnings
- **Node 22 obligatorio, no 20**: en Railway (Node 20.20.2) el cliente Supabase que agents-amber crea en el import crashea al boot — `@supabase/realtime-js` exige WebSocket nativo, estable desde Node 22. En local no se vio (Node 24). Fix: `engines: >=22`. Aplica a futuros agentes migrados (Socorro quedó con >=20: revisar).
- El crash de Supabase confirmó que Railway SÍ tiene `SUPABASE_URL`/`SUPABASE_ANON_KEY` (el `.env` local de LIA no las tiene) — no borrarlas al limpiar el env de Railway.
- **Cold start de Neon en lia-web**: un error «Can't reach database server at ep-orange-cell...neon.tech» en la tool `get_patient_context` NO es del agente — la tool llama por HTTP a lia-web y ese Prisma error (`prisma.apiKey.findUnique`, validación del x-api-key) es del backend de lia-web contra su Neon. Causa: autosuspend de Neon + `connect_timeout` por defecto de Prisma (5 s) menor que el wake. Fix aplicado por David: `connect_timeout` en la `DATABASE_URL` de lia-web.
- El script `env-to-db.mjs` usa args posicionales (`<agentId> <ruta.env> [--dry-run]`), no `--env/--agent` como decía el handoff.
- Al ejecutar scripts one-off que importan módulos del proyecto, colocarlos dentro del repo (resolución ESM de node_modules), no en un temp externo.

## Key Files
src/app.ts
prisma/schema.prisma
package.json
HANDOFF-migracion-config-db.md
