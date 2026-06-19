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
