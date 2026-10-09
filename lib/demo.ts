import { offsetToCoordinates, distanceMeters } from './geo';
import type { AnalysisInput, Business, Review } from './types';
export const VIJAYAWADA={lat:16.5062,lng:80.6480};
export function demoBusinesses(input:AnalysisInput):Business[] {
  // Invented records in geographic positions, never representations of real businesses.
  const category=input.category.replace(/s$/i,'');
  const centers:[number,number][]=[[0,0],[400,0],[800,400],[-400,400],[-800,-400],[400,-800],[0,800]];
  return Array.from({length:49},(_,i)=>{
    const cluster=centers[Math.floor(i/7)];
    const angle=(i%7)*2*Math.PI/7;
    const location=offsetToCoordinates(VIJAYAWADA,cluster[0]+Math.cos(angle)*120,cluster[1]+Math.sin(angle)*120);
    const reviews=35+((i*137)%650);
    const rating=Math.round((Math.floor(i/7)===1?3.0+(i%7)*.09:3.7+((i*3)%11)*.1)*10)/10;
    return {id:`sample-${i+1}`,name:`Sample ${category} ${String(i+1).padStart(2,'0')}`,location,rating,reviewCount:reviews,address:`Synthetic block ${Math.floor(i/7)+1}, Vijayawada`,category:input.category,distanceMeters:Math.round(distanceMeters(input.center,location)),mapsUrl:'',openState:i%3===0?'Closed':'Open',price:i%2===0?'₹₹':'₹',placeId:`synthetic-${i+1}`};
  });
}
const negative=[
  'The wait was long and service was slow during our visit.',
  'The price felt expensive for the quality we received.',
  'Parking was difficult and there was very little space.',
  'The place was dirty and cleanliness needs attention.',
  'The staff were rude when we asked for help.',
  'The service was slow, although the staff were polite.'
];
const positive=[
  'Friendly staff and good quality. We enjoyed the visit.',
  'Clean space and quick service, with helpful staff.',
  'Good value for money and convenient parking.',
  'The quality was excellent and the team was friendly.'
];
export function demoReviews(b:Business):Review[]{
  return Array.from({length:16},(_,i)=>{
    const weak=(b.rating||0)<3.7;
    const negativeReview=i%(weak?3:5)!==0&&weak||i%5===0;
    const date=new Date(Date.UTC(2026,8,30-i));
    return {id:`${b.id}-review-${i}`,businessId:b.id,rating:negativeReview?2:5,text:`[Synthetic review] ${negativeReview?negative[i%negative.length]:positive[i%positive.length]}`,date:date.toISOString().slice(0,10),isoDate:date.toISOString(),url:''};
  });
}
