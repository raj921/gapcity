import { existsSync } from 'node:fs';
import { mkdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createAnalysis,getEvidence } from '../lib/analysis';
import { authorizeLive } from '../lib/serpapi';
import { VIJAYAWADA } from '../lib/demo';
import { inputSchema,AppError } from '../lib/validation';

if(existsSync('.env.local'))process.loadEnvFile('.env.local');
const searchOnly=process.argv.includes('--search-only');
try{
  const input=inputSchema.parse({category:process.env.GAPCITY_DEMO_CATEGORY||'Cafes',center:{lat:Number(process.env.GAPCITY_DEMO_LAT||VIJAYAWADA.lat),lng:Number(process.env.GAPCITY_DEMO_LNG||VIJAYAWADA.lng)},radiusMeters:Number(process.env.GAPCITY_DEMO_RADIUS||1500),mode:'live'});
  authorizeLive(process.env.GAPCITY_LIVE_ACCESS_TOKEN||null);
  const analysis=await createAnalysis(input);
  const {ticket,...saved}=analysis;void ticket;
  console.log(JSON.stringify({source:analysis.source,businesses:analysis.businesses.length,withRatings:analysis.summary.ratedCount,withReviewCounts:analysis.businesses.filter(b=>b.reviewCount!==null).length,topZones:analysis.topZoneIds.length,coverage:analysis.coverage},null,2));
  const evidence=searchOnly?null:analysis.topZoneIds[0]?await getEvidence(analysis.id,analysis.topZoneIds[0]):analysis.businesses[0]?await getEvidence(analysis.id,undefined,analysis.businesses[0].id):null;
  const destination=path.resolve('recordings/vijayawada-live.json');
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,JSON.stringify({analysis:saved,evidence,method:'Heuristic review-based research. Not a demand or profitability forecast.'},null,2));
  console.log(`Saved a real SerpApi recording to ${destination}. Reviews: ${evidence?.sampleSize||0}.`);
  if(analysis.businesses.length<15||analysis.summary.ratedCount<10)console.log('Thin sample: try a nearby centre or a wider radius before recording the demo.');
}catch(error){
  console.error(error instanceof AppError?`${error.code}: ${error.message}`:'Recording failed. Check the search inputs and server settings.');process.exitCode=1;
}
