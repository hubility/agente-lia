import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({
  startsAt: z
    .string()
    .describe('Início da consulta, ISO 8601 com offset de Fortaleza. Ex.: "2026-06-02T11:00:00-03:00".'),
  catalogItemId: z
    .string()
    .nullable()
    .describe('ID do serviço (list_catalog). Define duração e título. Envie isto OU durationMinutes.'),
  durationMinutes: z
    .number()
    .int()
    .positive()
    .nullable()
    .describe('Duração em minutos. Obrigatório apenas se não enviar catalogItemId.'),
  title: z.string().nullable().describe('Título da consulta (opcional; o catálogo define um padrão).'),
  notes: z.string().nullable().describe('Observações (opcional).'),
});

// Agenda uma consulta. O paciente deve existir (use create_patient antes se necessário).
export function createScheduleAppointmentTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'schedule_appointment',
    description:
      'Agenda uma consulta para o paciente da conversa (identificado pelo telefone). Informe catalogItemId ' +
      'OU durationMinutes. Confirme data, horário e serviço com o paciente ANTES de chamar. O paciente já ' +
      'deve estar cadastrado (verifique com get_patient_context; se não, use create_patient).',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        if (!args.catalogItemId && !args.durationMinutes) {
          throw new Error('Informe catalogItemId ou durationMinutes.');
        }
        const data = await client.createAppointment({
          phone: context.phoneNumber,
          startsAt: args.startsAt,
          catalogItemId: args.catalogItemId ?? undefined,
          durationMinutes: args.durationMinutes ?? undefined,
          title: args.title ?? undefined,
          notes: args.notes ?? undefined,
        });
        await events.success('tool', 'schedule_appointment', 'Consulta agendada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: {
            phone: context.phoneNumber,
            appointmentId: data.id,
            startsAt: data.startsAt,
            catalogItemId: args.catalogItemId ?? null,
            durationMinutes: data.durationMinutes,
          },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'schedule_appointment', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: context.phoneNumber, startsAt: args.startsAt, catalogItemId: args.catalogItemId ?? null },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
