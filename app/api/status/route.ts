import { liveConfiguration } from '@/lib/serpapi';
export const runtime='nodejs';
export function GET(){return Response.json({live:liveConfiguration(),demoAvailable:true,version:'1.0.0'},{headers:{'Cache-Control':'no-store'}});}
