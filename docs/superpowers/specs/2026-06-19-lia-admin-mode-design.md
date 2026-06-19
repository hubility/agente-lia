# Diseño — Modo admin de Lia: personalidad unificada + capacidades para el doctor

**Fecha:** 2026-06-19
**Proyecto:** agente-LIA (clínica Dr. Darcy Mavignier Odontologia)
**Estado:** Aprobado, pendiente de plan de implementación

## Problema

El modo admin actual ([src/prompts/system-prompt-lia-admin.ts](../../../src/prompts/system-prompt-lia-admin.ts))
tiene dos limitaciones:

1. **Suena como otro agente.** Está escrito como "modo gestão": seco y funcional. El prompt de
   paciente ([src/prompts/system-prompt-lia.ts](../../../src/prompts/system-prompt-lia.ts)) tiene
   toda la personalidad de Lia (elegante, segura, cálida, su tono, sus frases). El contraste hace
   que en admin parezca un bot distinto.
2. **Casi no tiene tools.** Solo gestiona reglas de negocio (save/list/delete, que añade el SDK) y
   consulta el catálogo. El doctor no puede pedirle nada operativo sobre pacientes, agenda o
   documentos.

El objetivo es que en modo admin **siga siendo la misma Lia** (misma voz, con el "sombrero" de
hablar con el doctor/la dirección) y que **pueda atender las demandas del doctor** con las tools
necesarias.

## Hallazgo clave

En modo paciente, Lia se identifica con el **teléfono de la conversación automáticamente** (es el
propio paciente). En modo admin el doctor habla **sobre otros pacientes**, así que las tools deben
recibir el paciente de forma **explícita** (tras buscarlo). Esta es la diferencia arquitectónica
central.

La API ([docs/api/openapi.yaml](../../api/openapi.yaml)) **ya expone casi todo lo necesario**; el
cliente actual ([src/services/LiaApiClient.ts](../../../src/services/LiaApiClient.ts)) solo usa una
fracción. No hace falta tocar el backend en esta iteración.

## Alcance

Capacidades del doctor en modo admin (todas aprobadas):

1. **Consultar pacientes e historial** (lectura): buscar por nombre/teléfono y ver ficha (próximas
   citas, último orçamento, receitas, atestados vigentes).
2. **Gestionar la agenda**: ver/agendar/remarcar/cancelar citas para cualquier paciente.
3. **Emitir documentos**: crear orçamentos, receitas y atestados.

Se mantiene lo actual (reglas de negocio + catálogo).

**Fuera de alcance (por ahora):** mejorar la búsqueda de pacientes en el backend (typo/acento
tolerante con `unaccent`/`pg_trgm`). Se usa la búsqueda difusa `?q=` existente; se mejorará en la
API más adelante si la precisión no alcanza.

## Decisión de arquitectura

**Tools admin propias (opción A) con reutilización de las agnósticas al paciente (matiz de C).**

- Las tools que **no dependen del paciente** se reutilizan tal cual: `list_catalog`,
  `check_availability` (`catalogItemId` + ventana), `reschedule_appointment` y `cancel_appointment`
  (`appointmentId`).
- Las tools que necesitan un paciente concreto se crean **nuevas y específicas de admin**, recibiendo
  el paciente de forma explícita.
- Las tools de paciente **no se modifican** (no se debilita la seguridad del "teléfono automático").

## Componentes

### 1. Personalidad unificada (la misma Lia)

Extraer un núcleo compartido `liaCore` con la identidad estable de Lia:
- Quién es y su rol en la clínica.
- Tono de voz (profesional, elegante, seguro, cálido, directo).
- Reglas de canal: texto plano, sin Markdown, sin emojis.
- Datos de la clínica (nombre, doctor/CRO, dirección, horarios).

Cada modo importa `liaCore` y añade solo su contexto:
- **Paciente** = `liaCore` + flujos de atención al paciente (sin cambios de comportamiento respecto
  de hoy).
- **Admin** = `liaCore` + "estás hablando con el doctor / la dirección de la clínica" + capacidades
  de gestión.

Lo específico de cada modo se queda en su prompt (p. ej. "nunca pidas el teléfono, es automático" es
de paciente; las confirmaciones de escritura son de admin).

**Ubicación sugerida:** `src/prompts/lia-core.ts` (exporta `liaCore`), importado por ambos prompts.

### 2. Cliente API — métodos nuevos

En [LiaApiClient.ts](../../../src/services/LiaApiClient.ts), todos respaldados por la spec:

- `searchPatients(q: string)` → `GET /api/agent/v1/patients?q=`
- `createQuote(input)` → `POST /api/agent/v1/quotes`
- `createPrescription(input)` → `POST /api/agent/v1/prescriptions`
- `createCertificate(input)` → `POST /api/agent/v1/certificates`
- `listQuotes()` / `listPrescriptions()` / `listCertificates()` → GET correspondientes

`getPatientContext(phone)` ya existe y se reutiliza pasando un teléfono explícito.

Se añaden las interfaces TypeScript de `Quote`, `QuoteLine`, `Prescription`, `MedicalCertificate` y
los inputs de creación, según los schemas de la spec.

### 3. Tools nuevas de admin (solo activas en modo admin)

- `search_patient(query)` — coincidencias por nombre/teléfono/email/CPF. Base de los demás flujos.
- `get_patient_overview(phone)` — ficha del paciente (reusa el endpoint context con teléfono
  explícito).
- `schedule_appointment_admin(phone, startsAt, catalogItemId|durationMinutes, ...)` — agenda para el
  paciente buscado.
- `create_quote(patientId, ...)` — orçamento con líneas.
- `create_prescription(patientId, ...)` — receita con items.
- `create_certificate(patientId, ...)` — atestado.
- (Opcional, lectura) `list_quotes` / `list_prescriptions` / `list_certificates`.

**Reutilizadas tal cual:** `list_catalog`, `check_availability`, `reschedule_appointment`,
`cancel_appointment`.

Registro: las tools de admin se pasan en `admin.tools` de `AgentService`
([src/app.ts:35-39](../../../src/app.ts#L35-L39)), igual que hoy se pasa `list_catalog`.

### 4. Seguridad / confirmaciones (en el prompt admin)

- Confirmar explícitamente antes de **agendar, remarcar, cancelar o emitir cualquier documento**.
- Receitas y atestados llevan responsabilidad clínico-legal del doctor: Lia **transcribe exactamente**
  lo que el doctor dicta (medicamento, posología, CID, ciudad), lo **confirma palabra por palabra** y
  **nunca inventa** contenido clínico.
- Si `search_patient` devuelve varias coincidencias, Lia **desambigua** (pregunta teléfono/CPF) antes
  de actuar; nunca actúa sobre un paciente ambiguo.
- No inventar datos: precios desde `list_catalog`, disponibilidad desde `check_availability`.

## Flujo típico

> Doctor: "crea un orçamento de limpieza para Maria García"
> 1. `search_patient("Maria García")`
> 2. Si hay varias coincidencias → Lia desambigua (teléfono/CPF)
> 3. `list_catalog` → precio y descripción de la limpieza
> 4. Lia confirma líneas y total con el doctor
> 5. `create_quote(patientId, lines, ...)`
> 6. Lia confirma el número generado (`ORC-xxxxx`)

## Criterios de éxito

- En modo admin, Lia mantiene su tono e identidad (misma voz que en paciente); no parece otro agente.
- El doctor puede: buscar un paciente, ver su ficha, gestionar su agenda y emitir orçamento/receita/
  atestado, todo por chat.
- Ninguna acción de escritura ocurre sin confirmación explícita del doctor.
- Las tools de paciente quedan intactas; el smoke test de paciente sigue pasando.
- `tests/admin-smoke.ts` se amplía para cubrir los nuevos flujos de admin.

## Notas de implementación

- Verificar cómo el SDK inyecta el teléfono de la conversación en las tools de paciente, para que las
  tools de admin reciban el paciente de forma explícita sin colisionar con ese mecanismo.
- `create_quote`/`create_prescription`/`create_certificate` usan `patientId` (no teléfono): el flujo
  resuelve `search_patient` → `patientId` antes de crear.
