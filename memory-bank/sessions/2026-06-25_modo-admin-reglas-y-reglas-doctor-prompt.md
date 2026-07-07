# Session: Modo admin operativo (tools de reglas) + reglas del doctor en el prompt del paciente
Date: 2026-06-25 21:00
Project: agente-LIA (Hubility)

## Goal
Resolver las demandas del doctor surgidas en una conversación real por Telegram (reglas de atención al paciente) y dejar operativo en producción el modo admin de gestión de reglas, que no funcionaba.

## Decisions
- **Las reglas del doctor van SOLO al prompt del paciente** (`system-prompt-lia.ts`), no al `core`. Razón: el agente de paciente es autónomo y NO importa `liaCore`; `lia-core.ts` solo lo usa el agente admin. Como las reglas son de cara al paciente, tocar el core era innecesario. Se descartó deduplicar ahora (la dirección está copiada en ambos) → anotado como deuda, no se hizo, para no acumular un refactor con riesgo sobre una demanda simple.
- **El precio 250→300 NO va al prompt.** Es un dato del catálogo (`list_catalog`, lia-web, otra DB). El prompt declara invariante "valores siempre de list_catalog, nunca del prompt". Meterlo crearía contradicción con la tool. Queda como tarea de catálogo en lia-web.
- **Regla de "no lenguaje técnico" genérica, con el ejemplo del doctor.** Se evitó una regla específica de siso con tabla de traducciones (sobreingeniería que el usuario rechazó). Regla general + el ejemplo del siso que dictó el doctor, y se sustituyeron los términos técnicos en la línea del siso de la política de valores.
- **Bump del SDK a alpha.19** para traer el fix del bug que ocultaba las tools de reglas admin. Antes había que **declarar `@modelcontextprotocol/sdk` como dependencia explícita** porque sin ella el deploy ni arrancaba.

## Work Done
- `system-prompt-lia.ts`: 3 reglas del doctor — (1) `NUNCA mencione a duração das consultas`; (2) `Não use linguagem técnica com o paciente` + ejemplo siso (já fora da gengiva / parcialmente coberto pela gengiva / dentro do osso) y sustitución de los términos técnicos en la política de valores; (3) dirección con estacionamiento corregido. Commit `4437f7a`.
- `lia-core.ts`: estacionamiento corregido (afecta al modo admin).
- `package.json`: `@hubility/agents-amber` alpha.18 → alpha.19; añadido `@modelcontextprotocol/sdk ^1.25.2`. `package-lock.json` añadido al repo. Commits `ae7bcae` y `68a45c6`.
- Verificado en producción: tras el redeploy, Lia admin guarda reglas correctamente.

## Learnings
- **Bug real de las tools de reglas admin (fix en alpha.19).** `@openai/agents-core` invoca el predicate `isEnabled` de las function tools como `predicate({ runContext, agent })` (en `tool.js`, ~línea 361), NO como `(runContext, agent)`. El SDK (`adminRules.ts`) leía `runContext.context.phoneNumber` directamente → recibía el objeto envuelto → `.context` undefined → `''` → `isAdminPhone('')` = false → las 3 tools (`save/list/delete_admin_rule`) ocultas para CUALQUIER admin. Fix: `const runContext = arg?.runContext ?? arg`. Por eso el síntoma era "el admin ve las 13 tools de gestión pero no las 3 de reglas": el routing (`resolveAgent`) usa `isAdminPhone(from)` y sí funcionaba; el filtro `isEnabled` usaba otra fuente de teléfono y fallaba.
- **Error de diagnóstico propio (anotado para no repetir):** se miró `getAllTools` en `agent.js` (que sí pasa `(runContext, this)` posicional) y se descartó la hipótesis de firma, concluyendo erróneamente "es el deploy de Railway". La ruta que ejecuta en runtime es la de `tool.js` con el objeto envuelto. Lección: verificar QUÉ ruta corre, no la primera que aparece en el grep.
- **`@modelcontextprotocol/sdk` es peer opcional de `@openai/agents-core`** (shim `mcp-server/node.mjs`). npm no lo instala por defecto; en producción con `--omit=dev` el `start` peta con `ERR_MODULE_NOT_FOUND`. En local "funciona" por un install previo suelto. Solución: declararlo explícito en `dependencies` (`^1.25.2`, igual que `plutos-sdk-meta`). Es un problema RECURRENTE entre proyectos Hubility consumidores del SDK.
- **Arquitectura de prompts:** `system-prompt-lia.ts` (paciente, autónomo, copia propia de "Sobre a clínica") vs `lia-core.ts` (compartido, solo lo importa `system-prompt-lia-admin.ts`). La dirección está duplicada en ambos → deuda: el refactor del modo admin extrajo `liaCore` para deduplicar pero solo conectó el admin; el prompt de paciente se quedó con la copia.

## Key Files
src/prompts/system-prompt-lia.ts
src/prompts/lia-core.ts
package.json
package-lock.json
