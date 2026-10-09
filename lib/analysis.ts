import { randomUUID } from 'node:crypto';
import { demoBusinesses,demoReviews,VIJAYAWADA } from './demo';
import { distanceMeters } from './geo';
import { buildZones } from './scoring';
import { fetchBusinessReviews,searchBusinesses } from './serpapi';
import { summarizeEvidence } from './themes';
import { AppError } from './validation';
import { restoreAnalysis,signAnalysis } from './tickets';
import type { Analysis,AnalysisInput,Evidence } from './types';
const TTL=24*60*60*1000;
type Store={analyses:Map<string,Analysis>;evidence:Map<string,Evidence>;inflight:Map<string,Promise<Evidence>>};
const root=globalThis as typeof globalThis&{__gapcityStore?:Store};
const store=root.__gapcityStore??={analyses:new Map(),evidence:new Map(),inflight:new Map()};root.__gapcityStore=store;
export async function createAnalysis(input:AnalysisInput):Promise<Analysis>{
  if(input.mode==='demo'&&distanceMeters(input.center,VIJAYAWADA)>10_000)throw new AppError('DEMO_AREA','The sample dataset is around Vijayawada. Move the pin back to Vijayawada, or use configured live search.');
  const raw=input.mode==='demo'?demoBusinesses(input):null;
  const result=raw?{businesses:raw.filter(b=>distanceMeters(input.center,b.location)<=input.radiusMeters),coverage:{rawCount:raw.length,outsideRadius:raw.filter(b=>distanceMeters(input.center,b.location)>input.radiusMeters).length,missingCoordinates:0,duplicates:0,pages:0,truncated:false}}:await searchBusinesses(input);
  const businesses=result.businesses;
  const rated=businesses.filter(b=>b.rating!==null);
  const zones=buildZones(input,businesses);
  const fetchedAt=new Date().toISOString();
  const analysis:Analysis={id:randomUUID(),ticket:'',input,source:input.mode==='demo'?'synthetic':'serpapi',fetchedAt,expiresAt:new Date(Date.now()+TTL).toISOString(),businesses,zones,topZoneIds:zones.filter(z=>z.rank!==null).sort((a,b)=>a.rank!-b.rank!).map(z=>z.id),summary:{businessCount:businesses.length,ratedCount:rated.length,averageRating:rated.length?rated.reduce((s,b)=>s+b.rating!,0)/rated.length:null,totalReviews:businesses.reduce((s,b)=>s+(b.reviewCount||0),0)},coverage:result.coverage,caveats:[
    ...(raw?['Sample businesses and reviews are invented. Map geography is independent and may be real.']:[]),
    'Search results are a bounded sample, not a complete census of businesses in this area.',
    'Unlisted businesses and missing map data are not proof of an opportunity.',
    'Research scores use ratings and review counts, not footfall, rent, revenue or population.',
    'Building heights come from map data. Business ratings never change geographic building heights.'
  ]};
  analysis.ticket=signAnalysis(analysis);
  // Bound memory and remove evidence belonging to evicted analyses.
  for(const [id,item]of store.analyses)if(new Date(item.expiresAt).getTime()<Date.now())evict(id);
  if(store.analyses.size>=60)evict(store.analyses.keys().next().value!);
  store.analyses.set(analysis.id,analysis);return analysis;
}
function evict(id:string){store.analyses.delete(id);for(const [key,e]of store.evidence)if(e.analysisId===id)store.evidence.delete(key);}
export function getAnalysis(id:string,ticket?:string):Analysis{
  let item=store.analyses.get(id);
  if(!item&&ticket){item=restoreAnalysis(ticket);if(item.id!==id)throw new AppError('INVALID_TICKET','This snapshot does not match the analysis.');}
  if(!item||new Date(item.expiresAt).getTime()<=Date.now())throw new AppError('ANALYSIS_EXPIRED','This analysis is no longer on this server. Run the search again to reload it.',410);
  return item;
}
export async function getEvidence(analysisId:string,zoneId?:string,businessId?:string,ticket?:string):Promise<Evidence>{
  if(Boolean(zoneId)===Boolean(businessId))throw new AppError('INVALID_SELECTION','Choose one zone or business.');
  const analysis=getAnalysis(analysisId,ticket);
  const zone=zoneId?analysis.zones.find(z=>z.id===zoneId):undefined;
  if(zoneId&&!zone)throw new AppError('ZONE_NOT_FOUND','This zone does not belong to the selected analysis.',404);
  const matched=businessId?analysis.businesses.filter(b=>b.id===businessId):analysis.businesses.filter(b=>zone!.businessIds.includes(b.id));
  if(businessId&&!matched.length)throw new AppError('BUSINESS_NOT_FOUND','This business does not belong to the selected analysis.',404);
  const selected=matched.sort((a,b)=>(b.reviewCount||0)-(a.reviewCount||0)).slice(0,3);
  const cacheKey=`${analysisId}|${zoneId||businessId}`;
  const prior=store.evidence.get(cacheKey);if(prior)return prior;
  const pending=store.inflight.get(cacheKey);if(pending)return pending;
  const task=(async()=>{
    // Sequential calls reserve credits predictably and avoid upstream bursts.
    const reviews=[];
    for(const b of selected)reviews.push(...(analysis.source==='synthetic'?demoReviews(b):await fetchBusinessReviews(b)));
    const result=summarizeEvidence(analysisId,zoneId||null,selected,reviews,analysis.source,new Date().toISOString());
    if(store.evidence.size>=180)store.evidence.delete(store.evidence.keys().next().value!);
    store.evidence.set(cacheKey,result);return result;
  })();
  store.inflight.set(cacheKey,task);
  try{return await task;}finally{store.inflight.delete(cacheKey);}
}
export function clearAnalysesForTests(){store.analyses.clear();store.evidence.clear();store.inflight.clear();}
