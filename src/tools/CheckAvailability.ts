import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({
  from: z
    .string()
    .describe('Início da janela de busca, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-02T08:00:00-03:00".'),
  to: z
    .string()
    .describe('Fim da janela de busca, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-02T18:00:00-03:00".'),
  catalogItemId: z
    .string()
    .describe('ID do serviço (obtido em list_catalog); define a duração e o passo entre horários.'),
});

// Horários de início livres para um serviço dentro de uma janela.
export function createCheckAvailabilityTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'check_availability',
    description:
      'Retorna os horários de início disponíveis para um serviço dentro da janela from–to. ' +
      'Traduza as expressões do paciente ("amanhã de manhã") para datas concretas a partir da data/hora atual. ' +
      'O horário do consultório é 08:00–18:00 (Fortaleza, UTC-03:00).',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.getAvailability(args.from, args.to, args.catalogItemId);
        await events.success('tool', 'check_availability', 'Disponibilidade consultada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: {
            phone: context.phoneNumber,
            catalogItemId: args.catalogItemId,
            from: args.from,
            to: args.to,
            slots: data.slots?.length ?? 0,
          },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'check_availability', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: context.phoneNumber, catalogItemId: args.catalogItemId, from: args.from, to: args.to },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
