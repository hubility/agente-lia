import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient, PatientContext } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  phone: z.string().describe('Telefone do paciente (obtido em search_patient).'),
});

// Ficha do paciente (modo admin): próximas consultas, último orçamento/receita, atestados vigentes.
export function createGetPatientOverviewTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'get_patient_overview',
    description:
      'Retorna a ficha de um paciente a partir do telefone: próximas consultas (com IDs para remarcar/cancelar), ' +
      'último orçamento, última receita e atestados vigentes. Obtenha o telefone primeiro com search_patient.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.getPatientContext(args.phone);
        await events.success('tool', 'get_patient_overview', 'Ficha do paciente obtida', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: args.phone, isPatient: (data as PatientContext).isPatient },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'get_patient_overview', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: args.phone },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
