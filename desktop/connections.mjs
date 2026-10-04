import * as fs from "node:fs/promises";
import path from "node:path";
import { createMarketBackend, createMarketHandler } from "./market-data.mjs";
import { catalog } from "../core/market/catalog.mjs";
import { normalizeError, MarketDataError } from "../core/market-data/errors.mjs";
const modes = ["disabled", "brapi", "twelve", "combined"];
const keyFields = ["brapiKey", "twelveKey"];
const blank = () => ({ mode:"disabled", brapiKey:"", twelveKey:"" });
function validate(patch) {
 if (!patch || typeof patch !== "object" || Array.isArray(patch) ||
   Object.keys(patch).some(k=> !["mode",...keyFields].includes(k)) ||
   (Object.hasOwn(patch,"mode") && !modes.includes(patch.mode))) throw new Error("INVALID_REQUEST");
 for (const k of keyFields) if (Object.hasOwn(patch,k) &&
  (typeof patch[k] !== "string" || patch[k].length>512 || /[^\x21-\x7e]/.test(patch[k]))) throw new Error("INVALID_REQUEST");
}
// Secrets never enter workspace JSON or status responses. SafeStorage is supplied by main.
export class ConnectionStore {
 #config = blank();
 #file; #crypto; #queue = Promise.resolve(); #warning = null; #persistent=false;
 constructor({directory, encryption}) { this.#file=path.join(directory,"market-connections.json"); this.#crypto=encryption; }
 secure() {
  try { return this.#crypto.isEncryptionAvailable() && (process.platform !== "linux" || this.#crypto.getSelectedStorageBackend?.() !== "basic_text"); }
  catch { return false; }
 }
 async load(env={}) {
  try {
   const row=JSON.parse(await fs.readFile(this.#file,"utf8"));
   if(row.version!==1 || !modes.includes(row.mode)) throw new Error("format");
   let keys={brapiKey:"",twelveKey:""};
   if(row.encrypted) {
    if(!this.secure()) throw new Error("locked");
    keys=JSON.parse(this.#crypto.decryptString(Buffer.from(row.encrypted,"base64")));
   }
   validate({...keys,mode:row.mode}); this.#config={...blank(),...keys,mode:row.mode}; this.#persistent=!!row.encrypted;
  } catch(error) {
   if(error.code!=="ENOENT") { this.#warning="As chaves salvas não puderam ser abertas. Reconfigure a conexão; nenhum dado foi apagado."; return; }
   const config={brapiKey:env.BRAPI_API_KEY?.trim()||"",twelveKey:env.TWELVE_DATA_API_KEY?.trim()||""};
   config.mode=modes.includes(env.MARKET_DATA_PROVIDER) ? env.MARKET_DATA_PROVIDER : config.twelveKey ? "combined" : config.brapiKey ? "brapi" : "disabled";
   try { validate(config); this.#config=config; } catch { this.#warning="Configuração de ambiente inválida."; }
  }
 }
 current() { return {...this.#config}; } // main-process only
 status() { return {mode:this.#config.mode,hasBrapiKey:!!this.#config.brapiKey,hasTwelveKey:!!this.#config.twelveKey,
   secureStorage:this.secure(),persistent:this.#persistent,warning:this.#warning}; }
 update(patch) {
  const run=this.#queue.then(async()=>{
   validate(patch); const next={...this.#config,...patch}; const secure=this.secure();
   const row={version:1,mode:next.mode};
   if(secure) row.encrypted=this.#crypto.encryptString(JSON.stringify({brapiKey:next.brapiKey,twelveKey:next.twelveKey})).toString("base64");
   await fs.mkdir(path.dirname(this.#file),{recursive:true});
   const temporary=this.#file+".tmp";
   try { await fs.writeFile(temporary,JSON.stringify(row),{mode:0o600}); await fs.rename(temporary,this.#file); }
   finally { await fs.rm(temporary,{force:true}).catch(()=>{}); }
   this.#config=next; this.#persistent=secure; this.#warning=null;
   return this.status();
  });
  this.#queue=run.catch(()=>{}); return run;
 }
}
export async function createConnections({directory,encryption,env={},trusted,dependencies={}}) {
 const store=new ConnectionStore({directory,encryption}); await store.load(env);
 let revision=0;
 const health={};
 const status=()=>({...store.status(),health:structuredClone(health)});
 const build=(config=store.current())=>createMarketBackend({MARKET_DATA_PROVIDER:config.mode,BRAPI_API_KEY:config.brapiKey,TWELVE_DATA_API_KEY:config.twelveKey,MARKET_DATA_DEBUG:env.MARKET_DATA_DEBUG},dependencies);
 let backend=build(), handler=createMarketHandler(backend,trusted);
 let testing=false;
 return {
  market: async(event,request)=>{
   const current=revision, reply=await handler(event,request);
   return current===revision ? reply : {ok:false,error:{code:"PROVIDER_ERROR"}};
  },
  credentials: async(event,request)=>{
   if(!trusted(event) || !request || typeof request!=="object" || Array.isArray(request) || Object.keys(request).some(k=>!["method","data"].includes(k))) return {ok:false,error:{code:"INVALID_REQUEST"}};
   try {
    if(request.method==="status" && request.data===undefined) return {ok:true,data:status()};
    if(request.method==="save") {
     await store.update(request.data);
     for(const provider of ["brapi","twelve"]) if(Object.hasOwn(request.data,provider+"Key")) delete health[provider];
     backend=build(); handler=createMarketHandler(backend,trusted); revision++;
     return {ok:true,data:status()};
    }
    if(request.method==="test" && ["brapi","twelve"].includes(request.data)) {
     if(testing) return {ok:false,error:{code:"RATE_LIMIT"}};
     testing=true;
     const started=revision, provider=request.data;
     try {
      const config=store.current();
      if(provider === "twelve" && !config.twelveKey) throw new MarketDataError("AUTH_ERROR");
      const probe=build({...config,mode:provider});
      const asset=catalog.find(a=>a.symbol===(provider === "brapi"?"PETR4":"AAPL"));
      const quote=await probe.service.getQuote(asset);
      if(started !== revision) return {ok:false,error:{code:"PROVIDER_ERROR"}};
      health[provider]={ok:true,checkedAt:Date.now()};
      return {ok:true,data:{symbol:asset.symbol,timestamp:quote.timestamp}};
     } catch(error) {
      const code=normalizeError(error).code;
      if(started === revision) health[provider]={ok:false,code,checkedAt:Date.now()};
      return {ok:false,error:{code}};
     } finally {testing=false;}
    }
    return {ok:false,error:{code:"INVALID_REQUEST"}};
   } catch(error) {
    return {ok:false,error:{code:error.message==="INVALID_REQUEST"?"INVALID_REQUEST":error.code?normalizeError(error).code:"PROVIDER_ERROR"}};
   }
  },
 };
}
