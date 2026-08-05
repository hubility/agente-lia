import 'dotenv/config';
import { createBot, createProvider, createFlow } from '@hubility/router';
import { MemoryDB as Database } from '@hubility/router';
import {
  AgentService,
  adaptTool,
  textPipe,
  audioPipe,
  imagePipe,
  loadAgentConfig,
  createStatusGate,
} from '@hubility/agents-amber';
import { TelegramProvider } from '@hubility/provider-telegram';

import { systemPrompt } from './prompts/system-prompt-lia.js';
import { adminSystemPrompt } from './prompts/system-prompt-lia-admin.js';
import { LiaApiClient } from './services/LiaApiClient.js';
import { createLiaTools } from './tools/index.js';
import { createAdminTools } from './tools/admin/index.js';

// Hidrata process.env desde Agent + AgentEnvVariable ANTES de crear el provider
// y el cliente de la API (TELEGRAM_BOT_TOKEN, LIA_API_KEY, etc. se leen justo
// debajo). Con HUBILITY_CONFIG_SOURCE=env no toca la DB (rollback de emergencia).
const config = await loadAgentConfig();

const adapterProvider = createProvider(TelegramProvider, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  corsEnabled: true,
  // Pause/play desde la plataforma: Agent.isActive con microcaché de 5 s,
  // fail-open. Lia no usa welcome gate (Agent.welcomeMessage es null).
  messageGate: createStatusGate(),
});

const PORT = process.env.PORT ?? 3010;

const liaApi = new LiaApiClient({
  baseUrl: process.env.LIA_API_URL ?? 'https://lia.hubilityai.com',
  apiKey: process.env.LIA_API_KEY ?? '',
});

const main = async () => {
  const agentService = new AgentService({
    tools: createLiaTools(liaApi).map((t) => adaptTool(t, { provider: adapterProvider })),
    provider: adapterProvider,
    instructions: config.instructions ?? systemPrompt,
    model: config.model ?? 'gpt-5.4-mini',
    // temperature intencionadamente omitida: los GPT-5.x razonadores la
    // rechazan con 400 «Unsupported parameter» (aprendizaje del piloto Socorro).
    verbosity: config.verbosity,
    // Modo admin: el doctor / gestores de la clínica (Contact.isAdmin) hablan con la
    // misma Lia en modo gestión: localizar pacientes, ver fichas, agenda y emitir
    // documentos, además de las reglas de negocio (save/list/delete las añade el SDK).
    admin: {
      enabled: true,
      instructions: config.adminInstructions ?? adminSystemPrompt,
      tools: createAdminTools(liaApi).map((t) => adaptTool(t, { provider: adapterProvider })),
    },
  });

  // documentPipe is intentionally omitted: its body is commented out in @hubility/agents-amber.
  const adapterFlow = createFlow([
    textPipe(agentService),
    audioPipe(agentService),
    imagePipe(agentService),
  ]);

  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  adapterProvider.server.post(
    '/v1/messages',
    handleCtx(async (bot: any, req: any, res: any) => {
      const { number, message, urlMedia } = req.body;
      await bot.sendMessage(number, message, { media: urlMedia ?? null });
      return res.end('sended');
    })
  );

  httpServer(+PORT);
  console.log(`Lia running on port ${PORT} (config source: ${config.source})`);
};

main();
