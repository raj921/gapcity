import { createHmac,randomBytes,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { demoBusinesses,VIJAYAWADA } from './demo';
import { distanceMeters } from './geo';
import { AppError,inputSchema } from './validation';
import { buildZones } from './scoring';
import type { Analysis } from './types';
const root=globalThis as typeof globalThis&{__gapcitySigningKey?:string};
root.__gapcitySigningKey??=randomBytes(32).toString('hex');
const businessSchema=z.object({id:z.string().min(1).max(200),name:z.string().min(1).max(180),location:z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180)}),rating:z.number().min(0).max(5).nullable(),reviewCount:z.number().finite().int().nonnegative().nullable(),address:z.string().max(400),category:z.string().max(100),distanceMeters:z.number().finite().nonnegative(),mapsUrl:z.string().max(1500),openState:z.string().max(120).nullable(),price:z.string().max(80).nullable(),dataId:z.string().max(200).optional(),placeId:z.string().max(200).optional()});
const capsuleSchema=z.object({v:z.literal(1),id:z.string().uuid(),input:inputSchema,source:z.enum(['synthetic','serpapi']),fetchedAt:z.string().datetime(),expiresAt:z.string().datetime(),businesses:z.array(businessSchema).max(60)});
function signingKey(source:'synthetic'|'serpapi'):string{
  if(process.env.GAPCITY_SIGNING_SECRET)return process.env.GAPCITY_SIGNING_SECRET;
  if(source==='synthetic')return 'gapcity-public-synthetic-demonstration-key-v1';
  if(process.env.NODE_ENV==='production')throw new AppError('SIGNING_NOT_CONFIGURED','Live analysis requires a signing secret on the server.',503);
  return root.__gapcitySigningKey!;
}
export function signAnalysis(analysis:Analysis):string{
  const body=Buffer.from(JSON.stringify({v:1,id:analysis.id,input:analysis.input,source:analysis.source,fetchedAt:analysis.fetchedAt,expiresAt:analysis.expiresAt,businesses:analysis.businesses})).toString('base64url');
  return `${body}.${createHmac('sha256',signingKey(analysis.source)).update(body).digest('base64url')}`;
}
export function restoreAnalysis(ticket:string):Analysis{
  if(ticket.length>100_000)throw new AppError('INVALID_TICKET','The saved analysis is too large.');
  const parts=ticket.split('.');if(parts.length!==2)throw new AppError('INVALID_TICKET','The saved analysis is invalid. Run the search again.');
  let parsed;try{parsed=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));}catch{throw new AppError('INVALID_TICKET','The saved analysis is invalid.');}
  const checked=capsuleSchema.safeParse(parsed);
  if(!checked.success)throw new AppError('INVALID_TICKET','The saved analysis has an invalid format. Run the search again.');
  const capsule=checked.data;
  const expected=createHmac('sha256',signingKey(capsule.source)).update(parts[0]).digest();
  const provided=Buffer.from(parts[1],'base64url');
  if(provided.length!==expected.length||!timingSafeEqual(provided,expected))throw new AppError('INVALID_TICKET','The saved analysis was changed or signed by another server. Run the search again.');
  if(capsule.v!==1||!Array.isArray(capsule.businesses)||capsule.businesses.length>60)throw new AppError('INVALID_TICKET','The saved analysis has an unsupported format.');
  if(!(Date.parse(capsule.expiresAt)>Date.now()))throw new AppError('ANALYSIS_EXPIRED','This saved analysis has expired. Run the search again.',410);
  const input=inputSchema.parse(capsule.input);
  if((input.mode==='demo')!==(capsule.source==='synthetic'))throw new AppError('INVALID_TICKET','The saved analysis mode is invalid.');
  // Public synthetic snapshots reconstruct our sample pool instead of trusting supplied records.
  if(capsule.source==='synthetic'&&distanceMeters(input.center,VIJAYAWADA)>10_000)throw new AppError('INVALID_TICKET','The sample area must be around Vijayawada.');
  const businesses=capsule.source==='synthetic'?demoBusinesses(input).filter(b=>distanceMeters(input.center,b.location)<=input.radiusMeters):capsule.businesses;
  const rated=businesses.filter(b=>b.rating!==null);
  const zones=buildZones(input,businesses);
  return {id:capsule.id,ticket,input,source:capsule.source,fetchedAt:capsule.fetchedAt,expiresAt:capsule.expiresAt,businesses,zones,topZoneIds:zones.filter(z=>z.rank!==null).sort((a,b)=>a.rank!-b.rank!).map(z=>z.id),summary:{businessCount:businesses.length,ratedCount:rated.length,averageRating:rated.length?rated.reduce((s,b)=>s+b.rating!,0)/rated.length:null,totalReviews:businesses.reduce((s,b)=>s+(b.reviewCount||0),0)},coverage:{rawCount:businesses.length,outsideRadius:0,missingCoordinates:0,duplicates:0,pages:0,truncated:false},caveats:['Restored from a signed analysis snapshot.']};
}
