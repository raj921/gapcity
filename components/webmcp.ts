'use client';
import { useEffect,useRef } from 'react';
import { inputSchema } from '@/lib/validation';
import type { Analysis,AnalysisInput,Evidence } from '@/lib/types';
type State={analysis:Analysis|null;evidence:Evidence|null;selection:{type:string;id:string}|null;stage:(input:Omit<AnalysisInput,'mode'>)=>void};
type Tool={name:string;title:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean;untrustedContentHint:boolean};execute:(input:unknown)=>unknown};
type Context={registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>};
export function useWebMCP(state:State){
  const latest=useRef(state);latest.current=state;
  useEffect(()=>{
    const context=(document as Document&{modelContext?:Context}).modelContext;
    if(!context?.registerTool)return;
    const lifecycle=new AbortController();
    const register=(tool:Tool)=>{try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}};
    register({name:'get_visible_market_analysis',title:'Read current market analysis',description:'Read the analysis currently shown, including its data source and evidence limitations. Does not call SerpApi.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>{
      const {analysis,evidence,selection}=latest.current;
      return analysis?{id:analysis.id,source:analysis.source,input:analysis.input,summary:analysis.summary,coverage:analysis.coverage,topZones:analysis.zones.filter(z=>z.rank!==null),selection,evidence:evidence?{status:evidence.status,sampleSize:evidence.sampleSize,recommendation:evidence.recommendation}:null,caveats:analysis.caveats}:{status:'no_analysis'};
    }});
    register({name:'stage_market_search',title:'Set search fields',description:'Set the visible business category, map centre and radius. Does not run a search or spend credits. Select Explore area to run the search.',inputSchema:{type:'object',properties:{category:{type:'string',minLength:2,maxLength:60},center:{type:'object',properties:{lat:{type:'number',minimum:-70,maximum:70},lng:{type:'number',minimum:-180,maximum:180}},required:['lat','lng'],additionalProperties:false},radiusMeters:{type:'integer',minimum:100,maximum:5000}},required:['category','center','radiusMeters'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(value)=>{
      if(!value||typeof value!=='object')throw new Error('Supply a category, centre and radius.');
      const parsed=inputSchema.strict().parse({...value,mode:'demo'});
      latest.current.stage(parsed);
      return {status:'staged',category:parsed.category,center:parsed.center,radiusMeters:parsed.radiusMeters,searchExecuted:false};
    }});
    return()=>lifecycle.abort();
  },[]);
}
