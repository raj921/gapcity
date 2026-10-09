import type { Coordinates } from './types';
export const EARTH_RADIUS_METERS = 6_371_000;
const radians = (n: number) => n * Math.PI / 180;
const degrees = (n: number) => n * 180 / Math.PI;

// Maps can wrap longitude and pan beyond the latitude range supported by search.
export function normalizeMapPin(point: Coordinates): Coordinates {
  return {lat:Math.max(-70,Math.min(70,point.lat)),lng:((point.lng+180)%360+360)%360-180};
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}

// Local projection for small districts. Haversine is always used for radius checks.
export function offsetToCoordinates(center: Coordinates, east: number, north: number): Coordinates {
  return {lat: center.lat + degrees(north / EARTH_RADIUS_METERS), lng: center.lng + degrees(east / (EARTH_RADIUS_METERS * Math.cos(radians(center.lat))))};
}
export function coordinatesToOffset(center: Coordinates, point: Coordinates): [number, number] {
  const longitudeDelta=((point.lng-center.lng+180)%360+360)%360-180;
  return [radians(longitudeDelta) * EARTH_RADIUS_METERS * Math.cos(radians(center.lat)), radians(point.lat - center.lat) * EARTH_RADIUS_METERS];
}
export function circleCoordinates(center: Coordinates, radius: number, steps = 96): [number, number][] {
  const angular = radius / EARTH_RADIUS_METERS;
  const lat = radians(center.lat), lng = radians(center.lng);
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = 2 * Math.PI * i / steps;
    const destLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing));
    const destLng = lng + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(destLat));
    points.push([degrees(destLng), degrees(destLat)]);
  }
  return points;
}

// Clip a square against a convex 64-sided approximation of the radius circle.
export function clippedCell(center: Coordinates, east: number, north: number, size: number, radius: number): [number, number][] {
  let polygon: [number, number][] = [[east-size/2,north-size/2],[east+size/2,north-size/2],[east+size/2,north+size/2],[east-size/2,north+size/2]];
  const circle = Array.from({length:64}, (_,i) => [Math.cos(2*Math.PI*i/64)*radius,Math.sin(2*Math.PI*i/64)*radius] as [number,number]);
  const cross = (a:[number,number],b:[number,number],p:[number,number]) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
  for(let i=0;i<circle.length && polygon.length;i++) {
    const a=circle[i],b=circle[(i+1)%circle.length];
    const input=polygon;polygon=[];
    for(let j=0;j<input.length;j++) {
      const p=input[j],q=input[(j+1)%input.length];
      const cp=cross(a,b,p),cq=cross(a,b,q);
      if(cp>=-1e-8)polygon.push(p);
      if((cp>=0)!==(cq>=0)) {const t=cp/(cp-cq);polygon.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}
    }
  }
  const geographic=polygon.map(([x,y])=>{const p=offsetToCoordinates(center,x,y);return [p.lng,p.lat] as [number,number];});
  if(geographic.length)geographic.push(geographic[0]);
  return geographic;
}
