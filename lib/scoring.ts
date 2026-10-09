import { clippedCell, coordinatesToOffset, distanceMeters, offsetToCoordinates } from './geo';
import type { AnalysisInput, Business, Zone } from './types';
const clamp = (n:number)=>Math.max(0,Math.min(1,n));
export const CELL_SIZE_METERS=400;
export function buildZones(input:AnalysisInput,businesses:Business[]):Zone[] {
  const extent=Math.ceil(input.radiusMeters/CELL_SIZE_METERS);
  const zones:Zone[]=[];
  const groups=new Map<string,Business[]>();
  for(const b of businesses){
    const [east,north]=coordinatesToOffset(input.center,b.location);
    const key=`${Math.floor((east+200)/400)}:${Math.floor((north+200)/400)}`;
    groups.set(key,[...(groups.get(key)||[]),b]);
  }
  for(let x=-extent;x<=extent;x++)for(let y=-extent;y<=extent;y++){
    const east=x*400,north=y*400;
    const nearest=Math.hypot(Math.max(0,Math.abs(east)-200),Math.max(0,Math.abs(north)-200));
    if(nearest>=input.radiusMeters)continue;
    const polygon=clippedCell(input.center,east,north,400,input.radiusMeters);
    if(polygon.length<4)continue;
    const members=groups.get(`${x}:${y}`)||[];
    const rated=members.filter(b=>b.rating!==null&&b.reviewCount!==null&&b.reviewCount>=10);
    const reviews=rated.reduce((s,b)=>s+(b.reviewCount||0),0);
    const average=rated.length?rated.reduce((s,b)=>s+(b.rating||0),0)/rated.length:null;
    // Equal business weights after shrinking noisy small samples towards 4.0.
    const adjusted=rated.length?rated.reduce((s,b)=>{const n=Math.min(b.reviewCount||0,100);return s+((b.rating||0)*n+4*20)/(n+20);},0)/rated.length:4;
    const sufficientlyObserved=rated.length>=3&&reviews>=50;
    const friction=clamp((4.6-adjusted)/1.6);
    const activity=clamp(Math.log1p(rated.reduce((s,b)=>s+Math.min(b.reviewCount||0,1000),0))/Math.log1p(3000));
    const competitionGap=1-clamp(members.length/12);
    const score=sufficientlyObserved?Math.round(100*(0.55*friction+0.3*activity+0.15*competitionGap)):null;
    const streetHint=members[0]?.address.split(',').slice(0,2).join(',');
    const vertices=polygon.slice(0,-1);
    const marker={lat:vertices.reduce((s,p)=>s+p[1],0)/vertices.length,lng:vertices.reduce((s,p)=>s+p[0],0)/vertices.length};
    zones.push({id:`zone:${x}:${y}`,center:marker,polygon,businessIds:members.map(b=>b.id),competitorCount:members.length,ratedCount:rated.length,reviewCount:reviews,averageRating:average,score,rank:null,confidence:rated.length>=5&&reviews>=100?'moderate':'limited',streetHint:streetHint||`Near ${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`,reason:score===null?(members.length?`${members.length} observed ${members.length===1?'competitor provides':'competitors provide'} a starting point for a site visit, but too few have supported ratings to score this area. Inspect any available reviews, check nearby businesses and ask customers what is missing.`:'No listings were returned for this area. Start a site visit near your search centre to check actual businesses, footfall and access. Missing listings do not establish low competition or demand. Widen the circle or change the business type to gather more evidence.'):`${rated.length} rated competitors contribute ${reviews.toLocaleString('en-IN')} public reviews in this cell. Their ${average?.toFixed(1)} average rating ${average!==null&&average<4?'suggests room to investigate a better customer experience':'means a new business would need a clear reason for customers to switch'}. The score balances adjusted ratings, review activity and competitor concentration. Check the source reviews and visit before choosing a site.`});
  }
  const ranked=zones.filter(z=>z.score!==null).sort((a,b)=>(b.score||0)-(a.score||0)||b.reviewCount-a.reviewCount||a.id.localeCompare(b.id));
  const selected:Zone[]=[];
  const limited=zones.filter(z=>z.score===null&&z.competitorCount>0).sort((a,b)=>b.ratedCount-a.ratedCount||b.reviewCount-a.reviewCount||b.competitorCount-a.competitorCount||distanceMeters(input.center,a.center)-distanceMeters(input.center,b.center)||a.id.localeCompare(b.id));
  const candidates=[...ranked,...limited];
  // With no observations, offer one geographic starting point, never an invented score.
  if(!candidates.length){const centre=zones.find(z=>z.id==='zone:0:0');if(centre)candidates.push(centre);}
  for(const z of candidates){if(selected.every(other=>distanceMeters(z.center,other.center)>=399)){z.rank=selected.length+1;selected.push(z);}if(selected.length===3)break;}
  return zones;
}
