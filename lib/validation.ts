import { z } from 'zod';
export const inputSchema = z.object({
  category: z.string().trim().min(2).max(60).regex(/^[\p{L}\p{N}\s&'().-]+$/u, 'Use a business type, such as cafes or barbershops.'),
  center: z.object({lat:z.number().finite().min(-70).max(70),lng:z.number().finite().min(-180).max(180)}),
  radiusMeters: z.number().int().min(100).max(5000),
  mode: z.enum(['demo','live'])
});
export const evidenceSchema=z.object({analysisId:z.string().uuid(),ticket:z.string().max(100000).optional(),zoneId:z.string().max(80).optional(),businessId:z.string().max(200).optional()}).refine(x=>Boolean(x.zoneId)!==Boolean(x.businessId),'Choose one zone or business.');
export class AppError extends Error {
  constructor(public code:string,message:string,public status=400){super(message);}
}
export function safeHttpUrl(value:unknown,fallback:string):string {
  if(typeof value!=='string')return fallback;
  try {const url=new URL(value);return url.protocol==='https:'||url.protocol==='http:'?url.href:fallback;}catch{return fallback;}
}
