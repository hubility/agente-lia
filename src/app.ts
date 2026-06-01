import { createBot, createProvider, createFlow } from '@hubility/router';
import { MemoryDB as Database } from '@hubility/router';
import { AgentService, adaptTool, textPipe, audioPipe, imagePipe } from '@hubility/agents-amber';
import { TelegramProvider } from '@hubility/provider-telegram';

import { systemPrompt } from './prompts/system-prompt-lia.js';
import { LiaApiClient } from './services/LiaApiClient.js';
import { createLiaTools } from './tools/index.js';

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
    model: 'gpt-5.1',
    temperature: 0.1,
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
