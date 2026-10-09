import { getAnalysis,getEvidence } from '@/lib/analysis';
import { errorResponse,rateLimit,readJson } from '@/lib/http';
import { authorizeLive } from '@/lib/serpapi';
import { evidenceSchema } from '@/lib/validation';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){
  try{rateLimit(request,24);const input=evidenceSchema.parse(await readJson(request,110000));const a=getAnalysis(input.analysisId,input.ticket);if(a.source==='serpapi')authorizeLive(request.headers.get('x-gapcity-access'));return Response.json(await getEvidence(input.analysisId,input.zoneId,input.businessId,input.ticket),{headers:{'Cache-Control':'no-store'}});}catch(error){return errorResponse(error);}
}
