import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({});

// Serviços ativos com preço (em centavos) e duração. O `id` de cada serviço é o
// catalogItemId usado em disponibilidade e agendamento.
export function createListCatalogTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_catalog',
    description:
      'Lista os serviços oferecidos pelo consultório, com nome, descrição, preço (priceCents, em centavos) ' +
      'e duração. Use para informar serviços e valores ao paciente e para obter o catalogItemId necessário ' +
      'ao consultar disponibilidade ou agendar.',
    schema: Schema,
    async execute(_args, context) {
      const startTime = Date.now();
      try {
        const data = await client.getCatalog();
        await events.success('tool', 'list_catalog', 'Catálogo listado', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: context.phoneNumber, count: data.length },
        });
        return JSON.stringify({ catalog: data });
      } catch (err: any) {
        await events.error('tool', 'list_catalog', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: context.phoneNumber },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
