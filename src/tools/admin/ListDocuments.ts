import { z } from 'zod';
import { EventEmitter } from '@hubility/agents-amber';
import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';
import type { LiaToolContext } from '../context.js';

const Schema = z.object({});

export function createListQuotesTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_quotes',
    description: 'Lista os orçamentos da clínica (com paciente e linhas), do mais recente ao mais antigo.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listQuotes();
        await events.success('tool', 'list_quotes', 'Orçamentos listados', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ quotes: data });
      } catch (err: any) {
        await events.error('tool', 'list_quotes', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}

export function createListPrescriptionsTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_prescriptions',
    description: 'Lista as receitas da clínica (com paciente), da mais recente à mais antiga.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listPrescriptions();
        await events.success('tool', 'list_prescriptions', 'Receitas listadas', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ prescriptions: data });
      } catch (err: any) {
        await events.error('tool', 'list_prescriptions', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}

export function createListCertificatesTool(
  client: LiaApiClient,
): IBaseTool<z.infer<typeof Schema>, LiaToolContext> {
  const events = new EventEmitter(process.env.HUBILITY_AGENT_ID || '');
  return {
    name: 'list_certificates',
    description: 'Lista os atestados da clínica (com paciente), do mais recente ao mais antigo.',
    schema: Schema,
    async execute(_args, _context) {
      const startTime = Date.now();
      try {
        const data = await client.listCertificates();
        await events.success('tool', 'list_certificates', 'Atestados listados', {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          payload: { count: data.length },
        });
        return JSON.stringify({ certificates: data });
      } catch (err: any) {
        await events.error('tool', 'list_certificates', err.message, {
          channel: 'Telegram',
          duration: Date.now() - startTime,
          details: err.message,
          payload: {},
        });
        return JSON.stringify({ error: err.message });
      }
    },
  };
}
