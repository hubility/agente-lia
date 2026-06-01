import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({
  appointmentId: z
    .string()
    .describe('ID da consulta a cancelar (obtido em get_patient_context → upcomingAppointments).'),
});

// Cancelamento lógico (status = cancelled).
export function createCancelAppointmentTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'cancel_appointment',
    description:
      'Cancela uma consulta (cancelamento lógico). Obtenha o appointmentId com get_patient_context. ' +
      'Peça confirmação explícita ao paciente ANTES de chamar — é uma ação irreversível.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.cancelAppointment(args.appointmentId);
        await events.success('tool', 'cancel_appointment', 'Consulta cancelada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: context.phoneNumber, appointmentId: args.appointmentId },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'cancel_appointment', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: context.phoneNumber, appointmentId: args.appointmentId },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
