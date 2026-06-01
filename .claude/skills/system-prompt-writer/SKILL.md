---
name: system-prompt-writer
description: Write or modify the amber agent's system prompt in src/prompts/system-prompt.ts. Use when creating a new agent personality, adding a use case, changing tone/language, updating tool references, or modifying routing logic between flows.
---

# System Prompt Writer

This skill teaches how to write effective system prompts for Hubility amber agents. The system prompt defines what the end user experiences — personality, capabilities, boundaries, and routing.

## Output

A TypeScript file at `src/prompts/system-prompt.ts` exporting:

```typescript
export const systemPrompt = `...`
```

## Prompt Structure

Every system prompt follows these sections **in order**. Omit a section only if it genuinely doesn't apply.

### 1. Identity Block

WHO the agent is, HOW it speaks, and in WHAT language.

```markdown
# {AgentName}

Eres {AgentName}, {role description} de {organization}, disponible por {channel}.

## Identidad

- Tono {adjective}, {adjective} y {adjective}. Contexto {domain} — nunca trivialices.
- Responde siempre en {language}.
- No uses emojis salvo {allowed emojis with meaning}.
- Mensajes cortos. {Channel} no es un email.
```

Rules:
- Name the agent. Never leave it as "Asistente" or "Bot".
- Set the language explicitly — the LLM will drift without it.
- Constrain emojis — unconstrained emoji use reads as unprofessional in medical/legal/financial contexts.
- Mention the channel (WhatsApp, Telegram) — it constrains message length and format expectations.

### 2. Capabilities Block

WHAT the agent can do, organized by use case. Each use case = one numbered subsection with a step-by-step flow.

```markdown
## Capacidades

Tienes {N} servicios:

### 1. {Use Case Name} ({access level})

{One-line description of who can use this and what it does.}

**Flujo:**
1. {Trigger — what user says/does}
2. {Tool call — which tool to use}
3. {Data collection — what to ask the user, if anything}
4. {Confirmation — confirm with user before mutations}
5. {Action — tool call for mutation}
6. {Response — what to tell the user}
```

Rules:
- Number the steps. The LLM follows numbered lists more reliably than prose.
- Name the exact tool in single quotes: `'tool_name'`.
- Specify data collection order — "one at a time in natural conversation" prevents the agent from dumping a form.
- Always include a confirmation step before mutations (registrations, purchases, deletions).
- State access level: open, restricted (phone validation), or authenticated.

### 3. Tools Block

A concise reference of every available tool. The LLM uses this to know WHAT exists and WHAT parameters to pass.

```markdown
## Herramientas

### 'tool_name'
- {What it does}
- Parametros: {list of params}
- Devuelve: {what the response contains}
```

Rules:
- Use the exact tool `name` from the IBaseTool definition.
- List parameters by name, not by type.
- Describe what the return value contains in business terms, not JSON structure.
- Keep it short — the full schema is in the tool's `.describe()`. This is a cheat sheet.

### 4. Hard Limits Block

What the agent must NEVER do. These override everything else.

```markdown
## Limites duros

- **NUNCA** {prohibited action}. {Why or what to do instead}.
- **NUNCA** {prohibited action}.
```

Rules:
- Use **NUNCA** (or **NEVER**) + bold — it triggers stronger compliance in the LLM.
- Be specific: "never give medical advice" is better than "be careful with medical content".
- Include the fallback: "If you can't resolve, tell the user to contact {X}".
- Common limits for Hubility agents:
  - Never invent data not returned by tools
  - Never reveal internal data to unverified users
  - Never interpret domain content (medical, legal, financial) — deliver links only
  - Never request data beyond defined fields

### 5. Routing Block

How the agent decides which flow to use. Only needed when the agent handles 2+ use cases from the same channel.

```markdown
## Routing

Detecta la intencion del usuario y dirige al flujo correcto:

- Intencion de {keywords} -> flujo 1 ({access level})
- Intencion de {keywords} -> flujo 2 ({access level})
- Si la intencion no es clara -> pregunta brevemente que necesita
- El usuario puede cambiar entre flujos en cualquier momento
```

Rules:
- Map user intent to flow number.
- State whether each flow requires verification.
- Always include a fallback for ambiguous intent.
- State that the user can switch flows mid-conversation.

## System vs User Parameters in Flows

The system prompt must align with how tools get their parameters. Cross-reference with `skills/tool-builder-skill/SKILL.md` → "Parameter Source Analysis".

**Key rule:** If a tool reads a value from `ToolContext` (e.g. `phoneNumber`), the system prompt must describe that action as **automatic**, NOT as something to ask the user.

| Tool parameter source | System prompt should say | System prompt should NOT say |
|-----------------------|-------------------------|------------------------------|
| `context.phoneNumber` (system) | "usa 'check_phone' con su número" | "pídele su número de teléfono" |
| `context.name` (system) | "saluda al usuario por su nombre" | "pregúntale cómo se llama" |
| Zod schema field (user) | "recoge el email del usuario" | "usa el email del sistema" |
| Prior tool result (LLM) | "usa el webinar_id de la sesión elegida" | "pídele el ID del webinar" |

**Why this matters:** If the system prompt tells the LLM to ask for data it already has, the user gets a frustrating experience ("¿Cuál es tu número?" when they're already messaging from that number). If it tells the LLM to use data it doesn't have, the tool call fails silently.

## Anti-Patterns

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Long paragraphs describing behavior | LLM skims prose, misses rules | Use numbered steps and bullet points |
| "Be helpful and professional" | Too vague, LLM already defaults to this | State specific tone constraints |
| Listing tool parameters with types | Duplicates the Zod schema, goes stale | List parameter names only, link to tool |
| No routing section with 2+ flows | LLM guesses which flow, often wrong | Explicit intent → flow mapping |
| Mixing open and restricted flows without marking | LLM skips verification for restricted flows | State access level per use case |
| "Use your best judgment" | LLM hallucinates confidently | State the exact fallback behavior |
| Asking user for data available in ToolContext | Frustrating UX, redundant questions | Mark automatic actions as automatic in the flow |
| Telling LLM to "use" data only available from user | Tool call fails or hallucinates | Explicitly state "recoge/solicita" for user-provided data |

## Checklist

Before finalizing a system prompt:

- [ ] Agent has a name (not "Asistente" or "Bot")
- [ ] Language is explicitly set
- [ ] Every use case has a numbered step-by-step flow
- [ ] Every tool is listed by exact name with params and return value
- [ ] Hard limits use **NUNCA/NEVER** + bold
- [ ] Fallback behavior is defined (who to contact, what to say)
- [ ] Routing section exists if 2+ use cases
- [ ] Confirmation step exists before any mutation
- [ ] Access levels are stated per use case
- [ ] No medical/legal/financial advice — deliver links only
- [ ] Automatic actions (ToolContext data) described as automatic, not as user prompts
- [ ] User-provided data explicitly marked as "recoge/solicita" in the flow
