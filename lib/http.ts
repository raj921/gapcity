import { AppError } from './validation';
import { ZodError } from 'zod';
type Window={start:number;count:number};
const root=globalThis as typeof globalThis&{__gapcityRate?:Map<string,Window>};
const windows=root.__gapcityRate??=new Map();
export function rateLimit(request:Request,limit=15){
  // Trusted platform IP headers are useful for throttling, not authentication.
  const ip=(request.headers.get('x-forwarded-for')||'local').split(',')[0].trim().slice(0,100);
  const key=`${new URL(request.url).pathname}|${ip}`;
  const now=Date.now();
  for(const [k,v]of windows)if(now-v.start>60_000)windows.delete(k);
  const current=windows.get(key)||{start:now,count:0};
  if(current.count>=limit)throw new AppError('RATE_LIMIT','Too many requests. Wait a minute, then try again.',429);
  current.count++;windows.set(key,current);
  if(windows.size>1000)windows.delete(windows.keys().next().value!);
}
export async function readJson(request:Request,maxBytes=4096){
  if(Number(request.headers.get('content-length')||0)>maxBytes)throw new AppError('BODY_TOO_LARGE','The request is too large.',413);
  const reader=request.body?.getReader();
  if(!reader)throw new AppError('INVALID_JSON','Send a valid JSON request.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new AppError('BODY_TOO_LARGE','The request is too large.',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  const raw=Buffer.concat(chunks).toString('utf8');
  try{return JSON.parse(raw);}catch{throw new AppError('INVALID_JSON','Send a valid JSON request.');}
}
export function errorResponse(error:unknown){
  if(error instanceof ZodError)return Response.json({error:{code:'INVALID_INPUT',message:error.issues[0]?.message||'Check the search inputs.'}},{status:400});
  if(error instanceof AppError)return Response.json({error:{code:error.code,message:error.message}},{status:error.status});
  // Never leak raw upstream errors, fetch URLs, stack traces or keys.
  return Response.json({error:{code:'INTERNAL_ERROR',message:'This request could not be completed. Try again later.'}},{status:500});
}
