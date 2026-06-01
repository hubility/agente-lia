---
name: testing
description: Verify that tools, services, and system prompts work correctly before committing. Use when you've created or modified a tool, service client, or system prompt and need to validate it before pushing.
---

# Testing

This skill defines how to verify tools, services, and system prompts work correctly. There is no test framework — validation is manual and type-based.

## Type Checking (Always First)

Before any other validation, run:

```bash
npx tsc --noEmit
```

This catches:
- Missing imports
- Wrong parameter types
- Interface mismatches (IBaseTool contract)
- Zod schema type inference issues

**Every change must pass `tsc` before committing.** Do not commit code that fails type checking.

## Tool Verification

### 1. Contract Check

Verify the tool satisfies IBaseTool:

| Requirement | How to Check |
|-------------|-------------|
| `name` is camelCase string | Visual inspection |
| `description` explains when to use | Read it — would the LLM know when to call this? |
| `schema` is a ZodObject | `tsc` catches this |
| Every schema field has `.describe()` | Grep: fields without `.describe()` are bugs |
| `execute` returns `Promise<string>` | `tsc` catches this |
| Return is always `JSON.stringify()` | Check both success AND error paths |
| `execute` never throws | Check: is every async call in try/catch? |

### 2. JSON Output Check

Read the `execute()` function and trace every return path:

```
Success path → JSON.stringify({ ...data }) ✓
Error path   → JSON.stringify({ error: message }) ✓
Unhandled    → thrown exception reaches caller ✗ BUG
```

Every `await` call that can fail must be inside a try/catch. Common misses:
- `fetch()` without try/catch (network errors)
- `.json()` without try/catch (malformed response)
- Property access on potentially undefined response data

### 3. Schema Completeness

Check every field in the Zod schema:

```typescript
// GOOD: every field has .describe()
z.object({
  query: z.string().describe('Search term to find documents'),
  limit: z.number().optional().describe('Max results to return. Defaults to 10.'),
})

// BAD: missing .describe() — LLM won't know what to pass
z.object({
  query: z.string(),
  limit: z.number().optional(),
})
```

### 4. Description Quality

The `description` field is what the LLM reads to decide whether to call the tool. Test by asking yourself:

> "If I were the LLM and the user said X, would this description make me choose this tool?"

| Quality | Example |
|---------|---------|
| Bad | `"Gets documents"` |
| OK | `"Search for documents by keyword"` |
| Good | `"Search medical documents by keyword. Use when the user asks for clinical cases, protocols, guides, or any document from the archive. Returns document names and download URLs."` |

## Service Client Verification

### 1. Auth Configuration

Verify auth is set up correctly in the constructor:

| Auth Type | Verify |
|-----------|--------|
| Basic | `Buffer.from(user:pass).toString('base64')` is computed once |
| Bearer | Token is stored, not re-fetched per request |
| API Key | Header name matches API docs exactly |

### 2. URL Construction

Check that:
- Base URL does NOT end with `/` (or paths don't start with `/` — pick one convention)
- Query parameters use `encodeURIComponent()` for user-provided values
- Path parameters are interpolated correctly

### 3. Error Handling

The service should throw on errors so the tool can catch and return JSON:

```typescript
// GOOD: throws with context
if (!res.ok) {
  const text = await res.text().catch(() => '')
  throw new Error(`GET /documents failed: ${res.status} ${text}`)
}

// BAD: returns undefined silently
if (!res.ok) return undefined
```

## System Prompt Verification

### 1. Structure Check

Verify these sections exist (in order):

- [ ] Identity (name, tone, language, channel)
- [ ] Capabilities (numbered use cases with step-by-step flows)
- [ ] Tools (name, params, return value for each)
- [ ] Hard limits (NUNCA/NEVER items)
- [ ] Routing (if 2+ use cases)

### 2. Tool Sync

Cross-reference the system prompt's tool list against actual tools registered in `src/app-amber.ts`:

- Every registered tool should be mentioned in the prompt
- Tool names in the prompt must match the `name` field exactly
- Parameter names should match the Zod schema field names

### 3. Flow Completeness

For each flow in the system prompt, trace the path:

```
User intent → tool call → data collection → confirmation → action → response
```

Check:
- Is every tool call in the flow actually available?
- Does the flow handle the error case (tool returns `{ error }`)?
- Is there a confirmation step before mutations?

## Pre-Commit Checklist

Run through this before every commit:

```
1. npx tsc --noEmit                     → MUST pass
2. Every tool returns JSON.stringify()   → both paths
3. Every tool execute() has try/catch    → no unhandled throws
4. Every Zod field has .describe()       → grep for fields without it
5. Tool descriptions are specific        → not just "does X"
6. Service auth is in constructor        → not per-request
7. Service URLs use encodeURIComponent   → for user input
8. System prompt lists all tools         → names match exactly
9. Env vars documented                   → new ones reported
10. Memory bank updated                  → activeContext + progress
```
