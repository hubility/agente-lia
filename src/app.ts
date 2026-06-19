import { createBot, createProvider, createFlow } from '@hubility/router';
import { MemoryDB as Database } from '@hubility/router';
import { AgentService, adaptTool, textPipe, audioPipe, imagePipe } from '@hubility/agents-amber';
import { TelegramProvider } from '@hubility/provider-telegram';

import { systemPrompt } from './prompts/system-prompt-lia.js';
import { adminSystemPrompt } from './prompts/system-prompt-lia-admin.js';
import { LiaApiClient } from './services/LiaApiClient.js';
import { createLiaTools } from './tools/index.js';
import { createAdminTools } from './tools/admin/index.js';

const adapterProvider = createProvider(TelegramProvider, {
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  corsEnabled: true,
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
    instructions: systemPrompt,
    model: 'gpt-5.4-mini',
    //temperature: 0.1,
    // Modo admin: el doctor / gestores de la clínica (Contact.isAdmin) hablan con la
    // misma Lia en modo gestión: localizar pacientes, ver fichas, agenda y emitir
    // documentos, además de las reglas de negocio (save/list/delete las añade el SDK).
    admin: {
      enabled: true,
      instructions: adminSystemPrompt,
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
  console.log(`Lia running on port ${PORT}`);
};

main();
