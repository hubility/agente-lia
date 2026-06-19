// Smoke del cliente API admin: busca pacientes y lista documentos.
// Ejecutar: npx tsx tests/api-client-smoke.ts "<texto de búsqueda>"
import 'dotenv/config';
import { LiaApiClient } from '../src/services/LiaApiClient.js';

async function main() {
  const client = new LiaApiClient({
    baseUrl: process.env.LIA_API_URL ?? 'https://lia.hubilityai.com',
    apiKey: process.env.LIA_API_KEY ?? '',
  });
  const q = process.argv[2] ?? 'a';
  const patients = await client.searchPatients(q);
  console.log(`searchPatients("${q}"):`, patients.length, 'resultado(s)');
  patients.slice(0, 5).forEach((p) => console.log('  -', p.name, p.phone, p.id));

  const quotes = await client.listQuotes();
  console.log('listQuotes:', quotes.length);
  const prescriptions = await client.listPrescriptions();
  console.log('listPrescriptions:', prescriptions.length);
  const certificates = await client.listCertificates();
  console.log('listCertificates:', certificates.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
