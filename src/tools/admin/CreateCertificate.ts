import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({
  patientId: z.string().describe('ID do paciente (obtido em search_patient).'),
  issueDate: z.string().describe('Data de emissão, ISO 8601 com offset.'),
  absenceStartDate: z.string().describe('Início do afastamento, ISO 8601 com offset.'),
  absenceEndDate: z.string().describe('Fim do afastamento, ISO 8601 (não anterior ao início).'),
  cid: z.string().describe('CID informado pelo doutor. Ex.: "K08.1".'),
  city: z.string().describe('Cidade de emissão. Ex.: "Fortaleza".'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
});

// Cria um atestado para um paciente (modo admin). Transcreve exatamente os dados que o doutor ditou.
export function createCreateCertificateTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_certificate',
    description:
      'Cria um atestado para o paciente (patientId de search_patient). Use exatamente o CID, as datas e a ' +
      'cidade que o doutor informar; nunca invente. Confirme os dados ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createCertificate({
          patientId: args.patientId,
          issueDate: args.issueDate,
          absenceStartDate: args.absenceStartDate,
          absenceEndDate: args.absenceEndDate,
          cid: args.cid,
          city: args.city,
          notes: args.notes ?? undefined,
        });
        await events.success('tool', 'create_certificate', 'Atestado criado', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { patientId: args.patientId, certificateId: data.id },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_certificate', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: { patientId: args.patientId },
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
