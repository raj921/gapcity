import { createAnalysis } from '@/lib/analysis';
import { errorResponse,rateLimit,readJson } from '@/lib/http';
import { authorizeLive } from '@/lib/serpapi';
import { inputSchema } from '@/lib/validation';
export const runtime='nodejs';
export const maxDuration=90;
export async function POST(request:Request){
  try{rateLimit(request,12);const input=inputSchema.parse(await readJson(request));if(input.mode==='live')authorizeLive(request.headers.get('x-gapcity-access'));return Response.json(await createAnalysis(input),{headers:{'Cache-Control':'no-store'}});}catch(error){return errorResponse(error);}
}
