let bridge = null;
let status = null;
const tests = {};
const messages = {
 AUTH_ERROR:"Chave ausente, inválida ou sem acesso ao recurso do plano.",
 NO_NETWORK:"Não foi possível acessar o provedor. Verifique sua conexão.",
 TIMEOUT:"O provedor não respondeu a tempo. Tente novamente.",
 RATE_LIMIT:"Limite de consultas atingido. Aguarde antes de testar novamente.",
 INVALID_REQUEST:"Configuração inválida. Confira as chaves informadas.",
 INVALID_RESPONSE:"O provedor retornou dados incompletos ou inválidos.",
 PROVIDER_ERROR:"Não foi possível concluir a operação. Tente novamente.",
};
async function call(method, value) {
 if (!bridge) throw new Error("Configure as conexões no aplicativo desktop.");
 let timer;
 try {
  const reply = await Promise.race([bridge[method](value), new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error(messages.TIMEOUT)),22000);
  })]);
  if(!reply?.ok) throw new Error(messages[reply?.error?.code] || messages.PROVIDER_ERROR);
  return reply.data;
 } finally {clearTimeout(timer);}
}
export async function initializeConnections(api) {
 bridge=api;
 if (!bridge) return;
 try {status=await call("status");} catch {status=null;}
}
export function connectionStatus() { return {available:!!bridge, ...status, tests:{...tests}}; }
export async function saveConnections(patch) {
 status=await call("save",patch);
 delete tests.brapi; delete tests.twelve;
 return status;
}
export async function testConnection(provider) {
 try {
  const response=await call("test",provider);
  tests[provider]=`Conectado · ${response.symbol} · cotação de ${new Date(response.timestamp).toLocaleString("pt-BR")}`;
 } catch(error) {tests[provider]=error.message;}
 return tests[provider];
}
