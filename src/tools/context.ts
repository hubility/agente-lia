// Contexto mínimo que el SDK inyecta en cada tool (ver adaptTool en
// @hubility/agents-amber: execute(args, { ...context, provider })).
// El teléfono del paciente sale de aquí; nunca se le pide.
export interface LiaToolContext {
  phoneNumber: string;
  name: string;
}
