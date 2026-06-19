// Smoke del toolset admin: comprueba la composición de tools y ejecuta search_patient (lectura).
// Ejecutar: npx tsx tests/admin-tools-smoke.ts "<texto de búsqueda>"
import 'dotenv/config';
import { LiaApiClient } from '../src/services/LiaApiClient.js';
import { createAdminTools } from '../src/tools/admin/index.js';

const EXPECTED = [
  'search_patient',
  'get_patient_overview',
  'list_catalog',
  'check_availability',
  'schedule_appointment_admin',
  'reschedule_appointment',
  'cancel_appointment',
  'create_quote',
  'create_prescription',
  'create_certificate',
  'list_quotes',
  'list_prescriptions',
  'list_certificates',
];

async function main() {
  const client = new LiaApiClient({
    baseUrl: process.env.LIA_API_URL ?? 'https://lia.hubilityai.com',
    apiKey: process.env.LIA_API_KEY ?? '',
  });

  const tools = createAdminTools(client);
  const names = tools.map((t) => t.name);
  const missing = EXPECTED.filter((n) => !names.includes(n));
  console.log('Tools admin:', names.join(', '));
  if (missing.length) {
    console.log('❌ Faltan tools:', missing.join(', '));
    process.exit(1);
  }
  console.log('✅ Composición de tools admin correcta');

  // Ejecución de lectura de search_patient (solo si hay API key).
  if (process.env.LIA_API_KEY) {
    const search = tools.find((t) => t.name === 'search_patient')!;
    const out = await search.execute({ query: process.argv[2] ?? 'a' }, { phoneNumber: 'admin', name: 'Doctor' } as any);
    console.log('search_patient →', out);
  } else {
    console.log('(sin LIA_API_KEY: se omite la ejecución real de search_patient)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
