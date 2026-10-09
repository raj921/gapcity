import { createHash } from 'node:crypto';
import { AppError, safeHttpUrl } from './validation';
import type { AnalysisInput, Business, Review } from './types';
import { distanceMeters } from './geo';

type Json=Record<string,unknown>;
export type Fetcher=(input:string|URL,init?:RequestInit)=>Promise<Response>;
const record=(x:unknown):Json=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Json:{};
const number=(x:unknown):number|null=>typeof x==='number'&&Number.isFinite(x)?x:null;
const string=(x:unknown):string=>typeof x==='string'?x:'';
const CACHE_TTL=24*60*60*1000;
const MAX_CACHE_ENTRIES=150;
// ponytail: cache and credit ceiling are per process; use an atomic shared store for an account-wide budget.
type State={calls:number;cache:Map<string,{expires:number;data:Json}>;inflight:Map<string,Promise<Json>>};
const root=globalThis as typeof globalThis&{__gapcitySerp?:State};
const state=root.__gapcitySerp??={calls:0,cache:new Map(),inflight:new Map()};
root.__gapcitySerp=state;
export function liveConfiguration(){return {available:process.env.GAPCITY_LIVE_ENABLED==='true'&&Boolean(process.env.SERPAPI_KEY),protected:process.env.GAPCITY_PUBLIC_LIVE!=='true'&&Boolean(process.env.GAPCITY_LIVE_ACCESS_TOKEN),callsUsed:state.calls,callsLimit:maxCalls()};}
function maxCalls():number{const n=Number(process.env.SERPAPI_MAX_CALLS||60);return Number.isFinite(n)?Math.max(0,Math.min(500,Math.floor(n))):60;}
export function authorizeLive(token:string|null):void{
  if(!liveConfiguration().available)throw new AppError('LIVE_NOT_CONFIGURED','Live search is not configured. Set SERPAPI_KEY and GAPCITY_LIVE_ENABLED on the server, or use the sample demo.',503);
  const publicLive=process.env.GAPCITY_PUBLIC_LIVE==='true';
  const expected=publicLive?undefined:process.env.GAPCITY_LIVE_ACCESS_TOKEN;
  if(expected){
    // Compare fixed-length hashes so token content does not alter comparison time.
    const supplied=createHash('sha256').update(token||'').digest();
    const required=createHash('sha256').update(expected).digest();
    let mismatch=0;for(let i=0;i<required.length;i++)mismatch|=supplied[i]^required[i];
    if(mismatch!==0)throw new AppError('LIVE_ACCESS_REQUIRED','Enter the live access code supplied by the app owner.',401);
  }else if(process.env.NODE_ENV==='production'&&!publicLive)throw new AppError('LIVE_ACCESS_NOT_CONFIGURED','Live search requires public access to be enabled or a server-side access code. The sample demo remains available.',503);
  if(process.env.NODE_ENV==='production'&&!process.env.GAPCITY_SIGNING_SECRET)throw new AppError('SIGNING_NOT_CONFIGURED','Live search requires a signing secret on the server.',503);
}

export async function serpRequest(params:Record<string,string>,fetcher:Fetcher=fetch):Promise<Json>{
  const key=process.env.SERPAPI_KEY;
  if(!key)throw new AppError('LIVE_NOT_CONFIGURED','A SerpApi key is required on the server.',503);
  const stable=Object.entries(params).sort(([a],[b])=>a.localeCompare(b));
  const cacheKey=createHash('sha256').update(JSON.stringify(stable)+createHash('sha256').update(key).digest('hex')).digest('hex');
  const cached=state.cache.get(cacheKey);
  if(cached&&cached.expires>Date.now())return cached.data;
  const pending=state.inflight.get(cacheKey);if(pending)return pending;
  if(state.calls>=maxCalls())throw new AppError('CREDIT_LIMIT','The live search budget for this server process is exhausted. Use saved data or the sample demo.',429);
  // Reserve an attempt before awaiting anything. Failed/time-out calls still count.
  state.calls++;
  const task=(async()=>{
    const url=new URL('https://serpapi.com/search.json');
    for(const [k,v]of stable)url.searchParams.set(k,v);
    url.searchParams.set('api_key',key);
    let response:Response;
    try{response=await fetcher(url,{signal:AbortSignal.timeout(20_000),cache:'no-store'});}
    catch{throw new AppError('SEARCH_UNAVAILABLE','SerpApi did not respond in time. Try again later. Your current result is preserved.',502);}
    if(!response.ok)throw new AppError('SEARCH_UNAVAILABLE',`SerpApi returned an error (${response.status}). Check the server key, account credits and service status.`,502);
    let json:Json;try{json=record(await response.json());}catch{throw new AppError('INVALID_UPSTREAM','SerpApi returned an unreadable response.',502);}
    if(json.error)throw new AppError('SEARCH_UNAVAILABLE','SerpApi could not complete this search. Check your key and account credits.',502);
    state.cache.delete(cacheKey);
    if(state.cache.size>=MAX_CACHE_ENTRIES)state.cache.delete(state.cache.keys().next().value!);
    state.cache.set(cacheKey,{expires:Date.now()+CACHE_TTL,data:json});return json;
  })();
  state.inflight.set(cacheKey,task);
  try{return await task;}finally{state.inflight.delete(cacheKey);}
}

export function normalizeBusiness(value:unknown,input:AnalysisInput):Business|null{
  const row=record(value),gps=record(row.gps_coordinates);
  const lat=number(gps.latitude),lng=number(gps.longitude);
  if(lat===null||lng===null||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  const placeId=string(row.place_id).slice(0,200),dataId=string(row.data_id).slice(0,200);
  const name=string(row.title).trim().slice(0,120);if(!name)return null;
  const location={lat,lng};
  const id=placeId||dataId||createHash('sha256').update(`${name.toLowerCase()}|${lat.toFixed(5)}|${lng.toFixed(5)}`).digest('hex').slice(0,24);
  const rating=number(row.rating),reviews=number(row.reviews);
  const maps=new URL('https://www.google.com/maps/search/');maps.searchParams.set('api','1');maps.searchParams.set('query',`${name} ${lat},${lng}`);if(placeId)maps.searchParams.set('query_place_id',placeId);
  const hours=record(row.operating_hours);
  const openState=string(row.open_state)||string(hours.currently)||null;
  const mapsUrl=maps.href.length<=1200?maps.href:`https://www.google.com/maps/?q=${lat},${lng}`;
  return {id,name,location,rating:rating!==null&&rating>=0&&rating<=5?rating:null,reviewCount:reviews!==null&&reviews>=0?Math.floor(reviews):null,address:string(row.address).slice(0,240),category:(string(row.type)||input.category).slice(0,80),distanceMeters:Math.round(distanceMeters(input.center,location)),mapsUrl,openState:openState?.slice(0,100)||null,price:string(row.price).slice(0,40)||null,...(dataId?{dataId}:{}),...(placeId?{placeId}:{})};
}

export async function searchBusinesses(input:AnalysisInput,fetcher:Fetcher=fetch){
  const requested=Number(process.env.SERPAPI_SEARCH_PAGES||3);
  const pageLimit=Number.isFinite(requested)?Math.max(1,Math.min(3,Math.floor(requested))):3;
  const all=new Map<string,Business>();let rawCount=0,duplicates=0,missingCoordinates=0,pages=0,truncated=false;
  for(let page=0;page<pageLimit;page++){
    const json=await serpRequest({engine:'google_maps',type:'search',q:`${input.category} near me`,ll:`@${input.center.lat},${input.center.lng},${Math.max(1000,input.radiusMeters*2.4)}m`,nearby:'true',hl:'en',start:String(page*20)},fetcher);
    pages++;
    const rows=Array.isArray(json.local_results)?json.local_results:[];rawCount+=rows.length;
    let added=0;
    for(const row of rows){const b=normalizeBusiness(row,input);if(!b){missingCoordinates++;continue;}if(all.has(b.id)){duplicates++;continue;}all.set(b.id,b);added++;}
    if(rows.length===0||added===0)break;
    const pagination=record(json.serpapi_pagination);
    const more=Boolean(pagination.next||pagination.next_page_token)||rows.length>=20;
    if(!more)break;if(page===pageLimit-1)truncated=true;
  }
  const inside=[...all.values()].filter(b=>distanceMeters(input.center,b.location)<=input.radiusMeters).sort((a,b)=>a.distanceMeters-b.distanceMeters||a.id.localeCompare(b.id));
  return {businesses:inside,coverage:{rawCount,outsideRadius:all.size-inside.length,missingCoordinates,duplicates,pages,truncated}};
}

export function normalizeReview(value:unknown,business:Business):Review|null{
  const row=record(value);
  const text=string(row.snippet)||string(record(row.extracted_snippet).original);
  if(!text.trim())return null;
  const rating=number(row.rating);
  const fallback=business.mapsUrl;
  const iso=string(row.iso_date)||string(row.date_iso);
  const parsed=iso?new Date(iso):null;
  const isoDate=parsed&&!Number.isNaN(parsed.getTime())?parsed.toISOString():null;
  const rawId=string(row.review_id);
  return {id:rawId||createHash('sha256').update(`${business.id}|${text}|${string(row.date)}`).digest('hex').slice(0,32),businessId:business.id,rating:rating!==null&&rating>=0&&rating<=5?rating:null,text:text.slice(0,2000),date:string(row.date)||null,isoDate,url:safeHttpUrl(row.link,fallback)};
}
export async function fetchBusinessReviews(business:Business,fetcher:Fetcher=fetch):Promise<Review[]>{
  if(!business.dataId&&!business.placeId)return [];
  const collected=new Map<string,Review>();let nextToken='';
  for(let page=0;page<2;page++){
    const params:Record<string,string>={engine:'google_maps_reviews',hl:'en',sort_by:'newestFirst',...(business.dataId?{data_id:business.dataId}:{place_id:business.placeId!})};
    // Initial page returns eight reviews; num is valid only for a subsequent page.
    if(nextToken){params.next_page_token=nextToken;params.num='20';}
    const json=await serpRequest(params,fetcher);
    const rows=Array.isArray(json.reviews)?json.reviews:[];
    for(const row of rows){const r=normalizeReview(row,business);if(r)collected.set(r.id,r);}
    nextToken=string(record(json.serpapi_pagination).next_page_token);
    if(!nextToken||rows.length===0)break;
  }
  return [...collected.values()];
}
export function resetSerpStateForTests(){state.calls=0;state.cache.clear();state.inflight.clear();}
