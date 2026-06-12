// Smoke test del modo admin: ejecuta el agente real (mismo isEnabled + modelo)
// con el teléfono admin y comprueba si guarda la regla o se niega.
// Ejecutar: npx tsx tests/admin-smoke.ts
import 'dotenv/config';
import { AgentService } from '@hubility/agents-amber';
import { PrismaClient } from '@prisma/client';
import { systemPrompt } from '../src/prompts/system-prompt-lia.js';

const ADMIN_PHONE = '8228942916';
const prisma = new PrismaClient();

// Provider mínimo: las tools admin no lo usan; las de negocio no se cargan aquí.
const dummyProvider: any = { sendMessage: async () => {} };

async function main() {
  const agentId = process.env.HUBILITY_AGENT_ID || '';
  const before = await prisma.agentRule.count({ where: { agentId, isActive: true } });
  console.log('Reglas activas ANTES:', before);

  const svc = new AgentService({
    instructions: systemPrompt,
    model: 'gpt-5.4-mini',
    provider: dummyProvider,
  });

  const response = await svc.handleAIResponse(
    ADMIN_PHONE,
    'Lia, guarda esta regra: sempre que perguntarem por clareamento, oferece o combo limpeza + clareamento.',
    null,
    dummyProvider,
    'David',
  );

  console.log('\n--- Respuesta del agente ---\n' + response + '\n');

  const after = await prisma.agentRule.findMany({ where: { agentId, isActive: true }, select: { content: true } });
  console.log('Reglas activas DESPUÉS:', after.length);
  after.forEach((r) => console.log('  -', r.content));
  console.log(after.length > before ? '\n✅ GUARDÓ la regla → las tools admin funcionan' : '\n❌ NO guardó → el modelo se niega pese a tener (o no) la tool');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
