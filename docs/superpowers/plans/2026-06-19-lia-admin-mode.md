# Modo admin de Lia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Lia en modo admin sea la misma Lia (personalidad unificada) y pueda atender al doctor: buscar pacientes, ver su ficha, gestionar agenda y emitir orçamentos/receitas/atestados.

**Architecture:** Se extrae un núcleo de identidad compartido (`liaCore`) que ambos prompts importan. Se amplía `LiaApiClient` con los endpoints que la API ya expone (búsqueda de pacientes y documentos). Se crean tools admin-específicas que reciben el paciente de forma explícita, y se reutilizan tal cual las tools agnósticas al paciente (`list_catalog`, `check_availability`, `reschedule_appointment`, `cancel_appointment`). Las tools de paciente no se tocan.

**Tech Stack:** TypeScript (ESM), `@hubility/agents-amber` (IBaseTool, EventEmitter, adaptTool), `zod`, `tsx`.

**Spec:** [docs/superpowers/specs/2026-06-19-lia-admin-mode-design.md](../specs/2026-06-19-lia-admin-mode-design.md)

## Global Constraints

- **Idioma:** prompts en português do Brasil (contenido del agente); comentarios de código en español, como en el resto del repo.
- **Sin framework de tests:** el repo no usa vitest/jest. La verificación de cada tarea es `npx tsc --noEmit` (typecheck) y/o un smoke script ejecutado con `npx tsx`. NO añadir un framework de tests.
- **Patrón de tool (obligatorio en todas las nuevas):** `IBaseTool<z.infer<typeof Schema>, LiaToolContext>`, con `EventEmitter(process.env.HUBILITY_AGENT_ID || '')`, telemetría `events.success` / `events.error`, y retorno `JSON.stringify(...)` en éxito y `JSON.stringify({ error: err.message })` en fallo. Copiar la forma exacta de [src/tools/ScheduleAppointment.ts](../../../src/tools/ScheduleAppointment.ts).
- **Identidad del paciente:** en tools admin el paciente va SIEMPRE como argumento explícito (`phone` o `patientId`). Nunca usar `context.phoneNumber` como paciente (es el teléfono del admin).
- **Endpoints:** todos respaldados por [docs/api/openapi.yaml](../../api/openapi.yaml). No se toca el backend.
- **Respuesta API:** `LiaApiClient.request` ya desenvuelve `{ data }` y lanza con `payload.error`. Reusar `this.request`.
- **Commits frecuentes:** un commit por tarea como mínimo.

---

### Task 1: Ampliar LiaApiClient con búsqueda de pacientes y documentos

**Files:**
- Modify: `src/services/LiaApiClient.ts`
- Test: `tests/api-client-smoke.ts` (crear)

**Interfaces:**
- Consumes: `this.request<T>(method, path, body?)` ya existente.
- Produces:
  - `searchPatients(q: string): Promise<Patient[]>`
  - `createQuote(input: CreateQuoteInput): Promise<Quote>`
  - `listQuotes(): Promise<Quote[]>`
  - `createPrescription(input: CreatePrescriptionInput): Promise<Prescription>`
  - `listPrescriptions(): Promise<Prescription[]>`
  - `createCertificate(input: CreateCertificateInput): Promise<MedicalCertificate>`
  - `listCertificates(): Promise<MedicalCertificate[]>`
  - Tipos: `Quote`, `QuoteLine`, `Prescription`, `MedicalCertificate`, `CreateQuoteInput`, `QuoteLineInput`, `CreatePrescriptionInput`, `PrescriptionItemInput`, `CreateCertificateInput`.

- [ ] **Step 1: Añadir interfaces de documentos**

En `src/services/LiaApiClient.ts`, después de la interfaz `Availability` (línea 46), añadir:

```typescript
export interface QuoteLine {
  id: string;
  quoteId: string;
  catalogItemId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface Quote {
  id: string;
  patientId: string;
  number: string;
  issueDate: string;
  paymentMethod: string | null;
  validityDays: number | null;
  discountCents: number;
  notes: string | null;
  patient?: Patient | null;
  lines?: QuoteLine[];
}

export interface Prescription {
  id: string;
  patientId: string;
  issueDate: string;
  notes: string | null;
  patient?: Patient | null;
}

export interface MedicalCertificate {
  id: string;
  patientId: string;
  issueDate: string;
  absenceStartDate: string;
  absenceEndDate: string;
  cid: string;
  city: string;
  notes: string | null;
  patient?: Patient | null;
}

export interface QuoteLineInput {
  catalogItemId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateQuoteInput {
  patientId: string;
  issueDate: string;
  paymentMethod?: string | null;
  validityDays?: number | null;
  discountCents: number;
  notes?: string | null;
  lines: QuoteLineInput[];
}

export interface PrescriptionItemInput {
  medicine: string;
  instructions: string;
  position: number;
}

export interface CreatePrescriptionInput {
  patientId: string;
  issueDate: string;
  notes?: string | null;
  items: PrescriptionItemInput[];
}

export interface CreateCertificateInput {
  patientId: string;
  issueDate: string;
  absenceStartDate: string;
  absenceEndDate: string;
  cid: string;
  city: string;
  notes?: string | null;
}
```

- [ ] **Step 2: Añadir los métodos al cuerpo de la clase**

En la clase `LiaApiClient`, después de `cancelAppointment` (línea 139), añadir:

```typescript
  searchPatients(q: string) {
    const qs = new URLSearchParams({ q });
    return this.request<Patient[]>('GET', `/api/agent/v1/patients?${qs.toString()}`);
  }

  createQuote(input: CreateQuoteInput) {
    return this.request<Quote>('POST', '/api/agent/v1/quotes', input);
  }

  listQuotes() {
    return this.request<Quote[]>('GET', '/api/agent/v1/quotes');
  }

  createPrescription(input: CreatePrescriptionInput) {
    return this.request<Prescription>('POST', '/api/agent/v1/prescriptions', input);
  }

  listPrescriptions() {
    return this.request<Prescription[]>('GET', '/api/agent/v1/prescriptions');
  }

  createCertificate(input: CreateCertificateInput) {
    return this.request<MedicalCertificate>('POST', '/api/agent/v1/certificates', input);
  }

  listCertificates() {
    return this.request<MedicalCertificate[]>('GET', '/api/agent/v1/certificates');
  }
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Crear smoke script del cliente**

Crear `tests/api-client-smoke.ts` (solo se ejecuta con `LIA_API_KEY` real; sirve de verificación manual de que los endpoints responden):

```typescript
// Smoke del cliente API admin: busca pacientes y lista documentos.
// Ejecutar: npx tsx tests/api-client-smoke.ts "<texto de búsqueda>"
import 'dotenv/config';
import { LiaApiClient } from '../src/services/LiaApiClient.js';

async function main() {
  const client = new LiaApiClient({
    baseUrl: process.env.LIA_API_URL ?? 'https://lia.hubilityai.com',
    apiKey: process.env.LIA_API_KEY ?? '',
  });
  const q = process.argv[2] ?? 'a';
  const patients = await client.searchPatients(q);
  console.log(`searchPatients("${q}"):`, patients.length, 'resultado(s)');
  patients.slice(0, 5).forEach((p) => console.log('  -', p.name, p.phone, p.id));

  const quotes = await client.listQuotes();
  console.log('listQuotes:', quotes.length);
  const prescriptions = await client.listPrescriptions();
  console.log('listPrescriptions:', prescriptions.length);
  const certificates = await client.listCertificates();
  console.log('listCertificates:', certificates.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: Ejecutar el smoke (si hay API key)**

Run: `npx tsx tests/api-client-smoke.ts Maria`
Expected: imprime el número de pacientes y de documentos sin lanzar. (Si no hay `LIA_API_KEY`, omitir este step; la verificación de la tarea es el typecheck del Step 3.)

- [ ] **Step 6: Commit**

```bash
git add src/services/LiaApiClient.ts tests/api-client-smoke.ts
git commit -m "feat(api): búsqueda de pacientes y endpoints de documentos en LiaApiClient"
```

---

### Task 2: Extraer el núcleo de personalidad compartido (liaCore)

**Files:**
- Create: `src/prompts/lia-core.ts`
- Modify: `src/prompts/system-prompt-lia.ts`
- Test: `tests/prompts-smoke.ts` (crear)

**Interfaces:**
- Produces: `export const liaCore: string` — bloque con identidad, tono, reglas de canal y datos de la clínica.

- [ ] **Step 1: Crear `src/prompts/lia-core.ts`**

Contiene, verbatim, las secciones "Identidade e tom de voz" y "Sobre a clínica" del prompt de paciente actual (líneas 16-48 de [system-prompt-lia.ts](../../../src/prompts/system-prompt-lia.ts)), para no cambiar el comportamiento del paciente:

```typescript
// Núcleo de identidad de Lia, compartido por el modo paciente y el modo admin.
// Es la MISMA Lia: identidad, tono de voz, reglas de canal y datos de la clínica.
// Cada modo importa este bloque y añade su propio contexto.

export const liaCore = `## Identidade e tom de voz

- Tom profissional, seguro, educado, elegante e direto. A clínica atende um público exigente: trate cada interlocutor com atenção personalizada.
- Responda SEMPRE no mesmo idioma do interlocutor (o padrão é português do Brasil).
- Mensagens curtas e conversacionais — este é um canal de chat, não e-mail.
- NÃO use emojis, gírias, excesso de entusiasmo nem linguagem popular demais.
- Escreva em texto puro. NÃO use Markdown: nada de **negrito**, *itálico*, listas com - ou #. Este canal não renderiza Markdown e os símbolos aparecem crus. Para separar ideias, use quebras de linha simples.

## Sobre a clínica

- Clínica: Dr. Darcy Mavignier Odontologia — atendimento personalizado, técnico, seguro e individualizado, com foco em precisão, previsibilidade e longevidade dos tratamentos.
- Responsável técnico: Dr. Darcy Mavignier — CRO-CE 4157, mais de 25 anos de experiência clínica. Reabilitação oral, implantes, próteses, estética e endodontia com microscopia.
- Endereço: Rua Antônio Augusto, 1271 — Salas 604/605, Edifício Medical Gênesis, Aldeota, Fortaleza-CE. Há estacionamento no local.
- Instagram: @darcymavignierodontologia
- Horário regular: 08h às 12h e 15h às 19h. Todas as consultas funcionam por hora marcada.
- Atendimento exclusivamente particular: a clínica NÃO trabalha com convênios / planos de saúde.`;
```

- [ ] **Step 2: Refactorizar el prompt de paciente para importar `liaCore`**

En `src/prompts/system-prompt-lia.ts`:
1. Añadir al inicio del archivo (tras los comentarios de cabecera): `import { liaCore } from './lia-core.js';`
2. Sustituir el bloque de texto que va desde `## Identidade e tom de voz` hasta el final de la sección `## Sobre a clínica` (las líneas con los bullets de tono y los datos de la clínica) por la interpolación `${liaCore}`.

El prompt resultante debe seguir conteniendo, en el mismo orden: el encabezado `# Lia`, la sección de comportamiento na conversa, luego `${liaCore}`, y a continuación las secciones de flujo, política de valores, objeções, urgências, limites, escalada y ferramentas SIN cambios.

> Nota: las frases "Frases que expressam bem o tom" y "Frases PROIBIDAS" del prompt de paciente son específicas del trato con pacientes; déjalas en el prompt de paciente (no van a `liaCore`).

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Crear smoke de prompts**

Crear `tests/prompts-smoke.ts`:

```typescript
// Verifica que ambos prompts comparten el núcleo (liaCore) y conservan sus marcadores de modo.
// Ejecutar: npx tsx tests/prompts-smoke.ts
import { systemPrompt } from '../src/prompts/system-prompt-lia.js';
import { liaCore } from '../src/prompts/lia-core.js';

const checks: Array<[string, boolean]> = [
  ['liaCore presente en prompt paciente', systemPrompt.includes('Dr. Darcy Mavignier Odontologia')],
  ['núcleo extraído (tono)', liaCore.includes('Tom profissional, seguro')],
  ['paciente conserva flujo propio', systemPrompt.includes('get_patient_context')],
  ['paciente conserva create_patient', systemPrompt.includes('create_patient')],
  ['regla de texto puro en el núcleo', liaCore.includes('NÃO use Markdown')],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(pass ? `✅ ${label}` : `❌ ${label}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
```

- [ ] **Step 5: Ejecutar el smoke**

Run: `npx tsx tests/prompts-smoke.ts`
Expected: todos los checks en ✅, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/prompts/lia-core.ts src/prompts/system-prompt-lia.ts tests/prompts-smoke.ts
git commit -m "refactor(prompts): extraer núcleo de personalidad liaCore compartido"
```

---

### Task 3: Tools admin de consulta de pacientes (search_patient, get_patient_overview)

**Files:**
- Create: `src/tools/admin/SearchPatient.ts`
- Create: `src/tools/admin/GetPatientOverview.ts`
- Test: typecheck

**Interfaces:**
- Consumes: `LiaApiClient.searchPatients`, `LiaApiClient.getPatientContext`; `LiaToolContext` de `../context.js`.
- Produces: `createSearchPatientTool(client): IBaseTool`, `createGetPatientOverviewTool(client): IBaseTool`.

- [ ] **Step 1: Crear `src/tools/admin/SearchPatient.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  query: z.string().describe('Nome, telefone, e-mail ou CPF (mesmo parcial) do paciente a localizar.'),
});

// Busca pacientes (modo admin). Base para ver ficha, agendar ou emitir documentos.
export function createSearchPatientTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'search_patient',
    description:
      'Busca pacientes por nome, telefone, e-mail ou CPF (busca parcial). Use para localizar um paciente ' +
      'antes de ver sua ficha, agendar ou emitir documentos. Devolve id, nome e telefone de cada paciente. ' +
      'Se retornar mais de um, peça um dado (telefone ou CPF) para desambiguar antes de agir.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.searchPatients(args.query);
        await events.success('tool', 'search_patient', 'Pacientes buscados', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { query: args.query, count: data.length },
        });
        return JSON.stringify({ patients: data });
      } catch (err: any) {
        await events.error('tool', 'search_patient', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { query: args.query },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 2: Crear `src/tools/admin/GetPatientOverview.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient, PatientContext } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  phone: z.string().describe('Telefone do paciente (obtido em search_patient).'),
});

// Ficha do paciente (modo admin): próximas consultas, último orçamento/receita, atestados vigentes.
export function createGetPatientOverviewTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'get_patient_overview',
    description:
      'Retorna a ficha de um paciente a partir do telefone: próximas consultas (com IDs para remarcar/cancelar), ' +
      'último orçamento, última receita e atestados vigentes. Obtenha o telefone primeiro com search_patient.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.getPatientContext(args.phone);
        await events.success('tool', 'get_patient_overview', 'Ficha do paciente obtida', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: args.phone, isPatient: (data as PatientContext).isPatient },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'get_patient_overview', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: args.phone },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/tools/admin/SearchPatient.ts src/tools/admin/GetPatientOverview.ts
git commit -m "feat(admin): tools search_patient y get_patient_overview"
```

---

### Task 4: Tool admin de agenda (schedule_appointment_admin)

**Files:**
- Create: `src/tools/admin/ScheduleAppointmentAdmin.ts`
- Test: typecheck

**Interfaces:**
- Consumes: `LiaApiClient.createAppointment` (ya acepta `phone`).
- Produces: `createScheduleAppointmentAdminTool(client): IBaseTool`.
- Nota: remarcar y cancelar NO necesitan tool nueva — se reutilizan `createRescheduleAppointmentTool` y `createCancelAppointmentTool` (usan `appointmentId`). La disponibilidad se reutiliza con `createCheckAvailabilityTool`.

- [ ] **Step 1: Crear `src/tools/admin/ScheduleAppointmentAdmin.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  phone: z.string().describe('Telefone do paciente (obtido em search_patient).'),
  startsAt: z
    .string()
    .describe('Início da consulta, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-02T11:00:00-03:00".'),
  catalogItemId: z
    .string()
    .optional()
    .nullable()
    .describe('ID do serviço (list_catalog). Define duração e título. Envie isto OU durationMinutes.'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Duração em minutos. Obrigatório apenas se não enviar catalogItemId.'),
  title: z.string().optional().nullable().describe('Título da consulta (opcional).'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
});

// Agenda uma consulta para um paciente indicado pelo telefone (modo admin).
export function createScheduleAppointmentAdminTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'schedule_appointment_admin',
    description:
      'Agenda uma consulta para o paciente indicado pelo telefone (use search_patient antes). Informe ' +
      'catalogItemId OU durationMinutes. Confirme paciente, serviço, data e horário com o doutor ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        if (!args.catalogItemId && !args.durationMinutes) {
          throw new Error('Informe catalogItemId ou durationMinutes.');
        }
        const data = await client.createAppointment({
          phone: args.phone,
          startsAt: args.startsAt,
          catalogItemId: args.catalogItemId || undefined,
          durationMinutes: args.durationMinutes ?? undefined,
          title: args.title || undefined,
          notes: args.notes || undefined,
        });
        await events.success('tool', 'schedule_appointment_admin', 'Consulta agendada (admin)', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: args.phone, appointmentId: data.id, startsAt: data.startsAt },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'schedule_appointment_admin', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: args.phone, startsAt: args.startsAt },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/tools/admin/ScheduleAppointmentAdmin.ts
git commit -m "feat(admin): tool schedule_appointment_admin"
```

---

### Task 5: Tools admin de documentos (orçamento, receita, atestado)

**Files:**
- Create: `src/tools/admin/CreateQuote.ts`
- Create: `src/tools/admin/CreatePrescription.ts`
- Create: `src/tools/admin/CreateCertificate.ts`
- Create: `src/tools/admin/ListDocuments.ts`
- Test: typecheck

**Interfaces:**
- Consumes: `LiaApiClient.createQuote/createPrescription/createCertificate/listQuotes/listPrescriptions/listCertificates` (Task 1).
- Produces: `createCreateQuoteTool`, `createCreatePrescriptionTool`, `createCreateCertificateTool`, `createListQuotesTool`, `createListPrescriptionsTool`, `createListCertificatesTool`.

- [ ] **Step 1: Crear `src/tools/admin/CreateQuote.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const LineSchema = z.object({
  catalogItemId: z.string().optional().nullable().describe('ID do serviço do catálogo (opcional).'),
  description: z.string().describe('Descrição da linha.'),
  quantity: z.number().int().positive().describe('Quantidade.'),
  unitPriceCents: z.number().int().nonnegative().describe('Preço unitário em centavos.'),
});

const Schema = z.object({
  patientId: z.string().describe('ID do paciente (obtido em search_patient).'),
  issueDate: z.string().describe('Data de emissão, ISO 8601 com offset. Ex.: "2026-06-19T10:00:00-03:00".'),
  discountCents: z.number().int().nonnegative().describe('Desconto em centavos (0 se não houver).'),
  paymentMethod: z.string().optional().nullable().describe('Forma de pagamento (opcional).'),
  validityDays: z.number().int().positive().optional().nullable().describe('Validade em dias (opcional).'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
  lines: z.array(LineSchema).min(1).describe('Linhas do orçamento (ao menos uma).'),
});

// Cria um orçamento para um paciente (modo admin). Número e totais são calculados no servidor.
export function createCreateQuoteTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_quote',
    description:
      'Cria um orçamento para o paciente (patientId de search_patient). Os valores vêm do list_catalog; ' +
      'confirme linhas e total com o doutor ANTES de chamar. O número (ORC-xxxxx) é gerado pelo servidor.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createQuote({
          patientId: args.patientId,
          issueDate: args.issueDate,
          discountCents: args.discountCents,
          paymentMethod: args.paymentMethod ?? undefined,
          validityDays: args.validityDays ?? undefined,
          notes: args.notes ?? undefined,
          lines: args.lines.map((l) => ({
            catalogItemId: l.catalogItemId ?? undefined,
            description: l.description,
            quantity: l.quantity,
            unitPriceCents: l.unitPriceCents,
          })),
        });
        await events.success('tool', 'create_quote', 'Orçamento criado', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { patientId: args.patientId, quoteId: data.id, number: data.number },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_quote', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { patientId: args.patientId },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 2: Crear `src/tools/admin/CreatePrescription.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const ItemSchema = z.object({
  medicine: z.string().describe('Nome do medicamento exatamente como o doutor ditou.'),
  instructions: z.string().describe('Posologia/instruções exatamente como o doutor ditou.'),
  position: z.number().int().nonnegative().describe('Ordem do item (0, 1, 2...).'),
});

const Schema = z.object({
  patientId: z.string().describe('ID do paciente (obtido em search_patient).'),
  issueDate: z.string().describe('Data de emissão, ISO 8601 com offset.'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
  items: z.array(ItemSchema).min(1).describe('Itens da receita (ao menos um).'),
});

// Cria uma receita para um paciente (modo admin). Transcreve exatamente o que o doutor ditou.
export function createCreatePrescriptionTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_prescription',
    description:
      'Cria uma receita para o paciente (patientId de search_patient). Transcreva EXATAMENTE o medicamento e ' +
      'a posologia que o doutor ditar; nunca invente conteúdo clínico. Confirme palavra por palavra ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createPrescription({
          patientId: args.patientId,
          issueDate: args.issueDate,
          notes: args.notes ?? undefined,
          items: args.items.map((it) => ({
            medicine: it.medicine,
            instructions: it.instructions,
            position: it.position,
          })),
        });
        await events.success('tool', 'create_prescription', 'Receita criada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { patientId: args.patientId, prescriptionId: data.id },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_prescription', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { patientId: args.patientId },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 3: Crear `src/tools/admin/CreateCertificate.ts`**

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  patientId: z.string().describe('ID do paciente (obtido em search_patient).'),
  issueDate: z.string().describe('Data de emissão, ISO 8601 com offset.'),
  absenceStartDate: z.string().describe('Início do afastamento, ISO 8601 com offset.'),
  absenceEndDate: z.string().describe('Fim do afastamento, ISO 8601 (não anterior ao início).'),
  cid: z.string().describe('CID informado pelo doutor. Ex.: "K08.1".'),
  city: z.string().describe('Cidade de emissão. Ex.: "Fortaleza".'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
});

// Cria um atestado para um paciente (modo admin). Transcreve exatamente os dados que o doutor ditou.
export function createCreateCertificateTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_certificate',
    description:
      'Cria um atestado para o paciente (patientId de search_patient). Use exatamente o CID, as datas e a ' +
      'cidade que o doutor informar; nunca invente. Confirme os dados ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createCertificate({
          patientId: args.patientId,
          issueDate: args.issueDate,
          absenceStartDate: args.absenceStartDate,
          absenceEndDate: args.absenceEndDate,
          cid: args.cid,
          city: args.city,
          notes: args.notes ?? undefined,
        });
        await events.success('tool', 'create_certificate', 'Atestado criado', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { patientId: args.patientId, certificateId: data.id },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_certificate', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { patientId: args.patientId },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 4: Crear `src/tools/admin/ListDocuments.ts`**

Tres tools de lectura en un solo archivo (comparten patrón):

```typescript
import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({});

export function createListQuotesTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_quotes',
    description: 'Lista os orçamentos da clínica (com paciente e linhas), do mais recente ao mais antigo.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listQuotes();
        await events.success('tool', 'list_quotes', 'Orçamentos listados', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ quotes: data });
      } catch (err: any) {
        await events.error('tool', 'list_quotes', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}

export function createListPrescriptionsTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_prescriptions',
    description: 'Lista as receitas da clínica (com paciente), da mais recente à mais antiga.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listPrescriptions();
        await events.success('tool', 'list_prescriptions', 'Receitas listadas', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ prescriptions: data });
      } catch (err: any) {
        await events.error('tool', 'list_prescriptions', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}

export function createListCertificatesTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_certificates',
    description: 'Lista os atestados da clínica (com paciente), do mais recente ao mais antigo.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listCertificates();
        await events.success('tool', 'list_certificates', 'Atestados listados', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ certificates: data });
      } catch (err: any) {
        await events.error('tool', 'list_certificates', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
```

- [ ] **Step 5: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/tools/admin/CreateQuote.ts src/tools/admin/CreatePrescription.ts src/tools/admin/CreateCertificate.ts src/tools/admin/ListDocuments.ts
git commit -m "feat(admin): tools de documentos (orçamento, receita, atestado) y listados"
```

---

### Task 6: Ensamblar el toolset admin y cablearlo en app.ts

**Files:**
- Create: `src/tools/admin/index.ts`
- Modify: `src/app.ts`
- Test: typecheck

**Interfaces:**
- Produces: `createAdminTools(client: LiaApiClient): IBaseTool[]`.
- Consumes: las factory functions de las Tasks 3-5 y las reutilizadas de `src/tools/` (`createListCatalogTool`, `createCheckAvailabilityTool`, `createRescheduleAppointmentTool`, `createCancelAppointmentTool`).

- [ ] **Step 1: Crear `src/tools/admin/index.ts`**

```typescript
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';

// Tools agnósticas al paciente, reutilizadas tal cual en modo admin.
import { createListCatalogTool } from '../ListCatalog.js';
import { createCheckAvailabilityTool } from '../CheckAvailability.js';
import { createRescheduleAppointmentTool } from '../RescheduleAppointment.js';
import { createCancelAppointmentTool } from '../CancelAppointment.js';

// Tools específicas de admin.
import { createSearchPatientTool } from './SearchPatient.js';
import { createGetPatientOverviewTool } from './GetPatientOverview.js';
import { createScheduleAppointmentAdminTool } from './ScheduleAppointmentAdmin.js';
import { createCreateQuoteTool } from './CreateQuote.js';
import { createCreatePrescriptionTool } from './CreatePrescription.js';
import { createCreateCertificateTool } from './CreateCertificate.js';
import {
  createListQuotesTool,
  createListPrescriptionsTool,
  createListCertificatesTool,
} from './ListDocuments.js';

// Toolset del modo admin: consulta de pacientes, agenda y emissão de documentos.
export function createAdminTools(client: LiaApiClient): IBaseTool[] {
  return [
    createSearchPatientTool(client),
    createGetPatientOverviewTool(client),
    createListCatalogTool(client),
    createCheckAvailabilityTool(client),
    createScheduleAppointmentAdminTool(client),
    createRescheduleAppointmentTool(client),
    createCancelAppointmentTool(client),
    createCreateQuoteTool(client),
    createCreatePrescriptionTool(client),
    createCreateCertificateTool(client),
    createListQuotesTool(client),
    createListPrescriptionsTool(client),
    createListCertificatesTool(client),
  ];
}
```

- [ ] **Step 2: Cablear en `src/app.ts`**

1. Añadir import junto a los demás (tras la línea 10): `import { createAdminTools } from './tools/admin/index.js';`
2. Sustituir el bloque `admin` (líneas 35-39) por:

```typescript
    admin: {
      enabled: true,
      instructions: adminSystemPrompt,
      tools: createAdminTools(liaApi).map((t) => adaptTool(t, { provider: adapterProvider })),
    },
```

3. Eliminar el import ya no usado `import { createListCatalogTool } from './tools/ListCatalog.js';` (línea 10) SOLO si no se usa en ninguna otra parte de `app.ts` (actualmente solo lo usaba el bloque admin).

- [ ] **Step 3: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores (incl. que no quede el import huérfano de `createListCatalogTool`).

- [ ] **Step 4: Commit**

```bash
git add src/tools/admin/index.ts src/app.ts
git commit -m "feat(admin): ensamblar createAdminTools y cablearlo en app.ts"
```

---

### Task 7: Reescribir el prompt admin (misma Lia + capacidades + confirmaciones)

**Files:**
- Modify: `src/prompts/system-prompt-lia-admin.ts`
- Test: `tests/prompts-smoke.ts` (ampliar)

**Interfaces:**
- Consumes: `liaCore` de `./lia-core.js`.
- Produces: `export const adminSystemPrompt: string`.

- [ ] **Step 1: Reescribir `src/prompts/system-prompt-lia-admin.ts`**

```typescript
// System prompt de Lia en MODO ADMIN — clínica Dr. Darcy Mavignier Odontologia.
// Misma Lia (importa liaCore), com o "chapéu" de falar com o doutor / a direção.
// Este agente solo lo ven los administradores (Contact.isAdmin / ADMIN_PHONE_NUMBERS).
// Canal: Telegram. Idioma padrão: português do Brasil.

import { liaCore } from './lia-core.js';

export const adminSystemPrompt = `# Lia — modo administração

Você é Lia, a mesma atendente da clínica Dr. Darcy Mavignier Odontologia. Aqui você não está falando com um paciente, e sim com o DOUTOR ou um administrador da clínica. Continue sendo você mesma — mesmo tom, mesma elegância — mas agora seu papel é apoiar a gestão: localizar pacientes, consultar fichas, organizar a agenda, emitir documentos e cuidar das regras de atendimento.

${liaCore}

## Com quem você fala

- O interlocutor é o doutor ou a equipe da clínica, não um paciente. Trate-o com a proximidade de quem trabalha junto: prestativa, direta e de confiança.
- Você fala SOBRE os pacientes (terceiros), não COM eles. Por isso, para agir sobre um paciente, localize-o primeiro com search_patient.

## O que você faz

### Localizar pacientes e ver fichas
- Use search_patient (nome, telefone, e-mail ou CPF, mesmo parcial) para encontrar o paciente. Se voltar mais de um, peça um dado (telefone ou CPF) para desambiguar antes de agir. Nunca aja sobre um paciente ambíguo.
- Use get_patient_overview (com o telefone do paciente) para ver próximas consultas, último orçamento, última receita e atestados vigentes.

### Gerir a agenda
- Para ver horários livres, use check_availability (precisa do catalogItemId do list_catalog).
- Para agendar para um paciente, use schedule_appointment_admin (telefone do paciente + serviço/duração + horário).
- Para remarcar ou cancelar, use reschedule_appointment ou cancel_appointment com o appointmentId (obtenha-o em get_patient_overview).

### Emitir documentos
- Orçamento: create_quote (patientId + linhas). Os valores vêm do list_catalog; o número e os totais são calculados pelo servidor.
- Receita: create_prescription (patientId + itens). Transcreva EXATAMENTE o medicamento e a posologia que o doutor ditar.
- Atestado: create_certificate (patientId + CID, datas e cidade que o doutor informar).
- Para consultar emitidos: list_quotes, list_prescriptions, list_certificates.

### Gerir regras de negócio
As regras são instruções permanentes que mudam como a Lia atende os pacientes. Quando o doutor der uma instrução estável ("a partir de agora...", "sempre...", "nunca..."), use save_admin_rule (reformule numa frase clara e autocontida e confirme o texto exato). Para ver, use list_admin_rules; para remover, delete_admin_rule. Não guarde como regra pedidos pontuais nem dúvidas.

### Consultar o catálogo
Use list_catalog para verificar serviços, valores ou durações. Não invente valores.

## Confirmação e responsabilidade

- Antes de QUALQUER ação que grava dados — agendar, remarcar, cancelar ou emitir orçamento, receita ou atestado — confirme explicitamente com o doutor o que será feito.
- Receitas e atestados têm responsabilidade clínico-legal do doutor: transcreva exatamente o que ele ditar (medicamento, posologia, CID, cidade, datas), confirme palavra por palavra e NUNCA invente conteúdo clínico.
- Não invente dados: preços vêm do list_catalog, disponibilidade do check_availability, pacientes do search_patient.
- Em caso de ambiguidade sobre a intenção do doutor, pergunte antes de agir.
`;
```

- [ ] **Step 2: Ampliar `tests/prompts-smoke.ts`**

Añadir al array `checks` (importando también `adminSystemPrompt`):

```typescript
import { adminSystemPrompt } from '../src/prompts/system-prompt-lia-admin.js';
```

y, dentro del array `checks`:

```typescript
  ['admin comparte el núcleo', adminSystemPrompt.includes('Dr. Darcy Mavignier Odontologia')],
  ['admin conserva regla de texto puro', adminSystemPrompt.includes('NÃO use Markdown')],
  ['admin expone search_patient', adminSystemPrompt.includes('search_patient')],
  ['admin expone create_quote', adminSystemPrompt.includes('create_quote')],
  ['admin exige confirmación', adminSystemPrompt.includes('confirme explicitamente')],
```

> Nota: el texto del prompt usa "confirme explicitamente"; si se ajusta la redacción, alinear esta aserción.

- [ ] **Step 3: Verificar typecheck y smoke**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npx tsx tests/prompts-smoke.ts`
Expected: todos los checks en ✅, exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/prompts/system-prompt-lia-admin.ts tests/prompts-smoke.ts
git commit -m "feat(admin): prompt admin unificado con liaCore, capacidades y confirmaciones"
```

---

### Task 8: Smoke test end-to-end del modo admin

**Files:**
- Create: `tests/admin-tools-smoke.ts`
- Test: ejecución del propio script

**Interfaces:**
- Consumes: `createAdminTools` (Task 6) y `LiaApiClient`.

- [ ] **Step 1: Crear `tests/admin-tools-smoke.ts`**

Verifica que el toolset admin se construye con los nombres esperados y que `search_patient` ejecuta contra la API (si hay key). No escribe datos.

```typescript
// Smoke del toolset admin: comprueba la composición de tools y ejecuta search_patient (lectura).
// Ejecutar: npx tsx tests/admin-tools-smoke.ts "<texto de búsqueda>"
import 'dotenv/config';
import { LiaApiClient } from '../src/services/LiaApiClient.js';
import { createAdminTools } from '../src/tools/admin/index.js';

const EXPECTED = [
  'search_patient',
  'get_patient_overview',
  'list_catalog',
  'check_availability',
  'schedule_appointment_admin',
  'reschedule_appointment',
  'cancel_appointment',
  'create_quote',
  'create_prescription',
  'create_certificate',
  'list_quotes',
  'list_prescriptions',
  'list_certificates',
];

async function main() {
  const client = new LiaApiClient({
    baseUrl: process.env.LIA_API_URL ?? 'https://lia.hubilityai.com',
    apiKey: process.env.LIA_API_KEY ?? '',
  });

  const tools = createAdminTools(client);
  const names = tools.map((t) => t.name);
  const missing = EXPECTED.filter((n) => !names.includes(n));
  console.log('Tools admin:', names.join(', '));
  if (missing.length) {
    console.log('❌ Faltan tools:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Composición de tools admin correcta');

  // Ejecución de lectura de search_patient (solo si hay API key).
  if (process.env.LIA_API_KEY) {
    const search = tools.find((t) => t.name === 'search_patient')!;
    const out = await search.execute({ query: process.argv[2] ?? 'a' }, { phoneNumber: 'admin', name: 'Doctor' } as any);
    console.log('search_patient →', out);
  } else {
    console.log('(sin LIA_API_KEY: se omite la ejecución real de search_patient)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Ejecutar el smoke**

Run: `npx tsx tests/admin-tools-smoke.ts Maria`
Expected: "✅ Composición de tools admin correcta" y, si hay key, la salida JSON de `search_patient` sin lanzar.

- [ ] **Step 3: Verificar que el smoke de paciente sigue intacto**

Run: `npx tsx tests/prompts-smoke.ts`
Expected: todos los checks en ✅ (paciente y admin), exit 0.

- [ ] **Step 4: Commit**

```bash
git add tests/admin-tools-smoke.ts
git commit -m "test(admin): smoke end-to-end del toolset admin"
```

---

## Self-Review

**Spec coverage:**
- Personalidad unificada (liaCore) → Task 2 + Task 7. ✅
- Cliente API (searchPatients, create/list de documentos) → Task 1. ✅
- Tools admin (search_patient, get_patient_overview, schedule_appointment_admin, create_quote/prescription/certificate, list_*) → Tasks 3-5. ✅
- Reutilización de tools agnósticas (list_catalog, check_availability, reschedule, cancel) → Task 6. ✅
- Confirmaciones / responsabilidad clínico-legal → Task 7. ✅
- Desambiguación de pacientes → Task 7 (prompt) + descripción de search_patient (Task 3). ✅
- Tools de paciente intactas → no se tocan; verificado indirectamente por typecheck y prompts-smoke. ✅

**Type consistency:** los nombres de métodos del cliente (Task 1) coinciden con los usados en las tools (Tasks 3-5) y en el índice (Task 6). Los nombres de tool en el smoke (Task 8) coinciden con los definidos en las tools.

**Decisión abierta para el implementador:** la firma exacta de `execute(args, context)` y la forma de `IBaseTool` se toman verbatim de las tools existentes; si `adaptTool`/`IBaseTool` exige un campo extra no visto aquí, copiar el de [ScheduleAppointment.ts](../../../src/tools/ScheduleAppointment.ts).
