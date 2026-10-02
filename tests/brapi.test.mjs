import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BrapiProvider, brapiSymbol } from '../providers/BrapiProvider.mjs';
import { BrapiHttpClient } from '../providers/http.mjs';
import { MarketDataService } from '../core/market-data/MarketDataService.mjs';
import { createMarketBackend, createMarketHandler } from '../desktop/market-data.mjs';
import { demoMarket } from '../providers/mock-data.mjs';
import { Quote, Candle } from '../core/index.mjs';
const petr = demoMarket.find(r => r.asset.symbol === 'PETR4').asset;
const vale = demoMarket.find(r => r.asset.symbol === 'VALE3').asset;
const wege = demoMarket.find(r => r.asset.symbol === 'WEGE3').asset;
const aapl = demoMarket.find(r => r.asset.symbol === 'AAPL').asset;
const json = (data, status = 200, headers={}) => new Response(JSON.stringify(data), {status, headers});
const envelope = (symbol, data) => ({ results: [{ symbol, requestedSymbol: symbol, changed: false, data }] });
const price = { currency: 'BRL', regularMarketPrice: 40, regularMarketPreviousClose: 32, regularMarketTime: '2026-10-01T15:00:00Z' };
const quote = symbol => envelope(symbol, price);
const fails = (promise, code) => assert.rejects(promise, e => e.code === code);
const period = {timeframe:'1d', start:'2026-09-01', end:'2026-09-30'};
const history = bars => envelope('PETR4', { usedInterval: '1d', historicalDataPrice: bars });
const bar = {date: Date.parse('2026-09-10T03:00:00Z') / 1000, open:30, high:40, low:25, close:35, volume:100};

test('brapi sandbox uses v2 quotes and original timestamp, no token or foreign symbols', async () => {
 let calls=0;
 const p=new BrapiProvider({fetchImpl: async (url, options) => {
  calls++; assert.equal(url.origin,'https://brapi.dev'); assert.equal(url.pathname,'/api/v2/stocks/quote');
  assert.equal(url.searchParams.get('symbols'),'PETR4'); assert.deepEqual(options.headers,{}); assert.equal(options.redirect,'error');
  return json(quote('PETR4'));
 }});
 const q=await p.getQuote(petr); assert.ok(q instanceof Quote); assert.equal(q.price,40); assert.equal(q.percentageChange,25);
 assert.equal(q.timestamp,price.regularMarketTime.replace('Z','.000Z'));
 assert.equal(brapiSymbol(petr),'PETR4'); await fails(p.getQuote(aapl),'INVALID_SYMBOL'); await fails(p.getQuote(wege),'AUTH_ERROR'); assert.equal(calls,1);
});
test('brapi token stays in headers; free batch and concurrent operations serialize and cache', async () => {
 let active=0, max=0, calls=0;
 const p=new BrapiProvider({apiKey:'test-secret',fetchImpl:async (url,options) => {
  calls++; active++; max=Math.max(max,active); assert.equal(options.headers.Authorization,'Bearer test-secret'); assert.ok(!url.href.includes('test-secret'));
  await new Promise(r=>setTimeout(r,2)); active--; return json(quote(url.searchParams.get('symbols')));
 }});
 const service=new MarketDataService(p);
 const [q, single]=await Promise.all([service.getQuotes([petr,vale]),service.getQuote(wege)]);
 assert.equal(q.size,2); assert.equal(single.asset.id,wege.id); assert.equal(max,1); assert.equal(calls,3);
 await service.getQuote(petr); assert.equal(calls,3);
});
test('brapi rejects missing data, wrong identity, silent renames and malformed quotes', async () => {
 for(const body of [{results:[]}, quote('VALE3'), {results:[{...quote('PETR4').results[0],changed:true}]}, envelope('PETR4',{...price,regularMarketPrice:null}), envelope('PETR4',{...price,currency:'USD'}), envelope('PETR4',{...price,regularMarketTime:null})]) {
  await fails(new BrapiProvider({fetchImpl:async()=>json(body)}).getQuote(petr),'INVALID_RESPONSE');
 }
});
test('brapi historical v2 returns validated chronological OHLCV without invented values', async () => {
 const p=new BrapiProvider({fetchImpl:async url=> {
  assert.equal(url.pathname,'/api/v2/stocks/historical'); assert.equal(url.searchParams.get('startDate'),period.start); assert.equal(url.searchParams.get('interval'),'1d');
  return json(history([{...bar,date:bar.date+86400},bar]));
 }});
 const bars=await p.getHistory(petr,period); assert.equal(bars.length,2); assert.ok(bars[0] instanceof Candle); assert.equal(bars[0].close,35);
 for(const bad of [{...bar, high:1},{...bar,volume:null},{...bar,date:0},{...bar,date:bar.date-40*86400}])
  await fails(new BrapiProvider({fetchImpl:async()=>json(history([bad]))}).getHistory(petr,period),'INVALID_RESPONSE');
 await fails(new BrapiProvider({fetchImpl:async()=>json(history([bar,bar]))}).getHistory(petr,period),'INVALID_RESPONSE');
});
test('brapi search normalizes B3 assets and excludes unsupported types', async () => {
 const p=new BrapiProvider({fetchImpl:async url => {
  assert.equal(url.pathname,'/api/quote/list'); assert.equal(url.searchParams.get('limit'),'30');
  return json({stocks:[{stock:'PETR4',name:'Petrobras',type:'stock',sector:null},{stock:'BOVA11',name:'ETF',type:'fund',subType:'etf'}, {stock:'ABCD11',name:'FII',type:'fund',subType:'fii'}]});
 }});
 const assets=await p.searchAssets('PET'); assert.deepEqual(assets.map(a=>a.id),['B3:PETR4','B3:BOVA11']); assert.equal(assets[1].assetType,'etf');
 assert.deepEqual(await p.searchAssets(''),[]);
});
test('brapi handles 400, auth, rate limit, server errors and timeout safely', async () => {
 for(const [status,code] of [[400,'INVALID_REQUEST'],[401,'AUTH_ERROR'],[403,'AUTH_ERROR'],[404,'INVALID_SYMBOL'],[429,'RATE_LIMIT'],[500,'PROVIDER_ERROR']]) {
  let calls=0;
  const p=new BrapiProvider({sleep:async()=>{},fetchImpl:async()=>{calls++;return json({message:'secret'},status,{'retry-after':'60'});}});
  await fails(p.getQuote(petr),code); assert.equal(calls,status===500?2:1);
 }
 await fails(new BrapiProvider({timeoutMs:5,fetchImpl:()=>new Promise(()=>{})}).getQuote(petr),'TIMEOUT');
 await fails(new BrapiHttpClient().request('/evil',{}),'INVALID_REQUEST');
});
test('brapi queue skips aborted work and recovers after a failed request', async () => {
 let release, calls=0;
 const p=new BrapiProvider({fetchImpl:async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return json(quote('PETR4'));}});
 const first=p.getQuote(petr); await new Promise(r=>setTimeout(r,0));
 const controller=new AbortController(); const second=p.getQuote(petr,{signal:controller.signal}); controller.abort(); release();
 await first; await fails(second,'TIMEOUT'); await p.getQuote(petr); assert.equal(calls,2);
});
test('combined routes B3 and US independently, without mock fallback or leaking tokens', async () => {
 const hosts=[];
 const backend=createMarketBackend({MARKET_DATA_PROVIDER:'combined',BRAPI_API_KEY:'b-secret',TWELVE_DATA_API_KEY:'t-secret'}, {fetchImpl:async url=>{
  hosts.push(url.hostname);
  if(url.hostname==='brapi.dev')return json({},429,{'retry-after':'60'});
  return json({symbol:'AAPL',exchange:'NASDAQ',currency:'USD',close:'100',previous_close:'80',timestamp:1735848000});
 }});
 assert.equal(backend.info.demo,false); assert.ok(!JSON.stringify(backend.info).includes('secret'));
 const ipc=createMarketHandler(backend,()=>true);
 assert.equal((await ipc({}, {method:'getQuote',args:[petr]})).error.code,'RATE_LIMIT');
 const us=await ipc({}, {method:'getQuote',args:[aapl]}); assert.equal(us.ok,true); assert.equal(us.data.price,100);
 assert.deepEqual(hosts,['brapi.dev','api.twelvedata.com']);
 const alone=createMarketBackend({MARKET_DATA_PROVIDER:'brapi'});
 assert.equal(alone.info.demo,false); await fails(alone.service.getQuote(aapl),'AUTH_ERROR');
 assert.match(alone.info.notice,/Sem token/);
 const missing=createMarketBackend({MARKET_DATA_PROVIDER:'combined'}); assert.equal(missing.info.demo,false); await fails(missing.service.getQuote(aapl),'AUTH_ERROR');
});

test('renderer isolates combined-search rate limits from both quote markets', async () => {
 const finance = await import('../ui/finance.mjs?brapi-isolation-test');
 await finance.initialize({
  info: async () => ({ok:true,data:{provider:'combined',demo:false,quoteBatchSize:1,label:'Combined',notice:null}}),
  searchAssets: async () => ({ok:false,error:{code:'RATE_LIMIT',retryAfterMs:60000}}),
  getQuotes: async assets => ({ok:true,data:assets.map(asset => ({asset,currency:asset.currency,price:40,previousClose:32,timestamp:'2026-10-01T15:00:00Z'}))}),
 });
 await fails(finance.searchAssets('PETR4'),'RATE_LIMIT');
 await finance.refresh();
 assert.deepEqual(finance.status().problems,[]);
 assert.equal(finance.assets.find(a=>a.ticker==='AAPL').price,40);
 assert.equal(finance.assets.find(a=>a.ticker==='PETR4').price,40);
});
