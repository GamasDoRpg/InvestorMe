import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { ConnectionStore, createConnections } from '../desktop/connections.mjs';
import { emptyWorkspace, migrateWorkspace } from '../ui/workspace.mjs';
import { catalog } from '../core/market/catalog.mjs';
const key=randomBytes(32);
const encryption={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'gnome_libsecret',
 encryptString:plain=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([c.update(plain,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),body]);},
 decryptString:bytes=>{const d=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));d.setAuthTag(bytes.subarray(12,28));return Buffer.concat([d.update(bytes.subarray(28)),d.final()]).toString();}};
async function directory(t){const dir=await mkdtemp(path.join(os.tmpdir(),'investorme-keys-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}

test('keys persist encrypted, survive restart, preserve blank edits and can be removed',async t=>{
 const dir=await directory(t),store=new ConnectionStore({directory:dir,encryption});await store.load();
 assert.equal(store.status().mode,'disabled');
 await store.update({mode:'combined',brapiKey:'b-test-secret',twelveKey:'t-test-secret'});
 const file=await readFile(path.join(dir,'market-connections.json'),'utf8');
 assert.ok(!file.includes('test-secret'));assert.ok(!JSON.stringify(store.status()).includes('test-secret'));
 const next=new ConnectionStore({directory:dir,encryption});await next.load();assert.equal(next.current().twelveKey,'t-test-secret');
 await next.update({mode:'brapi'});assert.equal(next.current().brapiKey,'b-test-secret');
 await next.update({brapiKey:''});assert.equal(next.status().hasBrapiKey,false);
 const final=new ConnectionStore({directory:dir,encryption});await final.load();assert.equal(final.current().brapiKey,'');
});
test('Linux basic_text and unavailable storage never persist plaintext secrets',async t=>{
 for(const secure of (process.platform === "linux" ? [false,true] : [false])){
  const dir=await directory(t),enc={...encryption,isEncryptionAvailable:()=>secure,getSelectedStorageBackend:()=> 'basic_text'};
  const store=new ConnectionStore({directory:dir,encryption:enc});await store.load();await store.update({mode:'twelve',twelveKey:'session-secret'});
  assert.equal(store.status().secureStorage,false);assert.equal(store.status().persistent,false);
  assert.ok(!(await readFile(path.join(dir,'market-connections.json'),'utf8')).includes('session-secret'));
  const next=new ConnectionStore({directory:dir,encryption:enc});await next.load();assert.equal(next.status().hasTwelveKey,false);
 }
});
test('credential store rejects malformed input, retains corrupt file and recovers on explicit save',async t=>{
 const dir=await directory(t),file=path.join(dir,'market-connections.json');await writeFile(file,'invalid');
 const store=new ConnectionStore({directory:dir,encryption});await store.load();assert.ok(store.status().warning);assert.equal(await readFile(file,'utf8'),'invalid');
 for(const patch of [null,[],{mode:'mock'},{mode:undefined},{brapiKey:undefined},{twelveKey:'bad\nkey'},{brapiKey:'x'.repeat(513)},{token:'x'}])await assert.rejects(store.update(patch));
 await store.update({mode:'brapi',brapiKey:'fixed'});assert.equal(store.status().warning,null);
});
test('credential IPC uses fixed probes, rejects untrusted senders and switches providers immediately',async t=>{
 const dir=await directory(t),calls=[];
 const c=await createConnections({directory:dir,encryption,trusted:e=>e.trusted===true,dependencies:{fetchImpl:async(url,options)=>{
  calls.push({host:url.hostname,auth:options.headers.Authorization});
  if(url.hostname==='api.twelvedata.com')return new Response(JSON.stringify({symbol:'AAPL',exchange:'NASDAQ',currency:'USD',close:'100',previous_close:'80',timestamp:1735848000}));
  return new Response(JSON.stringify({results:[{symbol:'PETR4',requestedSymbol:'PETR4',changed:false,data:{currency:'BRL',regularMarketPrice:30,regularMarketPreviousClose:25,regularMarketTime:'2026-10-01T15:00:00Z'}}]}));
 }}});
 assert.equal((await c.credentials({}, {method:'save',data:{mode:'twelve',twelveKey:'leak'}})).ok,false);
 const event={trusted:true};
 assert.equal((await c.credentials(event,{method:'save',data:{mode:'combined',brapiKey:'br-key',twelveKey:'us-key'}})).ok,true);
 for(const p of ['brapi','twelve']) assert.equal((await c.credentials(event,{method:'test',data:p})).ok,true);
 const status=(await c.credentials(event,{method:'status'})).data;
 assert.equal(status.health.brapi.ok,true);assert.equal(status.health.twelve.ok,true);
 assert.ok(Number.isFinite(status.health.brapi.checkedAt));
 assert.deepEqual(calls.map(c=>c.auth),['Bearer br-key','apikey us-key']);
 assert.equal((await c.credentials(event,{method:'test',data:'https://evil.test'})).ok,false);
 assert.ok(!JSON.stringify(await c.credentials(event,{method:'status'})).includes('us-key'));
 const aapl=catalog.find(a=>a.symbol==='AAPL');
 assert.equal((await c.market(event,{method:'getQuote',args:[aapl]})).data.price,100);
 await c.credentials(event,{method:'save',data:{mode:'disabled'}});
 assert.equal((await c.market(event,{method:'getQuote',args:[aapl]})).error.code,'AUTH_ERROR');
});
test('credential tests report auth failure safely and stale requests cannot restore old connection data',async t=>{
 const dir=await directory(t);let release;
 const c=await createConnections({directory:dir,encryption,trusted:()=>true,dependencies:{fetchImpl:()=>new Promise(r=>{release=()=>r(new Response('{}',{status:401}));})}});
 await c.credentials({}, {method:'save',data:{mode:'twelve',twelveKey:'unit-secret'}});
 const pending=c.market({}, {method:'getQuote',args:[catalog.find(a=>a.symbol==='AAPL')]});
 await new Promise(r=>setTimeout(r,0));await c.credentials({}, {method:'save',data:{mode:'disabled',twelveKey:''}});release();
 assert.equal((await pending).error.code,'PROVIDER_ERROR');
 assert.equal((await c.credentials({}, {method:'test',data:'twelve'})).error.code,'AUTH_ERROR');
 assert.equal((await c.credentials({}, {method:'status'})).data.health.twelve.ok,false);
 await c.credentials({}, {method:'save',data:{twelveKey:'replacement'}});
 assert.equal((await c.credentials({}, {method:'status'})).data.health.twelve,undefined);
});
test('workspace starts empty and migration strips exact examples while preserving user edits and scripts',()=>{
 const empty=emptyWorkspace();assert.equal(empty.cash,0);for(const field of ['holdings','strategies','models','alerts','backtests','watchlist'])assert.deepEqual(empty[field],[]);
 const old={version:1,cash:8400,holdings:[{id:'h1',ticker:'PETR4',quantity:300,cost:28.5},{id:'h2',ticker:'VALE3',quantity:7,cost:54.2}],strategies:[],
 models:[{id:'mine',name:'Edited',type:'X',status:'ready',lastRun:'2025-01-01'}],backtests:[{id:'mine',name:'Config',start:'2025-01-01',metrics:{profit:50}}],scripts:[{content:'USER SOURCE'}],theme:'light'};
 const migrated=migrateWorkspace(old);assert.equal(migrated.cash,0);assert.equal(migrated.holdings.length,1);assert.equal(migrated.holdings[0].quantity,7);assert.equal(migrated.models[0].lastRun,undefined);assert.equal(migrated.backtests[0].status,'draft');assert.equal(migrated.backtests[0].metrics,undefined);
 assert.deepEqual(migrated.scripts,old.scripts);assert.equal(migrated.theme,'light');assert.deepEqual(migrateWorkspace(migrated),migrated);assert.equal(old.holdings.length,2);
});
