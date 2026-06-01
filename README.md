# Lia

Asistente virtual del consultorio odontológico del Dr. Darcy Furtado Mavignier Neto — atención y agendamiento por Telegram.

Built on the Hubility Agent SDK. Channel: **Telegram**. Voice: **No**.

## Setup

```bash
# 1. Configure the private registry token (GitHub Packages, read:packages scope)
#    Either export NPM_TOKEN in your shell or put it in .env (and source it).
cp .env.example .env
# 2. Fill .env: NPM_TOKEN, DATABASE_URL, HUBILITY_AGENT_ID, OPENAI_API_KEY,
#    EVENT_TOKEN, and the channel vars.

pnpm install
pnpm prisma:generate   # runs automatically via postinstall too
pnpm dev               # expect: "Lia running on port <PORT>"
```

Then send a real Telegram message to verify.



## Structure

```
src/
  app.ts                         # provider + pipes + AgentService
  prompts/system-prompt-lia.ts
prisma/schema.prisma             # shared Hubility schema (same DB for all agents)
```

## Adding tools

The agent starts with `tools: []`. To add a tool, create a factory that returns
`IBaseTool[]` and wire it in `app.ts`:

```ts
import { adaptTool } from '@hubility/agents-amber';
const tools = createBaseTools().map((t) => adaptTool(t, { provider: adapterProvider }));
// pass `tools` instead of [] to new AgentService(...)
```

See the `IBaseTool` shape in the skill's `references/sdk-api.md`.
