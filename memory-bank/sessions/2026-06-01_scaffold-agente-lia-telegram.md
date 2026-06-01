# Session: Scaffold del agente Lia (consultorio Dr. Darcy) en Telegram
Date: 2026-06-01 00:33
Project: agente-LIA (Hubility)

## Goal
Crear el agente Hubility "Lia" para el consultorio odontológico del Dr. Darcy Furtado Mavignier Neto, partiendo de la propuesta comercial en PDF. Solo el agente, canal Telegram, sin tools (vendrán después vía openapi.yaml + otra skill).

## Decisions
- **Canal Telegram** (no Meta/WhatsApp todavía), aunque la propuesta original es para WhatsApp. El SDK advierte que Telegram + agents-amber no tiene ejemplo en producción aún (Meta es el camino probado): a verificar al arrancar.
- **`tools: []` intencional.** Lia bootea y conversa; las capacidades reales (horarios, agendamiento, catálogo, presupuestos PDF, recetas PDF) se añadirán luego con la skill de tools y un openapi.yaml.
- **Prompt en pt-BR**, no en español: el consultorio y los pacientes son brasileños. La regla "responder en el idioma del usuario" se mantiene. El prompt es honesto sobre no tener tools aún y prohíbe diagnósticos clínicos.
- **gpt-5.1 / temp 0.1 / puerto 3010** (defaults del skill hubility-agent-creator).

## Work Done
- Leído el PDF de propuesta (HUB-DFM-001): arquitectura WhatsApp (pacientes) + Painel web (dentista, 5 módulos), flujo entrada→procesamiento→salida, modelo comercial R$14k setup + R$700/mes.
- Generado proyecto Hubility completo con el skill hubility-agent-creator (variante Telegram, sin voz).

## Learnings
- El usuario **reemplazó `prisma/schema.prisma`** tras la generación: el skill copia un schema con modelos `Agent`/`Contact`/`AgentEvent` de cierta forma, pero el schema real del entorno Hubility del usuario es distinto (incluye `File`, `Message`, `ClientProfile`, `User` con campos Kinde/Stripe, `Agent` con `agentTitle/agentName/agentType`, etc.). El schema del template NO coincide con la DB real — usar el del usuario como fuente de verdad de aquí en adelante.

## Key Files
src/app.ts
src/prompts/system-prompt-lia.ts
package.json
.env.example
prisma/schema.prisma
README.md
