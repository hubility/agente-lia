// Verifica que liaCore existe y que el prompt de paciente sigue intacto.
// El prompt admin (que consume liaCore) se comprueba en la Task 7.
// Ejecutar: npx tsx tests/prompts-smoke.ts
import { systemPrompt } from '../src/prompts/system-prompt-lia.js';
import { liaCore } from '../src/prompts/lia-core.js';

const checks: Array<[string, boolean]> = [
  ['núcleo extraído (tono)', liaCore.includes('Tom profissional, seguro')],
  ['núcleo con datos de la clínica', liaCore.includes('Dr. Darcy Mavignier Odontologia')],
  ['núcleo con regla de texto puro', liaCore.includes('NÃO use Markdown')],
  ['paciente intacto: get_patient_context', systemPrompt.includes('get_patient_context')],
  ['paciente intacto: create_patient', systemPrompt.includes('create_patient')],
  ['paciente intacto: frases proibidas', systemPrompt.includes('Frases PROIBIDAS')],
];

let ok = true;
for (const [label, pass] of checks) {
  console.log(pass ? `✅ ${label}` : `❌ ${label}`);
  if (!pass) ok = false;
}
process.exit(ok ? 0 : 1);
