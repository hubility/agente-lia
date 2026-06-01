import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient, PatientContext } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({});

// Primer contacto: identifica ao paciente pelo telefone e traz o resumo
// (próximas consultas com seus IDs, último orçamento/receita, atestados vigentes).
export function createGetPatientContextTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'get_patient_context',
    description:
      'Identifica o paciente pelo telefone da conversa e retorna o contexto: se é paciente cadastrado, ' +
      'suas próximas consultas (com os IDs usados para remarcar/cancelar), o último orçamento, a última ' +
      'receita e os atestados vigentes. Use no início do atendimento e antes de remarcar ou cancelar. ' +
      'Se isPatient for false, ofereça cadastrar o paciente.',
    schema: Schema,
    async execute(_args, context) {
      const startTime = Date.now();
      try {
        const data = await client.getPatientContext(context.phoneNumber);
        await events.success('tool', 'get_patient_context', 'Contexto do paciente obtido', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: context.phoneNumber, isPatient: (data as PatientContext).isPatient },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'get_patient_context', err.message, {
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
