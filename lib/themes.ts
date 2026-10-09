import type { Business, Evidence, Review, Theme } from './types';
const definitions=[
 {key:'service',label:'Waiting & service',pattern:/\b(wait|waiting|slow|queue|delayed|delay|quick|fast)\b/i,suggestion:'Test a faster service workflow and publish realistic waiting times.'},
 {key:'value',label:'Price & value',pattern:/\b(price|prices|expensive|costly|overpriced|value|money|affordable)\b/i,suggestion:'Compare local prices and make your pricing clear before customers book.'},
 {key:'cleanliness',label:'Cleanliness',pattern:/\b(clean|dirty|hygiene|unclean|cleanliness)\b/i,suggestion:'Check cleanliness on site and establish a visible cleaning routine.'},
 {key:'staff',label:'Staff & experience',pattern:/\b(staff|rude|friendly|helpful|polite|team)\b/i,suggestion:'Review service interactions and train staff to resolve problems clearly.'},
 {key:'access',label:'Parking & access',pattern:/\b(parking|park|access|accessible|space)\b/i,suggestion:'Check access and parking in person before treating this as an advantage.'},
 {key:'quality',label:'Quality',pattern:/\b(quality|taste|tasty|stale|fresh|excellent)\b/i,suggestion:'Compare the actual products or services, then test a specific quality improvement.'}
];
function classify(reviews:Review[],complaints:boolean):Theme[]{
  return definitions.map(d=>{
    const matched=reviews.filter(r=>r.rating!==null&&(complaints?r.rating<=3:r.rating>=4)&&d.pattern.test(r.text));
    return {key:d.key,label:d.label,count:matched.length,businessCount:new Set(matched.map(r=>r.businessId)).size,reviewIds:matched.map(r=>r.id),suggestion:d.suggestion};
  }).filter(t=>t.count>=2).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key));
}
export function summarizeEvidence(analysisId:string,zoneId:string|null,businesses:Business[],reviews:Review[],source:'synthetic'|'serpapi',fetchedAt:string):Evidence {
  const complaints=classify(reviews,true),strengths=classify(reviews,false);
  const sufficient=reviews.length>=10;
  const repeated=complaints.find(t=>t.businessCount>=2);
  const recommendation=!sufficient?'There are too few sampled reviews to recommend a differentiator. Collect more evidence first.':repeated?`${repeated.label} appears in low-rated sampled reviews from ${repeated.businessCount} businesses. ${repeated.suggestion}`:'No complaint theme repeats across multiple sampled businesses. Visit the area and gather more evidence before choosing a differentiator.';
  return {analysisId,zoneId,businesses,reviews,complaints,strengths,recommendation,status:source==='synthetic'?'sample_only':sufficient?'evidence_available':'insufficient_evidence',source,fetchedAt,sampleSize:reviews.length,caveats:[
    'Themes are English keyword matches grouped by review rating. A theme is a prompt for manual review, not a proven complaint.',
    'Newest reviews are a small sample, not the full customer population. Mixed sentiment and sarcasm may be misclassified.',
    'One snapshot cannot establish business growth, sales, market demand or changes in reputation.',
    ...(source==='synthetic'?['These businesses and reviews are invented demonstration records. Do not use them for decisions.']:[])
  ]};
}
