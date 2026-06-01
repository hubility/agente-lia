---
name: api-integration
description: Integrate an external API into the amber agent. Use when reading an OpenAPI spec from docs/, creating an API client service, or building tools that call external endpoints. Trigger when asked to connect to a service, consume a REST API, or implement an integration described in specs/.
---

# API Integration

This skill teaches how to go from an OpenAPI spec (or API documentation) in `docs/` to a working service + tools in the amber agent.

## Pipeline

```
docs/{service}/openapi.json  →  src/services/{Service}Client.ts  →  src/tools/{ToolName}.ts  →  register in app-amber.ts
```

## Step 1 — Read the OpenAPI Spec

Before writing any code, extract these from the spec for each endpoint you need:

| Field | Where in OpenAPI | Example |
|-------|-----------------|---------|
| Base URL | `servers[0].url` | `https://api.volonia.com/v1` |
| Path | `paths` key | `/meetings` |
| Method | HTTP verb under path | `GET` |
| Parameters | `parameters` (query/path) | `search: string` |
| Request body | `requestBody.content.application/json.schema` | `{ email, name }` |
| Response schema | `responses.200.content.application/json.schema` | `{ id, title, date }` |
| Auth | `securityDefinitions` / `security` | Basic auth, Bearer token |
| Error responses | `responses.4xx/5xx` | `{ error: string }` |

If the spec is large, focus only on the endpoints listed in the requirements pack (`specs/{case}/requirements_pack_*.json` → `integrations` section).

## Step 2 — Create the Service Client

One service class per external API. Place in `src/services/`.

```typescript
// src/services/VoloniaClient.ts

export interface VoloniaConfig {
  baseUrl: string
  username: string
  password: string
}

export class VoloniaClient {
  private authHeader: string

  constructor(private config: VoloniaConfig) {
    this.authHeader = 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${method} ${path} failed: ${res.status} ${text}`)
    }

    return res.json() as Promise<T>
  }

  async getMeetings() {
    return this.request<Meeting[]>('GET', '/meetings')
  }

  async searchDocuments(query: string) {
    return this.request<Document[]>('GET', `/documents?search=${encodeURIComponent(query)}`)
  }
}
```

Rules:
- **One class per external service** — don't mix Volonia + Stripe in one client.
- **Auth in constructor** — compute headers once, reuse.
- **Generic `request()` method** — handles auth, content-type, error checking.
- **Type the responses** — define interfaces for API responses, even minimal ones.
- **Encode query parameters** — always `encodeURIComponent()` for user-provided values.
- **Throw on errors** — the tool's `execute()` will catch and return JSON.

### Auth Patterns

| Auth Type | Implementation |
|-----------|---------------|
| Basic auth | `'Basic ' + Buffer.from(user:pass).toString('base64')` |
| Bearer token | `'Bearer ' + token` |
| API key (header) | `'X-Api-Key': apiKey` |
| API key (query) | Append `?api_key=` to URL |
| OAuth2 | Separate token refresh service — ask for guidance |

## Step 3 — Create Tools That Use the Service

Inject the service instance via the tool's factory config.

```typescript
// src/tools/ListMeetings.ts
import { z } from 'zod'
import type { IBaseTool } from '@hubility/agents-amber'
import type { VoloniaClient } from '../services/VoloniaClient.js'

const ListMeetingsSchema = z.object({})

export function createListMeetingsTool(client: VoloniaClient): IBaseTool<z.infer<typeof ListMeetingsSchema>> {
  return {
    name: 'list_meetings',
    description: 'List available medical sessions. Use when the user asks about upcoming sessions, events, or webinars.',
    schema: ListMeetingsSchema,
    async execute(args, context) {
      try {
        const meetings = await client.getMeetings()
        return JSON.stringify({ meetings })
      } catch (err: any) {
        return JSON.stringify({ error: err.message })
      }
    },
  }
}
```

Rules:
- **Inject the service, not raw config** — the tool doesn't know about API URLs or tokens.
- **One tool per user-facing action** — `list_meetings` and `register_meeting` are separate tools.
- **Map API response to what the LLM needs** — strip internal IDs, timestamps, or fields the user doesn't care about if they add noise.

## Step 4 — Register Everything

In `src/app-amber.ts`:

```typescript
import { VoloniaClient } from './services/VoloniaClient.js'
import { createListMeetingsTool } from './tools/ListMeetings.js'

const volonia = new VoloniaClient({
  baseUrl: process.env.VOLONIA_API_URL!,
  username: process.env.VOLONIA_API_USER!,
  password: process.env.VOLONIA_API_PASS!,
})

const tools = [
  adaptTool(createListMeetingsTool(volonia)),
  // ... other tools
]
```

## Step 5 — Document Env Vars

Add any new environment variables to:
1. The `.env.example` or env vars section in AGENTS.md
2. Report them to the requester — they need to set them in Railway

## Checklist

Before considering an API integration done:

- [ ] OpenAPI spec read and relevant endpoints identified
- [ ] Service client created in `src/services/` with typed responses
- [ ] Auth handled in constructor, not repeated per method
- [ ] One tool per user-facing action, using the service client
- [ ] All tools follow IBaseTool rules (JSON.stringify, no throws, .describe())
- [ ] Tools registered in `src/app-amber.ts` with `adaptTool()`
- [ ] Barrel export updated in `src/tools/index.ts`
- [ ] New env vars documented and reported to requester
- [ ] `npx tsc --noEmit` passes
