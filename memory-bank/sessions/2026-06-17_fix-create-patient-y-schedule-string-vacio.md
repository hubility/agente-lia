# Session: Bug de string vacío en create_patient y schedule_appointment (cadastro/agendamento)
Date: 2026-06-17 22:30
Project: agente-LIA (Hubility)

## Goal
Diagnosticar y corregir por qué el alta de pacientes y el agendamiento de Lia fallaban (422 "Dados inválidos") o creaban registros basura (paciente con nombre "Paciente"), durante pruebas reales en Telegram.

## Decisions
- **Causa raíz = string vacío forzado por el schema de la tool, NO datos faltantes.** Los campos opcionales en los schemas de las tools estaban como `.nullable()` **sin** `.optional()`, lo que los vuelve obligatorios en el JSON schema que ve el modelo → el modelo se ve forzado a emitir un valor y manda `""` en vez de `null`. Ese `""` no pasa los validadores estrictos del servidor (`.email()`, `.datetime({offset:true})`, `title.min(1)`).
- **Fix elegido: `.optional()` en los campos opcionales** (no eliminarlos), para que el modelo pueda omitirlos. Se descartó la regla mecánica "una tool por turno" que se había propuesto: técnicamente el SDK puede encadenar tools en un turno; la invariante correcta es "no llamar create_patient sin nombre real" y "no agendar sin confirmación explícita", no una prohibición artificial.
- **Blindaje extra con `|| undefined`** en los strings del execute de schedule_appointment: `?? undefined` NO atrapa el string vacío (`"" ?? x` = `""`), así que un `""` accidental se colaba igual. `|| undefined` convierte `""`/`null`/`undefined` todos a `undefined`.
- **schedule_appointment: campos realmente necesarios = `startsAt` + `catalogItemId`.** El servidor deriva duración Y título del catalogItemId (`durationMinutes ??= item.durationMinutes`, `title ??= item.name`). `durationMinutes` es solo fallback sin catálogo; `title`/`notes` son opcionales reales. Se mantuvieron todos pero con `.optional()`.
- **NO se tocó lia-web.** Los mensajes de error del servidor están hardcodeados ("nome e telefone são obrigatórios", "Dados inválidos para criar consulta") y mienten: ocultan el campo real que falla. Se dejó pendiente; no rompe, pero despista en el diagnóstico.

## Work Done
- `src/tools/CreatePatient.ts`: `.optional()` en email/cpf/birthDate/notes (resuelve el 422 del alta).
- `src/tools/ScheduleAppointment.ts`: orden de `durationMinutes` corregido (`.int().positive().optional().nullable()` — el orden previo `.optional().int()` revienta al construir el schema), `catalogItemId` a `.optional().nullable()`, y `|| undefined` en catalogItemId/title/notes del execute.
- `src/prompts/system-prompt-lia.ts`: flujo "Agendar" exige cadastro primero si isPatient:false; flujo "Cadastrar paciente novo" exige nombre real antes de create_patient y prohíbe placeholder "Paciente"; límite duro nuevo contra create_patient sin nombre real.
- Verificación determinista de schemas con scripts node temporales (probes de zod) en lugar de asumir.

## Learnings
- **El placeholder "Paciente" NO venía de la API.** Grep + lectura de lib/modules/patients/service.ts y appointments/route.ts confirmó que no hay default "Paciente" en lia-web. Lo creó el modelo: llamó create_patient prematuramente con "Paciente" porque `name` es required y aún no tenía el nombre. Quedaron 2 pacientes con el mismo teléfono.
- **`findPatientByPhone` usa `findFirst` sin orderBy** → con teléfonos duplicados, el agendamiento resolvió al primer registro ("Paciente"), por eso la cita salió con el nombre equivocado aunque "David de la Cruz" también existía. El teléfono debería ser único en el modelo Patient.
- **`z.number().optional().int()` lanza en runtime** ("z.number(...).optional(...).int is not a function"): tras `.optional()` el wrapper ya no expone `.int()`/`.positive()`. Los refinamientos del número van ANTES de los wrappers.
- **La observabilidad solo loguea un subconjunto del payload** (name+phone en create_patient; phone+startsAt+catalogItemId en schedule). El campo que realmente rompe (email/birthDate/title) no aparece en el evento → confirmación empírica vino de probar el schema del servidor localmente y del propio chat (al pedirle a Lia que mandara title con contenido real, el agendamiento pasó).
- **`??` vs `||` para sanear opcionales de LLM:** con datos que un modelo rellena, `||` es más seguro que `??` porque también descarta el string vacío.

## Key Files
src/tools/CreatePatient.ts
src/tools/ScheduleAppointment.ts
src/prompts/system-prompt-lia.ts
