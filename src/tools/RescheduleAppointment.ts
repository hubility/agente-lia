import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({
  appointmentId: z
    .string()
    .describe('ID da consulta a remarcar (obtido em get_patient_context → upcomingAppointments).'),
  startsAt: z
    .string()
    .nullable()
    .describe('Novo início, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-03T09:00:00-03:00".'),
  durationMinutes: z.number().int().positive().nullable().describe('Nova duração em minutos (opcional).'),
});

// Remarca uma consulta. Revalida horário do consultório e colisões.
export function createRescheduleAppointmentTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'reschedule_appointment',
    description:
      'Remarca uma consulta existente para um novo horário e/ou duração. Obtenha o appointmentId com ' +
      'get_patient_context. Confirme o novo horário com o paciente ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        if (!args.startsAt && !args.durationMinutes) {
          throw new Error('Informe ao menos startsAt ou durationMinutes.');
        }
        const data = await client.rescheduleAppointment(args.appointmentId, {
          startsAt: args.startsAt ?? undefined,
          durationMinutes: args.durationMinutes ?? undefined,
        });
        await events.success('tool', 'reschedule_appointment', 'Consulta remarcada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: {
            phone: context.phoneNumber,
            appointmentId: args.appointmentId,
            startsAt: data.startsAt,
            durationMinutes: data.durationMinutes,
          },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'reschedule_appointment', err.message, {
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
