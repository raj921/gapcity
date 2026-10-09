'use client';
import { useEffect,useRef,useState } from 'react';
import { Compass,Layers,Maximize,Minus,Plus } from 'lucide-react';
import { circleCoordinates, normalizeMapPin } from '@/lib/geo';
import type { Analysis,Coordinates } from '@/lib/types';
import GeographicPlot from './geographic-plot';

type Feature={type:'Feature';geometry:{type:string;coordinates:unknown};properties:Record<string,unknown>};
type Collection={type:'FeatureCollection';features:Feature[]};
type MapEvent={point:{x:number;y:number};lngLat:{lat:number;lng:number}};
type Source={setData:(data:Collection)=>void};
type MapInstance={
  on:(event:string,callback:(event:MapEvent)=>void)=>void;
  off:(event:string,callback:(event:MapEvent)=>void)=>void;
  addSource:(id:string,source:Record<string,unknown>)=>void;
  getSource:(id:string)=>Source|undefined;
  addLayer:(layer:Record<string,unknown>,before?:string)=>void;
  getLayer:(id:string)=>unknown;
  setLayoutProperty:(id:string,key:string,value:unknown)=>void;
  setPaintProperty:(id:string,key:string,value:unknown)=>void;
  getStyle:()=>{layers:{id:string;type:string;layout?:Record<string,unknown>}[]};
  isStyleLoaded:()=>boolean;
  queryRenderedFeatures:(point:{x:number;y:number},options:{layers:string[]})=>{properties:Record<string,unknown>}[];
  getCanvas:()=>HTMLCanvasElement;
  fitBounds:(bounds:[[number,number],[number,number]],options:Record<string,unknown>)=>void;
  easeTo:(options:Record<string,unknown>)=>void;
  jumpTo:(options:Record<string,unknown>)=>void;
  zoomIn:(options?:Record<string,unknown>)=>void;zoomOut:(options?:Record<string,unknown>)=>void;resize:()=>void;remove:()=>void;
  addControl:(control:unknown,position:string)=>void;
};
type Marker={setLngLat:(point:[number,number])=>Marker;addTo:(map:MapInstance)=>Marker;on:(event:string,callback:()=>void)=>Marker;getLngLat:()=>Coordinates;remove:()=>void};
type SDK={Marker:new(options:Record<string,unknown>)=>Marker;Map:new(options:Record<string,unknown>)=>MapInstance;ScaleControl:new(options:Record<string,unknown>)=>unknown};
let sdkPromise:Promise<SDK>|null=null;
function loadSDK():Promise<SDK>{
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve,reject)=>{
    const existing=(window as Window&{maplibregl?:SDK}).maplibregl;if(existing){resolve(existing);return;}
    if(!document.querySelector('link[data-gapcity-map]')){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.css';css.dataset.gapcityMap='true';document.head.append(css);}
    const url='https://unpkg.com/maplibre-gl@6.13.0/dist/maplibre-gl.mjs';
    const timer=setTimeout(()=>reject(new Error('Map renderer could not load.')),12000);
    import(/* webpackIgnore: true */ url).then(sdk=>{clearTimeout(timer);resolve(sdk as SDK);},()=>{clearTimeout(timer);reject(new Error('Map renderer unavailable.'));});
  });
  return sdkPromise;
}
const empty:Collection={type:'FeatureCollection',features:[]};
const collection=(features:Feature[]):Collection=>({type:'FeatureCollection',features});
type Props={center:Coordinates;radius:number;analysis:Analysis|null;selectedId:string|null;onBusiness:(id:string)=>void;onZone:(id:string)=>void;onPin:(p:Coordinates)=>void;picking:boolean};
export default function DistrictMap(props:Props){
  const host=useRef<HTMLDivElement>(null),map=useRef<MapInstance|null>(null),latest=useRef(props),lastAnalysis=useRef(''),marker=useRef<Marker|null>(null),lastFocus=useRef('');
  latest.current=props;
  const [state,setState]=useState<'loading'|'ready'|'fallback'>('loading');
  const [threeD,setThreeD]=useState(true),[showZones,setShowZones]=useState(true),[layersOpen,setLayersOpen]=useState(false);
  const visibleZones=useRef(true),tilt=useRef(true);visibleZones.current=showZones;tilt.current=threeD;
  const duration=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:500;
  function fitPreview(){const m=map.current,p=latest.current;if(!m)return;const circle=circleCoordinates(p.center,p.radius);m.fitBounds([[Math.min(...circle.map(p=>p[0])),Math.min(...circle.map(p=>p[1]))],[Math.max(...circle.map(p=>p[0])),Math.max(...circle.map(p=>p[1]))]],{padding:{top:140,bottom:100,left:45,right:70},duration:duration(),maxZoom:17.5,pitch:tilt.current?48:0,bearing:tilt.current?-20:0});}
  const updateRef=useRef<()=>void>(()=>{});
  updateRef.current=()=>{
    const m=map.current,a=latest.current.analysis;if(!m||!a||!m.getSource('businesses'))return;
    const p=latest.current;marker.current?.setLngLat([p.center.lng,p.center.lat]);
    m.getSource('preview')?.setData(collection([{type:'Feature',geometry:{type:'Polygon',coordinates:[circleCoordinates(p.center,p.radius)]},properties:{}}]));
    const selectedZone=a.zones.find(z=>z.id===latest.current.selectedId);
    m.getSource('district')?.setData(collection([{type:'Feature',geometry:{type:'Polygon',coordinates:[circleCoordinates(a.input.center,a.input.radiusMeters)]},properties:{}}]));
    m.getSource('businesses')?.setData(collection(a.businesses.map(b=>({type:'Feature',geometry:{type:'Point',coordinates:[b.location.lng,b.location.lat]},properties:{id:b.id,name:b.name,selected:b.id===latest.current.selectedId||Boolean(selectedZone?.businessIds.includes(b.id))}}))));
    m.getSource('research-zones')?.setData(collection(a.zones.map(z=>({type:'Feature',geometry:{type:'Polygon',coordinates:[z.polygon]},properties:{id:z.id,score:z.score??-1,rank:z.rank||0,selected:z.id===latest.current.selectedId}}))));
    m.getSource('zone-labels')?.setData(collection(a.zones.filter(z=>z.rank!==null).map(z=>({type:'Feature',geometry:{type:'Point',coordinates:[z.center.lng,z.center.lat]},properties:{id:z.id,label:`${z.rank}`,selected:z.id===latest.current.selectedId}}))));
    m.getSource('centre')?.setData(collection([{type:'Feature',geometry:{type:'Point',coordinates:[a.input.center.lng,a.input.center.lat]},properties:{}}]));
    if(lastAnalysis.current!==a.id){
      lastAnalysis.current=a.id;
      fitPreview();
    }
  };
  useEffect(()=>{
    let cancelled=false,observer:ResizeObserver|undefined,loadTimer:ReturnType<typeof setTimeout>|undefined;
    const init=async()=>{
      try{
        const sdk=await loadSDK();if(cancelled||!host.current)return;
        const m=new sdk.Map({container:host.current,style:'https://tiles.openfreemap.org/styles/bright',center:[80.648,16.5062],zoom:14.5,pitch:48,bearing:-20,cooperativeGestures:true,canvasContextAttributes:{antialias:true},attributionControl:true});map.current=m;
        let ready=false;
        loadTimer=setTimeout(()=>{if(!ready&&!cancelled){setState('fallback');m.remove();map.current=null;}},18000);
        m.on('load',()=>{
          if(cancelled)return;ready=true;clearTimeout(loadTimer);
          // OSM building shapes are independent from business listings.
          const label=m.getStyle().layers.find(l=>l.type==='symbol'&&l.layout?.['text-field']);
          m.addSource('building-geometry',{type:'vector',url:'https://tiles.openfreemap.org/planet'});
          m.addLayer({id:'geographic-buildings',source:'building-geometry','source-layer':'building',type:'fill-extrusion',minzoom:14,filter:['!=',['get','hide_3d'],true],paint:{'fill-extrusion-color':'#d9dfd0','fill-extrusion-height':['coalesce',['get','render_height'],['get','height'],12],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.72}},label?.id);
          for(const id of ['district','businesses','research-zones','zone-labels','centre','preview'])m.addSource(id,{type:'geojson',data:empty});
          m.addLayer({id:'preview-outline',type:'line',source:'preview',paint:{'line-color':'#526dd3','line-width':2,'line-dasharray':[3,2]}});
          m.addLayer({id:'radius-fill',type:'fill',source:'district',paint:{'fill-color':'#b7d58e','fill-opacity':.08}});
          m.addLayer({id:'radius-outline',type:'line',source:'district',paint:{'line-color':'#668f45','line-width':1.4,'line-dasharray':[3,2]}});
          m.addLayer({id:'zone-fill',type:'fill',source:'research-zones',filter:['any',['>', ['get','rank'],0],['==',['get','selected'],true]],paint:{'fill-color':['case',['get','selected'],'#a9d862','#cbe991'],'fill-opacity':.42}});
          m.addLayer({id:'zone-outline',type:'line',source:'research-zones',filter:['any',['>', ['get','rank'],0],['==',['get','selected'],true]],paint:{'line-color':'#83a359','line-width':1,'line-opacity':.65}});
          m.addLayer({id:'business-points',type:'circle',source:'businesses',paint:{'circle-radius':['case',['get','selected'],8,5],'circle-color':['case',['get','selected'],'#d76c53','#365743'],'circle-stroke-color':'#ffffff','circle-stroke-width':2,'circle-opacity':.95}});
          m.addLayer({id:'business-labels',type:'symbol',source:'businesses',minzoom:16.2,layout:{'text-field':['get','name'],'text-font':['Noto Sans Regular'],'text-size':11,'text-offset':[0,1.4],'text-anchor':'top'},paint:{'text-color':'#415640','text-halo-color':'#ffffff','text-halo-width':2}});
          m.addLayer({id:'zone-ranks',type:'symbol',source:'zone-labels',layout:{'text-field':['get','label'],'text-font':['Noto Sans Regular'],'text-size':19,'text-allow-overlap':true},paint:{'text-color':'#456629','text-halo-color':'#f5f9e9','text-halo-width':3}});
          const pin=document.createElement('button');pin.type='button';pin.className='search-pin';pin.setAttribute('aria-label','Move search pin. Drag or use arrow keys; Shift moves farther.');pin.title='Drag to move · arrow keys to nudge';pin.innerHTML='<span aria-hidden="true">+</span>';
          // MapLibre prevents the native marker mousedown; restore button focus.
          pin.addEventListener('pointerdown',()=>pin.focus({preventScroll:true}));
          pin.addEventListener('click',e=>{e.stopPropagation();pin.focus({preventScroll:true});});
          pin.addEventListener('keydown',e=>{const direction:Record<string,[number,number]>={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};const d=direction[e.key];if(!d)return;e.preventDefault();e.stopPropagation();const c=latest.current.center,step=e.shiftKey?.001:.00015;latest.current.onPin(normalizeMapPin({lat:c.lat+d[1]*step,lng:c.lng+d[0]*step/Math.cos(c.lat*Math.PI/180)}));});
          marker.current=new sdk.Marker({element:pin,draggable:true,anchor:'center'}).setLngLat([latest.current.center.lng,latest.current.center.lat]).addTo(m);
          marker.current.on('dragend',()=>{if(marker.current)latest.current.onPin(normalizeMapPin(marker.current.getLngLat()));});
          m.addControl(new sdk.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-right');
          m.getCanvas().setAttribute('aria-label','Interactive map. Use the competitor list for keyboard selection.');
          setState('ready');updateRef.current();
        });
        m.on('click',event=>{
          const p=latest.current;
          if(p.picking){p.onPin(normalizeMapPin({lat:event.lngLat.lat,lng:event.lngLat.lng}));return;}
          if(!m.getLayer('business-points'))return;
          const businesses=m.queryRenderedFeatures(event.point,{layers:['business-points']});
          if(businesses[0]?.properties.id){p.onBusiness(String(businesses[0].properties.id));return;}
          if(visibleZones.current){const zones=m.queryRenderedFeatures(event.point,{layers:['zone-fill']});if(zones[0]?.properties.id)p.onZone(String(zones[0].properties.id));}
        });
        m.on('mousemove',event=>{if(!m.getLayer('business-points'))return;const hits=m.queryRenderedFeatures(event.point,{layers:visibleZones.current?['business-points','zone-fill']:['business-points']});m.getCanvas().style.cursor=latest.current.picking?'crosshair':hits.length?'pointer':'';});
        observer=new ResizeObserver(()=>m.resize());observer.observe(host.current);
      }catch{if(!cancelled)setState('fallback');}
    };
    void init();
    return()=>{cancelled=true;clearTimeout(loadTimer);observer?.disconnect();marker.current?.remove();marker.current=null;map.current?.remove();map.current=null;};
  },[]);
  useEffect(()=>updateRef.current(),[props.analysis,props.selectedId,props.center,props.radius]);
  useEffect(()=>{const m=map.current;if(state!=='ready'||!m)return;m.easeTo({center:[props.center.lng,props.center.lat],duration:duration()});},[props.center,state]);
  useEffect(()=>{const m=map.current,a=props.analysis;if(!m||!a||state!=='ready'||!props.selectedId){lastFocus.current='';return;}if(lastFocus.current===props.selectedId)return;lastFocus.current=props.selectedId;const p=a.businesses.find(b=>b.id===props.selectedId)?.location||a.zones.find(z=>z.id===props.selectedId)?.center;if(p)m.easeTo({center:[p.lng,p.lat],zoom:16.3,duration:duration()});},[props.selectedId,props.analysis,state]);
  useEffect(()=>{const m=map.current;if(!m||!m.getLayer('geographic-buildings'))return;m.setLayoutProperty('geographic-buildings','visibility',threeD?'visible':'none');m.easeTo({pitch:threeD?48:0,bearing:threeD?-20:0,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});},[threeD,state]);
  useEffect(()=>{const m=map.current;if(!m)return;for(const id of ['zone-fill','zone-outline','zone-ranks'])if(m.getLayer(id))m.setLayoutProperty(id,'visibility',showZones?'visible':'none');},[showZones,state]);
  return <>
    <div ref={host} className={`map-canvas ${state==='fallback'?'unavailable':''}`} aria-label="Geographic district map"/>
    {state!=='ready'&&<GeographicPlot {...props} loading={state==='loading'} showZones={showZones}/>}
    <div className="map-controls"><button onClick={()=>setThreeD(!threeD)} aria-pressed={threeD} disabled={state!=='ready'} className={threeD?'selected':''}>{threeD?'3D':'2D'}</button><button onClick={()=>map.current?.easeTo({bearing:0,duration:duration()})} aria-label="Point map north" disabled={state!=='ready'}><Compass size={18}/></button><button onClick={fitPreview} aria-label="Fit the preview radius" disabled={state!=='ready'}><Maximize size={17}/></button><button onClick={()=>{setThreeD(true);map.current?.easeTo({zoom:17.2,pitch:60,duration:duration()});}} aria-label="Inspect 3D buildings at street level" disabled={state!=='ready'}>Street</button><span/><button onClick={()=>map.current?.zoomIn({duration:duration()})} aria-label="Zoom in" disabled={state!=='ready'}><Plus size={19}/></button><button onClick={()=>map.current?.zoomOut({duration:duration()})} aria-label="Zoom out" disabled={state!=='ready'}><Minus size={19}/></button></div>
    <div className="layer-control"><button onClick={()=>setLayersOpen(!layersOpen)} aria-expanded={layersOpen}><Layers size={16}/>Layers</button>{layersOpen&&<div className="layer-options"><label><input type="checkbox" checked={showZones} onChange={e=>setShowZones(e.target.checked)}/>Research zones</label><label><input type="checkbox" checked={threeD} onChange={e=>setThreeD(e.target.checked)} disabled={state!=='ready'}/>3D buildings</label><p>Building coverage varies. Missing heights use a 12 m visual estimate.</p></div>}</div>
    {state==='ready'&&<span className="map-geometry-note">OpenStreetMap geography · heights may be estimated</span>}
  </>;
}
