import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as zones } from '../app/api/zones/route';
import { POST as evidence } from '../app/api/evidence/route';
import { GET as status } from '../app/api/status/route';
const base='http://localhost:3010';
function request(path:string,body:unknown){return new Request(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
test('HTTP flow: analysis, zone evidence, competitor evidence and expired ID recovery',async()=>{
  const response=await zones(request('/api/zones',{category:'Cafes',center:{lat:16.5062,lng:80.648},radiusMeters:1500,mode:'demo'}));assert.equal(response.status,200);
  const a=await response.json();assert.equal(a.source,'synthetic');assert.ok(a.topZoneIds.length>0);assert.ok(a.ticket);
  const e=await evidence(request('/api/evidence',{analysisId:a.id,ticket:a.ticket,zoneId:a.topZoneIds[0]}));assert.equal(e.status,200);const data=await e.json();assert.equal(data.source,'synthetic');assert.equal(data.businesses.length,3);assert.equal(data.reviews.length,48);assert.ok(data.complaints.length>0);
  const business=await evidence(request('/api/evidence',{analysisId:a.id,ticket:a.ticket,businessId:a.businesses[0].id}));assert.equal(business.status,200);assert.equal((await business.json()).businesses.length,1);
  const invalid=await evidence(request('/api/evidence',{analysisId:'00000000-0000-4000-a000-000000000000',businessId:'unknown'}));assert.equal(invalid.status,410);
});
test('HTTP errors: malformed input, malformed JSON, oversized body, missing live key',async()=>{
  assert.equal((await zones(request('/api/zones',{category:'Cafes',center:{lat:16.5,lng:80.6},radiusMeters:-1,mode:'demo'}))).status,400);
  const bad=new Request(base+'/api/zones',{method:'POST',body:'not json'});assert.equal((await zones(bad)).status,400);
  const large=new Request(base+'/api/zones',{method:'POST',body:'x'.repeat(5000)});assert.equal((await zones(large)).status,413);
  const live=await zones(request('/api/zones',{category:'Cafes',center:{lat:16.5,lng:80.6},radiusMeters:500,mode:'live'}));assert.equal(live.status,503);assert.equal((await live.json()).error.code,'LIVE_NOT_CONFIGURED');
  const s=await status().json();assert.equal(s.live.available,false);assert.equal(s.demoAvailable,true);
});
