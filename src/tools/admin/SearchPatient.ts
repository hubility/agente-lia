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
