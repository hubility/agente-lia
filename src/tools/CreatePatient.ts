import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';
import type { LiaToolContext } from './context.js';

const Schema = z.object({
  name: z.string().describe('Nome completo do paciente.'),
  email: z.string().nullable().describe('E-mail (opcional).'),
  cpf: z.string().nullable().describe('CPF (opcional).'),
  birthDate: z
    .string()
    .nullable()
    .describe('Data de nascimento, ISO 8601. Ex.: "1990-05-20T00:00:00-03:00" (opcional).'),
  notes: z.string().nullable().describe('Observações (opcional).'),
});

// Cadastra um paciente novo. O telefone vem da conversa.
export function createCreatePatientTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_patient',
    description:
      'Cadastra um novo paciente usando o telefone da conversa. Use quando get_patient_context retornar ' +
      'isPatient:false e o paciente quiser agendar. Peça ao menos o nome completo antes de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createPatient({
          name: args.name,
          phone: context.phoneNumber,
          email: args.email,
          cpf: args.cpf,
          birthDate: args.birthDate,
          notes: args.notes,
        });
        await events.success('tool', 'create_patient', 'Paciente cadastrado', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { phone: context.phoneNumber, patientId: data.id, name: args.name },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_patient', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { phone: context.phoneNumber, name: args.name },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
