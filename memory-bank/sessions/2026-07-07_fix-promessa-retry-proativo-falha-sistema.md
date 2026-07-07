# Session: Evitar que Lia prometa retry proativo em falha de sistema
Date: 2026-07-07 12:00
Project: agente-LIA (Hubility)

## Goal
En una conversación real por Telegram, ante un fallo de conexión Lia prometió reintentar la consulta sola y avisar al paciente ("tento novamente daqui a pouco", "te respondo com segurança"). Corregir esa promesa estructuralmente imposible.

## Decisions
- **Causa raíz = capacidad alucinada, no bug de código.** Lia corre sobre `@hubility/agents-amber` (`AgentService`) disparada solo por webhook de Telegram (`textPipe`/`audioPipe`/`imagePipe`), un turno por mensaje entrante. No hay cron, scheduler ni tool de seguimiento → es puramente reactiva y NO puede retomar la conversación sola. Prometer un retry proactivo deja al paciente esperando una respuesta que nunca llega.
- **El endpoint `POST /v1/messages` (app.ts) NO habilita la promesa.** Manda mensajes salientes, pero lo dispara un llamador externo (lia-web/CRM), no el agente por decisión propia. El sistema puede empujar un mensaje; el agente-Lia no puede agendárselo.
- **Fix SOLO en el prompt de paciente**, quirúrgico, sin tocar tools ni arquitectura. Nueva sección "Falhas de sistema e erros de ferramenta" entre "Limites duros" y "Quando escalar".
- **Coherencia con la escalada existente:** el guardrail previo ("Não prometa que alguém vai entrar em contato") estaba acotado a la escalada al doctor y por eso no cubría el fallo de tool. Se distingue: fallo transitorio → devolver la iniciativa al paciente ("me escreva de novo em alguns minutos"); fallo persistente → pasar el contacto del doctor.
- **Dos fallos distintos atacados:** (1) promesa de seguimiento proactivo imposible; (2) sobrepromesa de certeza ("te respondo com segurança") mientras el sistema está caído, que además contradice el límite duro "nunca suponha o resultado sem chamar a tool".

## Work Done
- `src/prompts/system-prompt-lia.ts`: sección nueva de 5 reglas — transparencia sin tecnicismos; prohibición de prometer retry/aviso proactivo (con el porqué explícito para el modelo); devolver iniciativa al paciente; prohibición de garantizar resultado de tool que acaba de fallar (cita literal contra "te respondo com segurança"); escalar solo si el error persiste.
- Verificado `tsc --noEmit` (exit 0). Commit `6e21bf8`, push a `main`.

## Learnings
- **Al fallar, las tools devuelven `JSON.stringify({ error: err.message })`** (p.ej. `CheckAvailability.ts:47-55`). Lia recibe ese `{error}` y debe decidir qué hacer; sin regla explícita de manejo de fallo, el modelo improvisó y prometió reintentar solo. El hueco no estaba en el error handling del código sino en la ausencia de política de comportamiento ante fallo.
- **Deuda ya conocida sigue en pie:** dirección de la clínica duplicada entre `system-prompt-lia.ts` (paciente, autónomo) y `lia-core.ts` (solo lo importa el admin). No se tocó.

## Key Files
src/prompts/system-prompt-lia.ts
