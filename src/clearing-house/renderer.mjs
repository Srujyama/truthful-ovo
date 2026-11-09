import {createBuilding} from './models.mjs';
import {STATIONS} from './state.mjs';

// Original isometric diorama. Geometry is baked once; the live canvas only
// composites the cached world, water highlights and a recorded-event courier.
export const WORLD={width:1200,height:740};
const TAU=Math.PI*2;
function shade(hex,k){const n=parseInt(hex.slice(1),16),c=[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*k))));return `rgb(${c.join(',')})`;}
export function project(x,y,z=0){return [(x-y)*.866,(x+y)*.5-z];}
function polygon(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();}
function shape(ctx,p,anchor,scale){
 let vertices,faces;
 if(p.shape==='cylinder'){
  const sides=p.sides||12;vertices=[];for(const z of [p.z,p.z+p.h])for(let i=0;i<sides;i++)vertices.push([p.x+Math.cos(i*TAU/sides)*p.r,p.y+Math.sin(i*TAU/sides)*p.r,z]);
  faces=[];for(let i=0;i<sides;i++){const j=(i+1)%sides,angle=(i+.5)*TAU/sides;if(Math.cos(angle)+Math.sin(angle)>0)faces.push({i:[i,j,j+sides,i+sides],k:.72+.15*Math.cos(angle-.5)});}faces.push({i:Array.from({length:sides},(_,i)=>i+sides),k:1.13});
 }else{
  const x=p.x-p.w/2,y=p.y-p.d/2,z=p.z,w=p.w,d=p.d,h=p.h;
  if(p.shape==='roof'){
   vertices=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y+d/2,z+h],[x+w,y+d/2,z+h]];
   faces=[{i:[1,2,5],k:.74},{i:[3,2,5,4],k:.88},{i:[0,1,5,4],k:1.08}];
  }else{
   vertices=[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];
   faces=[{i:[1,2,6,5],k:.72},{i:[2,3,7,6],k:.9},{i:[4,5,6,7],k:1.1}];
  }
 }
 const points=vertices.map(v=>{const q=project(...v);return [Math.round(anchor.x+q[0]*scale),Math.round(anchor.y+q[1]*scale)];});
 faces.forEach(f=>polygon(ctx,f.i.map(i=>points[i]),shade(p.color,f.k)));
}
function random(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function tree(ctx,x,y,size=1){
 ellipse(ctx,x+6,y+3,17*size,6*size,'#cccbb7');
 shape(ctx,{shape:'box',x:0,y:0,z:0,w:4,d:4,h:22,color:'#977455'},{x,y},size);
 const foliage=[[-6,0,21,14,15,12],[6,0,25,17,13,13],[0,-3,35,14,13,12]];
 foliage.forEach(([a,b,z,w,d,h],i)=>shape(ctx,{shape:'box',x:a,y:b,z,w,d,h,color:['#7b9570','#90a67a','#a1b389'][i]},{x,y},size));
}
function path(ctx,points,width,color){ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}
function terrain(ctx){
 const rng=random(2473);ctx.fillStyle='#f6f4ef';ctx.fillRect(0,0,WORLD.width,WORLD.height);
 // A real shoreline shapes the town rather than a decorative page gradient.
 ctx.fillStyle='#79a7a6';ctx.beginPath();ctx.moveTo(0,625);ctx.bezierCurveTo(180,535,310,640,510,610);ctx.bezierCurveTo(710,610,900,655,1200,595);ctx.lineTo(1200,740);ctx.lineTo(0,740);ctx.fill();
 for(let i=0;i<3600;i++){const x=rng()*1200,y=595+rng()*145;if(y>637-25*Math.sin(x/190)){ctx.fillStyle=i%3?'#a6c7bf':'#5f9396';ctx.fillRect(x,y,1+rng()*4,1);}}
 ellipse(ctx,590,395,490,235,'#e8e6d7');ellipse(ctx,592,381,483,225,'#ecebdf');
 for(let i=0;i<10500;i++){const a=rng()*TAU,r=Math.sqrt(rng()),x=592+Math.cos(a)*475*r,y=380+Math.sin(a)*222*r;ctx.fillStyle=['#dddcc9','#e4e2ce','#f1efe0','#d1d7b9','#e9e6d4'][i%5];ctx.fillRect(Math.round(x),Math.round(y),1+(i%7===0?2:0),1);}
 const routes=[[[250,245],[410,340],[570,205]],[[570,205],[670,300],[845,305]],[[845,305],[940,380],[900,530]],[[250,245],[220,350],[285,485]],[[285,485],[420,440],[580,525]],[[580,525],[740,465],[900,530]],[[410,340],[525,385],[670,300]],[[525,385],[420,440]]];
 routes.forEach(r=>{path(ctx,r,14,'#d3cbb4');path(ctx,r,10,'#e8dfc7');});
 // Stone retaining wall and the quay give the paper landscape a grounded edge.
 for(let i=0;i<48;i++)shape(ctx,{shape:'box',x:0,y:0,z:0,w:11,d:7,h:7,color:i%3?'#c8c9ba':'#b9bdad'},{x:285+i*13,y:606+Math.sin(i/9)*7},1);
 for(let i=0;i<140;i++){const x=rng()*1050+60,y=rng()*370+170;if((i%6)===0)tree(ctx,x,y,.48+rng()*.4);}
 // Carefully placed cypresses retain silhouettes around the named buildings.
 [[150,300,.9],[348,210,.7],[440,205,.8],[735,230,.7],[1020,415,.8],[700,555,.65],[170,480,.75],[1035,530,.9]].forEach(v=>tree(ctx,...v));
 const dock={x:170,y:642};for(let i=0;i<11;i++)shape(ctx,{shape:'box',x:i*8,y:0,z:0,w:8,d:30,h:4,color:i%2?'#ac9270':'#bda27b'},dock,1);
}
export function bakeWorld(){
 const canvas=document.createElement('canvas');canvas.width=WORLD.width;canvas.height=WORLD.height;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;terrain(ctx);
 const buildings=STATIONS.map(s=>({...s,model:createBuilding(s.kind)}));
 buildings.sort((a,b)=>a.y-b.y).forEach(s=>{
  ellipse(ctx,s.x+15,s.y+9,s.model.width*.92,s.model.depth*.3,'#c8c7b7');
  const parts=[...s.model.parts].sort((a,b)=>(a.x+a.y+a.z*.05)-(b.x+b.y+b.z*.05));
  parts.forEach(p=>shape(ctx,p,s,1.55));
 });
 return canvas;
}
export function cameraFor(width,height,{zoom=1,focus=null,pan={x:0,y:0}}={}){
 const base=Math.min(width/WORLD.width,height/WORLD.height),scale=base*zoom;
 return {scale,x:width/2-(focus?.x??WORLD.width/2)*scale+pan.x,y:height/2-(focus?.y??WORLD.height/2)*scale+pan.y};
}
export function screenPoint(point,camera){return {x:point.x*camera.scale+camera.x,y:point.y*camera.scale+camera.y};}
export function paintWorld(ctx,cache,width,height,camera,{time=0,reduced=false,selected='review',courier=null}={}){
 ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);ctx.drawImage(cache,0,0);
 if(!reduced){for(let i=0;i<22;i++){const x=(i*67+time*5)%1190,y=656+(i%4)*19;ctx.fillStyle='#c9ded0';ctx.fillRect(x,y,7+(i%3)*4,1);}}
 const selectedStation=STATIONS.find(s=>s.id===selected);if(selectedStation){ctx.strokeStyle='#536b55';ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(selectedStation.x,selectedStation.y+9,78,28,0,0,TAU);ctx.stroke();ctx.setLineDash([]);}
 // Clerks are illustrative wayfinding figures, never purported autonomous agents.
 [[382,334,'#6d8863'],[718,302,'#ad7956'],[772,477,'#648b93'],[353,459,'#bd9b54']].forEach(([x,y,color],i)=>{
  const bob=reduced?0:Math.round(Math.sin(time*2+i)*.5);shape(ctx,{shape:'box',x:0,y:0,z:0,w:5,d:5,h:11,color},{x,y:y+bob},1);shape(ctx,{shape:'box',x:0,y:0,z:11,w:5,d:5,h:5,color:'#d5b18c'},{x,y:y+bob},1);
 });
 if(courier){const p=Math.min(1,courier.progress),{from,to}=courier,x=from.x+(to.x-from.x)*p,y=from.y+(to.y-from.y)*p-45*Math.sin(p*Math.PI);polygon(ctx,[[x,y-6],[x+10,y],[x,y+6],[x-10,y]],'#fff9de');ctx.strokeStyle='#a79a74';ctx.strokeRect(x-5,y-3,10,6);}
 ctx.restore();
}

// Active scene time excludes suspension, including a backgrounded document.
export function createSceneClock(){let previous=null,elapsed=0;return {get elapsed(){return elapsed;},suspend(){previous=null;},step(time,running=true){const delta=running&&previous!==null?Math.max(0,time-previous):0;previous=running?time:null;elapsed+=delta;return delta;}};}
