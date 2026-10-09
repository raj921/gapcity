import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readJson } from '../lib/http';
import { distanceMeters,offsetToCoordinates,coordinatesToOffset,circleCoordinates,clippedCell,normalizeMapPin } from '../lib/geo';
import { inputSchema,evidenceSchema,AppError } from '../lib/validation';
import { createAnalysis,getEvidence,getAnalysis,clearAnalysesForTests } from '../lib/analysis';
import { VIJAYAWADA,demoBusinesses } from '../lib/demo';
import { buildZones } from '../lib/scoring';
import { restoreAnalysis } from '../lib/tickets';
import { summarizeEvidence } from '../lib/themes';
import { normalizeBusiness,normalizeReview,searchBusinesses,fetchBusinessReviews,serpRequest,resetSerpStateForTests,authorizeLive,liveConfiguration } from '../lib/serpapi';
import type { AnalysisInput,Business,Review } from '../lib/types';

const input:AnalysisInput={category:'Cafes',center:VIJAYAWADA,radiusMeters:1500,mode:'demo'};
function business(id:string,east:number,north:number,rating:number|null=4.2,count:number|null=100):Business{
  const location=offsetToCoordinates(input.center,east,north);return {id,name:id,location,rating,reviewCount:count,address:'Example address',category:'Cafe',distanceMeters:distanceMeters(input.center,location),mapsUrl:'https://www.google.com/maps',openState:null,price:null,placeId:`place-${id}`};
}
test('Haversine uses metres, includes centre and is symmetric',()=>{
  assert.equal(distanceMeters(VIJAYAWADA,VIJAYAWADA),0);
  assert.ok(Math.abs(distanceMeters({lat:0,lng:0},{lat:0,lng:1})-111194.9266)<.1);
  const point=offsetToCoordinates(VIJAYAWADA,300,0);assert.ok(Math.abs(distanceMeters(VIJAYAWADA,point)-300)<.1);assert.equal(distanceMeters(VIJAYAWADA,point),distanceMeters(point,VIJAYAWADA));
});
test('map pins wrap world copies and clamp to the supported search latitude',()=>{
  assert.deepEqual(normalizeMapPin({lat:85,lng:440}),{lat:70,lng:80});
  assert.deepEqual(normalizeMapPin({lat:-85,lng:-440}),{lat:-70,lng:-80});
  const pin=normalizeMapPin(VIJAYAWADA);
  assert.ok(distanceMeters(VIJAYAWADA,pin)<.001);
  assert.equal(inputSchema.safeParse({...input,center:normalizeMapPin({lat:88,lng:541})}).success,true);
});
test('nearby listings remain in their analysis cell across the date line',()=>{
  const center={lat:0,lng:179.9999};
  const point=normalizeMapPin(offsetToCoordinates(center,1000,0));
  assert.ok(Math.abs(coordinatesToOffset(center,point)[0]-1000)<.001);
  const rows=[0,20,-20].map((east,i)=>({...business(`dateline-${i}`,0,0),location:normalizeMapPin(offsetToCoordinates(center,east,0))}));
  assert.equal(buildZones({...input,center},rows).filter(z=>z.score!==null).length,1);
});
test('radius circle is closed and geographic ring vertices use the requested distance',()=>{
  const circle=circleCoordinates(VIJAYAWADA,400);assert.equal(circle.length,97);
  for(const [lng,lat]of circle)assert.ok(Math.abs(distanceMeters(VIJAYAWADA,{lat,lng})-400)<.001);
  assert.ok(Math.abs(circle[0][0]-circle.at(-1)![0])<1e-10);
});
test('boundary cells are clipped and cells outside the circle disappear',()=>{
  const polygon=clippedCell(VIJAYAWADA,400,400,400,500);assert.ok(polygon.length>=4);
  for(const [lng,lat]of polygon)assert.ok(distanceMeters(VIJAYAWADA,{lat,lng})<=500.1);
  assert.equal(clippedCell(VIJAYAWADA,5000,5000,400,500).length,0);
  for(const zone of buildZones({...input,radiusMeters:500},[]))assert.ok(distanceMeters(input.center,zone.center)<=500.1,'zone markers stay inside clipped geographic cells');
});
test('invalid inputs cannot reach an upstream call',()=>{
  assert.equal(inputSchema.safeParse({...input,radiusMeters:0}).success,false);
  assert.equal(inputSchema.safeParse({...input,radiusMeters:5001}).success,false);
  assert.equal(inputSchema.safeParse({...input,radiusMeters:NaN}).success,false);
  assert.equal(inputSchema.safeParse({...input,center:{lat:91,lng:80}}).success,false);
  assert.equal(inputSchema.safeParse({...input,category:'https://evil.example'}).success,false);
  assert.equal(evidenceSchema.safeParse({analysisId:'a',zoneId:'z',businessId:'b'}).success,false);
});
test('empty and sparse cells are unscored; no demand is inferred from missing listings',()=>{
  const empty=buildZones(input,[]);assert.ok(empty.length>0);assert.ok(empty.every(z=>z.score===null));
  const sparse=buildZones(input,[business('a',0,0),business('b',30,30)]);assert.ok(sparse.every(z=>z.score===null));
});
test('every searched circle has an honest, inspectable area shortlist',async()=>{
  for(const center of [VIJAYAWADA,{lat:51.5,lng:0},{lat:0,lng:179.9999}])for(const radiusMeters of [100,200,500,1500,5000]){
    const zones=buildZones({...input,center,radiusMeters},[]);
    const selected=zones.filter(z=>z.rank!==null);
    assert.equal(selected.length,1,'An empty search gets one centre-based site-visit starting point');
    assert.equal(selected[0].score,null,'Missing listings must not manufacture a score');
    assert.match(selected[0].reason,/no listings/i);
    assert.ok(distanceMeters(center,selected[0].center)<1);
    for(const [lng,lat]of selected[0].polygon)assert.ok(distanceMeters(center,{lat,lng})<=radiusMeters+.1);
  }
  const rows=[business('sparse',0,0,null,null),business('other',800,0,4,5)];
  const sparse=buildZones(input,rows).filter(z=>z.rank!==null);
  assert.equal(sparse.length,2);assert.ok(sparse.every(z=>z.competitorCount>0&&z.score===null));
  const mixed=buildZones(input,[business('a',0,0),business('b',30,0),business('c',-30,0),rows[1]]).filter(z=>z.rank!==null).sort((a,b)=>a.rank!-b.rank!);
  assert.ok(mixed[0].score!==null);assert.equal(mixed[1].score,null);
  const analysis=await createAnalysis({...input,radiusMeters:100});
  assert.equal(analysis.topZoneIds.length,1);
  const restored=restoreAnalysis(analysis.ticket);assert.deepEqual(restored.topZoneIds,analysis.topZoneIds);
  const evidence=await getEvidence(analysis.id,analysis.topZoneIds[0],undefined,analysis.ticket);
  assert.equal(evidence.sampleSize,0);assert.equal(evidence.businesses.length,0);
});
test('ratings need review support, and large review counts cannot make an unbounded score',()=>{
  const weak=[business('a',0,0,3,100),business('b',20,20,3.1,100),business('c',-20,-20,3.2,100)];
  const strong=weak.map(b=>({...b,rating:4.8}));
  const low=buildZones(input,weak).find(z=>z.businessIds.length===3)!;
  const high=buildZones(input,strong).find(z=>z.businessIds.length===3)!;
  assert.ok(low.score!>high.score!);
  const noEvidence=buildZones(input,weak.map(b=>({...b,reviewCount:2})));assert.ok(noEvidence.every(z=>z.score===null));
  for(const z of buildZones(input,weak.map(b=>({...b,reviewCount:1_000_000}))))if(z.score!==null)assert.ok(z.score>=0&&z.score<=100);
});
test('demo radius filters exact geographic distances, changes category and labels synthetic data',async()=>{
  const a=await createAnalysis({...input,radiusMeters:400});
  assert.equal(a.source,'synthetic');assert.ok(a.businesses.length>0);assert.ok(a.businesses.every(b=>distanceMeters(input.center,b.location)<=400));
  assert.ok(a.businesses.every(b=>b.name.startsWith('Sample')));assert.equal(a.coverage.pages,0);
  const salon=demoBusinesses({...input,category:'Barbershops'});assert.ok(salon.every(b=>b.category==='Barbershops'));
  await assert.rejects(()=>createAnalysis({...input,center:{lat:51.5,lng:0}}),e=>e instanceof AppError&&e.code==='DEMO_AREA');
});
test('signed snapshot restores evidence across instances and refuses tampering',async()=>{
  const a=await createAnalysis(input);assert.equal(restoreAnalysis(a.ticket).id,a.id);
  clearAnalysesForTests();assert.equal(getAnalysis(a.id,a.ticket).businesses.length,a.businesses.length);
  const evidence=await getEvidence(a.id,a.topZoneIds[0],undefined,a.ticket);assert.equal(evidence.status,'sample_only');assert.ok(evidence.reviews.length>=10);
  const [body,signature]=a.ticket.split('.');const changed=JSON.parse(Buffer.from(body,'base64url').toString());changed.input.radiusMeters=100;
  assert.throws(()=>restoreAnalysis(`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`),e=>e instanceof AppError&&e.code==='INVALID_TICKET');
});
test('unknown business identifiers cannot turn into arbitrary review calls',async()=>{
  const a=await createAnalysis(input);await assert.rejects(()=>getEvidence(a.id,undefined,'not-in-analysis',a.ticket),e=>e instanceof AppError&&e.code==='BUSINESS_NOT_FOUND');
  await assert.rejects(()=>getEvidence(a.id,'missing-zone',undefined,a.ticket),e=>e instanceof AppError&&e.code==='ZONE_NOT_FOUND');
});
test('a tiny review sample does not produce a strong recommendation',()=>{
  const b=business('a',0,0);const r:Review={id:'r',businessId:b.id,rating:2,text:'The service was slow.',date:null,isoDate:null,url:b.mapsUrl};
  const result=summarizeEvidence('a',null,[b],[r],'serpapi',new Date().toISOString());assert.equal(result.status,'insufficient_evidence');assert.match(result.recommendation,/too few/i);
});
test('theme matches are separated by rating and evidence links stay attached',()=>{
  const b=business('a',0,0),c=business('b',40,0);
  const reviews:Review[]=Array.from({length:12},(_,i)=>({id:`r${i}`,businessId:i%2?b.id:c.id,rating:i<6?2:5,text:i<6?'The wait was long and service was slow.':'Quick service and clean space.',date:null,isoDate:null,url:b.mapsUrl}));
  const e=summarizeEvidence('a',null,[b,c],reviews,'serpapi',new Date().toISOString());assert.equal(e.complaints.find(t=>t.key==='service')?.count,6);assert.equal(e.complaints.find(t=>t.key==='service')?.businessCount,2);assert.ok(e.strengths.find(t=>t.key==='service'));assert.equal(e.status,'evidence_available');
});
test('normalize coordinates, preserve missing metrics and never use search position as a location',()=>{
  assert.equal(normalizeBusiness({title:'Missing coordinate',position:1},input),null);
  const b=normalizeBusiness({title:'Real Listing',position:99,place_id:'abc',gps_coordinates:{latitude:16.5,longitude:80.65}},input)!;
  assert.equal(b.rating,null);assert.equal(b.reviewCount,null);assert.deepEqual(b.location,{lat:16.5,lng:80.65});assert.equal(b.id,'abc');
  const review=normalizeReview({snippet:'Example',rating:4,link:'javascript:alert(1)',iso_date:'not-a-date'},b)!;assert.equal(review.url,b.mapsUrl);assert.equal(review.isoDate,null);
});
test('upstream cache coalesces identical requests, counts failures and enforces the hard budget',async()=>{
  resetSerpStateForTests();process.env.SERPAPI_KEY='test-key-never-send';process.env.SERPAPI_MAX_CALLS='2';let count=0;
  const fetcher=async()=>{count++;await new Promise(resolve=>setTimeout(resolve,5));return Response.json({ok:true});};
  await Promise.all([serpRequest({engine:'google_maps',q:'test'},fetcher),serpRequest({q:'test',engine:'google_maps'},fetcher)]);assert.equal(count,1);
  await assert.rejects(()=>serpRequest({engine:'google_maps',q:'error'},async()=>{throw new Error('api_key=SECRET');}),e=>e instanceof AppError&&!e.message.includes('SECRET'));
  await assert.rejects(()=>serpRequest({engine:'google_maps',q:'third'},fetcher),e=>e instanceof AppError&&e.code==='CREDIT_LIMIT');assert.equal(count,1);
  delete process.env.SERPAPI_KEY;delete process.env.SERPAPI_MAX_CALLS;resetSerpStateForTests();
});
test('search deduplicates pages and drops out-of-radius or ungeocoded results',async()=>{
  process.env.SERPAPI_KEY='test-key';resetSerpStateForTests();
  const rows=[{title:'Nearby',place_id:'one',gps_coordinates:{latitude:VIJAYAWADA.lat,longitude:VIJAYAWADA.lng},rating:4,reviews:100},{title:'Far',place_id:'two',gps_coordinates:{latitude:17,longitude:81}},{title:'No GPS',place_id:'three'}];
  let calls=0;const result=await searchBusinesses({...input,mode:'live'},async url=>{const u=new URL(url);assert.equal(u.searchParams.get('engine'),'google_maps');assert.equal(u.searchParams.get('nearby'),'true');assert.ok(u.searchParams.get('ll')?.startsWith('@16.5062,80.648,'));assert.ok(!u.searchParams.has('radius'));calls++;return Response.json({local_results:rows,serpapi_pagination:{next:'next'}});});
  assert.equal(calls,2);assert.equal(result.businesses.length,1);assert.equal(result.coverage.outsideRadius,1);assert.equal(result.coverage.duplicates,2);assert.equal(result.coverage.missingCoordinates,2);
  delete process.env.SERPAPI_KEY;resetSerpStateForTests();
});
test('reviews use newest sorting, token pagination and num only after the first page',async()=>{
  process.env.SERPAPI_KEY='test-key';resetSerpStateForTests();let calls=0;const b=business('a',0,0);
  const reviews=await fetchBusinessReviews(b,async url=>{const u=new URL(url);assert.equal(u.searchParams.get('sort_by'),'newestFirst');if(calls===0){assert.equal(u.searchParams.has('num'),false);calls++;return Response.json({reviews:[{review_id:'r1',snippet:'One',rating:4}],serpapi_pagination:{next_page_token:'next-token'}});}assert.equal(u.searchParams.get('num'),'20');assert.equal(u.searchParams.get('next_page_token'),'next-token');calls++;return Response.json({reviews:[{review_id:'r1',snippet:'One',rating:4},{review_id:'r2',snippet:'Two',rating:3}]});});
  assert.equal(calls,2);assert.equal(reviews.length,2);delete process.env.SERPAPI_KEY;resetSerpStateForTests();
});
test('live mode requires explicit configuration and rejects an incorrect access code',()=>{
  process.env.SERPAPI_KEY='test-key';delete process.env.GAPCITY_LIVE_ENABLED;assert.throws(()=>authorizeLive(null),e=>e instanceof AppError&&e.code==='LIVE_NOT_CONFIGURED');
  process.env.GAPCITY_LIVE_ENABLED='true';process.env.GAPCITY_LIVE_ACCESS_TOKEN='secret-code';assert.throws(()=>authorizeLive('wrong'),e=>e instanceof AppError&&e.status===401);assert.doesNotThrow(()=>authorizeLive('secret-code'));
  delete process.env.SERPAPI_KEY;delete process.env.GAPCITY_LIVE_ENABLED;delete process.env.GAPCITY_LIVE_ACCESS_TOKEN;
});
test('public sample tickets cannot inject business facts into a restored analysis',async()=>{
  const a=await createAnalysis(input);
  const capsule=JSON.parse(Buffer.from(a.ticket.split('.')[0],'base64url').toString());
  capsule.businesses[0].name='Forged real business';capsule.businesses[0].rating=0;
  const body=Buffer.from(JSON.stringify(capsule)).toString('base64url');
  const key=process.env.GAPCITY_SIGNING_SECRET||'gapcity-public-synthetic-demonstration-key-v1';
  const ticket=`${body}.${createHmac('sha256',key).update(body).digest('base64url')}`;
  assert.deepEqual(restoreAnalysis(ticket).businesses,a.businesses);
  assert.throws(()=>restoreAnalysis(`${Buffer.from('null').toString('base64url')}.a`),e=>e instanceof AppError&&e.code==='INVALID_TICKET');
});
test('request limits cancel oversized chunked bodies without trusting Content-Length',async()=>{
  let cancelled=false;
  const body=new ReadableStream<Uint8Array>({pull(controller){controller.enqueue(new Uint8Array(600));},cancel(){cancelled=true;}});
  const request=new Request('https://gapcity.test/api/zones',{method:'POST',body,duplex:'half'} as RequestInit);
  await assert.rejects(()=>readJson(request,1000),e=>e instanceof AppError&&e.status===413);
  assert.equal(cancelled,true);
  assert.deepEqual(await readJson(new Request('https://gapcity.test/api/zones',{method:'POST',body:'{"x":1}'})),{x:1});
});
test('production rejects incomplete live settings before any API call',()=>{
  const prior={...process.env};
  try{
    (process.env as Record<string,string|undefined>).NODE_ENV='production';process.env.SERPAPI_KEY='test-key';process.env.GAPCITY_LIVE_ENABLED='true';process.env.GAPCITY_LIVE_ACCESS_TOKEN='code';delete process.env.GAPCITY_SIGNING_SECRET;
    assert.throws(()=>authorizeLive('code'),e=>e instanceof AppError&&e.code==='SIGNING_NOT_CONFIGURED');
  }finally{for(const key of ['NODE_ENV','SERPAPI_KEY','GAPCITY_LIVE_ENABLED','GAPCITY_LIVE_ACCESS_TOKEN','GAPCITY_SIGNING_SECRET']){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
test('public production search needs no visitor code but still requires a private signing secret',()=>{
  const keys=['NODE_ENV','SERPAPI_KEY','GAPCITY_LIVE_ENABLED','GAPCITY_PUBLIC_LIVE','GAPCITY_LIVE_ACCESS_TOKEN','GAPCITY_SIGNING_SECRET'];
  const prior={...process.env};
  try{
    (process.env as Record<string,string|undefined>).NODE_ENV='production';
    process.env.SERPAPI_KEY='test-key';process.env.GAPCITY_LIVE_ENABLED='true';
    process.env.GAPCITY_LIVE_ACCESS_TOKEN='legacy-private-code';delete process.env.GAPCITY_PUBLIC_LIVE;
    process.env.GAPCITY_SIGNING_SECRET='test-signing-secret';
    assert.throws(()=>authorizeLive(null),e=>e instanceof AppError&&e.status===401);
    process.env.GAPCITY_PUBLIC_LIVE='true';
    assert.doesNotThrow(()=>authorizeLive(null));assert.equal(liveConfiguration().protected,false);
    assert.equal(JSON.stringify(liveConfiguration()).includes('test-key'),false);
    delete process.env.GAPCITY_SIGNING_SECRET;
    assert.throws(()=>authorizeLive(null),e=>e instanceof AppError&&e.code==='SIGNING_NOT_CONFIGURED');
    delete process.env.SERPAPI_KEY;
    assert.throws(()=>authorizeLive(null),e=>e instanceof AppError&&e.code==='LIVE_NOT_CONFIGURED');
  }finally{for(const key of keys){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}}
});
