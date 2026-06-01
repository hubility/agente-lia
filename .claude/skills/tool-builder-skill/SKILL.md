---
name: tool-builder
description: Build new IBaseTool implementations for @hubility/agents-amber from scratch. Use when creating business tools that integrate with external APIs, CRMs, ERPs, databases, or any custom functionality that a Hubility conversational agent needs. Trigger when asked to create a tool, add a capability, integrate an API, connect to a service, or build a new function for a WhatsApp/Telegram agent.
---

# Tool Builder Skill

This skill teaches how to create new tools for the Hubility SDK from scratch. Tools follow the `IBaseTool` contract from `@hubility/agents-amber` and are consumed by the conversational agent via `adaptTool()`.

## The IBaseTool Contract

Every tool must satisfy this interface:

```typescript
interface IBaseTool<T = any> {
  name: string           // camelCase, unique within the agent
  description: string    // what the tool does (the LLM reads this to decide when to use it)
  schema: ZodObject<T>   // Zod schema defining the tool's input parameters
  execute: (args: T, context: ToolContext) => Promise<string>
}
```

The `execute` function always returns a JSON string. The LLM reads this return value to formulate its response to the user.

## ToolContext

The `context` object is injected at runtime by `AgentService`. It provides:

```typescript
interface ToolContext {
  phoneNumber: string   // user's phone (e.g. "5511999999999")
  name?: string         // user's WhatsApp/Telegram display name
  threadId: string      // conversation thread ID (for session continuity)
  contactId: string     // internal contact identifier
  apiKey?: string       // optional API key (from env)
  provider: any         // the messaging provider instance (sendText, sendFile, sendImage, etc.)
}
```

Use `provider` when the tool needs to send media, files, or interactive messages directly. For tools that only return data, just return the JSON string and let the agent compose the reply.

## File Structure

Place each tool in its own file:

```
src/tools/
  ToolName.ts           // one tool per file
  AnotherTool.ts
  index.ts              // barrel export
```

## Creating a Tool — Step by Step

### 1. Define the Zod Schema

The schema describes what parameters the LLM will provide when calling the tool. Write descriptions — the LLM uses them to understand what to pass.

```typescript
import { z } from 'zod'

const GetBalanceSchema = z.object({
  customerId: z.string().describe('The customer ID to look up in the ERP system'),
  currency: z.enum(['BRL', 'USD', 'EUR']).optional().describe('Currency for the balance. Defaults to BRL.'),
})
```

Guidelines:
- Use `.describe()` on every field — the LLM needs this to fill parameters correctly
- Use `.optional()` with sensible defaults when the user might not specify a value
- Use `z.enum()` for constrained choices
- Keep schemas flat when possible — nested objects make it harder for the LLM to fill correctly
- Use `z.object({})` for tools that take no parameters

### 2. Write the Factory Function

Export a factory function, not the tool directly. This allows injecting configuration at setup time.

```typescript
import { z } from 'zod'
import type { IBaseTool } from '@hubility/agents-amber'

const GetBalanceSchema = z.object({
  customerId: z.string().describe('The customer ID in the ERP system'),
})

export interface GetBalanceConfig {
  apiUrl: string
  apiToken: string
}

export function createGetBalanceTool(config: GetBalanceConfig): IBaseTool<z.infer<typeof GetBalanceSchema>> {
  return {
    name: 'getBalance',
    description: 'Look up the current balance of a customer in the ERP system. Use when the user asks about their balance, account status, or how much they owe.',
    schema: GetBalanceSchema,
    async execute(args, context) {
      const response = await fetch(`${config.apiUrl}/customers/${args.customerId}/balance`, {
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        return JSON.stringify({
          error: `Failed to retrieve balance: ${response.status} ${response.statusText}`,
        })
      }

      const data = await response.json()

      return JSON.stringify({
        customerId: args.customerId,
        balance: data.balance,
        currency: data.currency,
        lastUpdated: data.updatedAt,
      })
    },
  }
}
```

### 3. Register the Tool

In the project's bot setup file, instantiate and register:

```typescript
import { AgentService } from '@hubility/agents-amber'
import { createGetBalanceTool } from './tools/GetBalance'

const tools = [
  createGetBalanceTool({
    apiUrl: process.env.ERP_API_URL!,
    apiToken: process.env.ERP_API_TOKEN!,
  }),
  // ... other tools
]

const agentService = new AgentService({
  tools,
  provider,
  instructions: '...',
  model: 'gpt-4.1',
  name: 'AgentName',
})
```

### 4. Export from Barrel

Add the tool to `src/tools/index.ts`:

```typescript
export { createGetBalanceTool } from './GetBalance'
export type { GetBalanceConfig } from './GetBalance'
```

## Patterns by Use Case

### API Integration Tool (GET data)

For tools that fetch data from external APIs. Return the data as JSON — the agent will format the response for the user.

```typescript
async execute(args, context) {
  try {
    const res = await fetch(`${config.apiUrl}/endpoint/${args.id}`, {
      headers: { 'Authorization': `Bearer ${config.apiToken}` },
    })
    if (!res.ok) {
      return JSON.stringify({ error: `API returned ${res.status}` })
    }
    const data = await res.json()
    return JSON.stringify(data)
  } catch (err: any) {
    return JSON.stringify({ error: err.message })
  }
}
```

### API Integration Tool (POST/mutation)

For tools that create, update, or delete resources. Confirm the action in the return value.

```typescript
async execute(args, context) {
  try {
    const res = await fetch(`${config.apiUrl}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product: args.product, quantity: args.quantity }),
    })
    if (!res.ok) {
      return JSON.stringify({ error: `Failed to create order: ${res.status}` })
    }
    const data = await res.json()
    return JSON.stringify({ status: 'created', orderId: data.id })
  } catch (err: any) {
    return JSON.stringify({ error: err.message })
  }
}
```

### Media Sending Tool

For tools that send files, images, or documents directly to the user via the provider. Use `context.provider`.

```typescript
async execute(args, context) {
  const { provider, phoneNumber } = context
  try {
    const recipientPhone = phoneNumber.includes('@')
      ? phoneNumber
      : `${phoneNumber}@s.whatsapp.net`

    await provider.sendFile(recipientPhone, filePath, 'Document caption')

    return JSON.stringify({ status: 'File sent successfully' })
  } catch (err: any) {
    return JSON.stringify({ error: `Failed to send file: ${err.message}` })
  }
}
```

### Database Query Tool

For tools that query a database directly (Prisma, Supabase, etc.).

```typescript
export function createLookupClientTool(prisma: PrismaClient): IBaseTool<z.infer<typeof LookupClientSchema>> {
  return {
    name: 'lookupClient',
    description: 'Search for a client by name or document number.',
    schema: LookupClientSchema,
    async execute(args, context) {
      const client = await prisma.client.findFirst({
        where: {
          OR: [
            { name: { contains: args.query, mode: 'insensitive' } },
            { document: args.query },
          ],
        },
      })
      if (!client) {
        return JSON.stringify({ error: 'Client not found' })
      }
      return JSON.stringify(client)
    },
  }
}
```

## Parameter Source Analysis

Before writing the Zod schema, classify every parameter the API endpoint needs:

| Source | Where It Comes From | Put in Schema? | Example |
|--------|---------------------|----------------|---------|
| **System** | `ToolContext` — injected automatically at runtime | **No** — read from `context` inside `execute()` | `phoneNumber`, `threadId`, `contactId`, `name` |
| **User** | LLM extracts from conversation with the user | **Yes** — add to Zod schema with `.describe()` | `email`, `firstName`, `address`, `searchQuery` |
| **Prior tool** | LLM gets from a previous tool call's return value | **Yes** — add to schema, describe where it comes from | `webinar_id` (from `list_sessions` result) |
| **Config** | Factory config — set once at startup | **No** — injected via factory function | `apiUrl`, `apiToken` |

### How to Apply

1. Read the API endpoint's parameters (from OpenAPI spec or `docs/`)
2. For each parameter, ask: **"Who provides this value?"**
3. If the system already has it (ToolContext) → use `context.phoneNumber` in execute, do NOT add to schema
4. If the user must provide it → add to Zod schema with clear `.describe()`
5. If another tool provides it → add to schema, describe the source in `.describe()` so the LLM knows

### Example: Registration Tool

API endpoint `POST /webinar-registration` needs: `webinar_id`, `email`, `first_name`, `last_name`, `title`, `documentation`, `address`

| Parameter | Source | Reasoning |
|-----------|--------|-----------|
| `webinar_id` | **Prior tool** — returned by `list_sessions` | LLM picks from session list |
| `email` | **User** — must ask | Not in ToolContext |
| `first_name` | **User** — must ask | `context.name` exists but is display name, not first/last |
| `last_name` | **User** — must ask | Not in ToolContext |
| `title` | **User** — must ask | Professional title (Dr., etc.) |
| `documentation` | **User** — must ask | ID document number |
| `address` | **User** — must ask | Not in ToolContext |

All 7 go in the Zod schema because none come from ToolContext directly.

### Example: Phone Validation Tool

API endpoint `GET /phone-numbers/{number}` needs: `phone_number`

| Parameter | Source | Reasoning |
|-----------|--------|-----------|
| `phone_number` | **System** — `context.phoneNumber` | Already available! |

The schema is `z.object({})` — empty. The phone number is read from context inside execute:

```typescript
async execute(args, context) {
  const phone = context.phoneNumber
  const result = await client.checkPhone(phone)
  return JSON.stringify(result)
}
```

**Common mistake:** putting `phone_number` in the schema forces the LLM to ask the user for their phone number, which they already provided by messaging the agent.

## Critical Rules

1. **Always return JSON strings** — `JSON.stringify()` on both success and error paths. Never throw from execute.

2. **Never throw from execute** — catch all errors and return them as JSON with an `error` field. The agent needs to read the error to tell the user what happened.

3. **Write clear descriptions** — the `description` field is what the LLM reads to decide when to invoke the tool. Include when to use it and what it returns. Bad: "Gets balance". Good: "Look up the current balance of a customer in the ERP system. Use when the user asks about their balance, account status, or how much they owe."

4. **Keep tools focused** — one tool, one responsibility. If a tool does multiple things, split it. The LLM is better at choosing between specific tools than navigating a multi-purpose one.

5. **Use factory functions with config** — inject API URLs, tokens, and database clients via config. Never hardcode credentials. Never read process.env inside execute — read it once in the factory.

6. **Test the tool manually** before registering — call the factory, call execute with mock args and context, verify the JSON output is what you expect.

7. **Phone number formatting for WhatsApp** — when using provider methods, check if the number needs `@s.whatsapp.net` suffix. Provider-meta handles this internally for most methods, but if sending raw, format it.

## EventEmitter (mandatory)

For observability, use the EventEmitter from agents-amber to log tool executions:

```typescript
import { EventEmitter } from '@hubility/agents-amber'

const eventEmitter = new EventEmitter(process.env.HUBILITY_AGENT_ID || '')
const startTime = Date.now()

try {
  // ... tool logic ...
  await eventEmitter.success('tool', toolName, 'Success message', {
    duration: Date.now() - startTime,
    payload: { relevant: 'data' },
  })
  return JSON.stringify({ status: 'ok' })
} catch (err: any) {
  await eventEmitter.error('tool', toolName, err.message, {
    duration: Date.now() - startTime,
    details: err.message,
  })
  return JSON.stringify({ error: err.message })
}
```

EventEmitter is mandatory.
