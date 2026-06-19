import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const ItemSchema = z.object({
  medicine: z.string().describe('Nome do medicamento exatamente como o doutor ditou.'),
  instructions: z.string().describe('Posologia/instruções exatamente como o doutor ditou.'),
  position: z.number().int().nonnegative().describe('Ordem do item (0, 1, 2...).'),
});

const Schema = z.object({
  patientId: z.string().describe('ID do paciente (obtido em search_patient).'),
  issueDate: z.string().describe('Data de emissão, ISO 8601 com offset.'),
  notes: z.string().optional().nullable().describe('Observações (opcional).'),
  items: z.array(ItemSchema).min(1).describe('Itens da receita (ao menos um).'),
});

// Cria uma receita para um paciente (modo admin). Transcreve exatamente o que o doutor ditou.
export function createCreatePrescriptionTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'create_prescription',
    description:
      'Cria uma receita para o paciente (patientId de search_patient). Transcreva EXATAMENTE o medicamento e ' +
      'a posologia que o doutor ditar; nunca invente conteúdo clínico. Confirme palavra por palavra ANTES de chamar.',
    schema: Schema,
    async execute(args, context) {
      const startTime = Date.now();
      try {
        const data = await client.createPrescription({
          patientId: args.patientId,
          issueDate: args.issueDate,
          notes: args.notes ?? undefined,
          items: args.items.map((it) => ({
            medicine: it.medicine,
            instructions: it.instructions,
            position: it.position,
          })),
        });
        await events.success('tool', 'create_prescription', 'Receita criada', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { patientId: args.patientId, prescriptionId: data.id },
        });
        return JSON.stringify(data);
      } catch (err: any) {
        await events.error('tool', 'create_prescription', err.message, {
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
