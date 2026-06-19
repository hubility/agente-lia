import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  phone: z.string().describe('Telefone do paciente (obtido em search_patient).'),
  startsAt: z
    .string()
    .describe('Início da consulta, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-02T11:00:00-03:00".'),
  catalogItemId: z
    .string()
    .optional()
    .nullable()
    .describe('ID do serviço (list_catalog). Define duração e título. Envie isto OU durationMinutes.'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe('Duração em minutos. Obrigatório apenas se não enviar catalogItemId.'),
  title: z.string().optional().nullable().describe('Título da consulta (opcional).'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
});

// Agenda uma consulta para um paciente indicado pelo telefone (modo admin).
export function createScheduleAppointmentAdminTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'schedule_appointment_admin',
    description:
      'Agenda uma consulta para o paciente indicado pelo telefone (use search_patient antes). Informe ' +
      'catalogItemId OU durationMinutes. Confirme paciente, serviço, data e horário com o doutor ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        if (!args.catalogItemId && !args.durationMinutes) {
          throw new Error('Informe catalogItemId ou durationMinutes.');
        }
        const data = await client.createAppointment({
          phone: args.phone,
          startsAt: args.startsAt,
          catalogItemId: args.catalogItemId || undefined,
          durationMinutes: args.durationMinutes ?? undefined,
          title: args.title || undefined,
          notes: args.notes || undefined,
        });
        await events.success('tool', 'schedule_appointment_admin', 'Consulta agendada (admin)', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: args.phone, appointmentId: data.id, startsAt: data.startsAt },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'schedule_appointment_admin', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: args.phone, startsAt: args.startsAt },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
