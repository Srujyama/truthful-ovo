/**
 * Original procedural studio, not Nomen artwork or code. World coordinates are
 * already projected screen-space (900 × 640); model-local furniture uses the
 * small dimetric construction below. Actor feet, visible targets and DOM speech
 * all share TEAM_POSTS / teamWorkerPose. The caller owns DPR and the only clock.
 */
export const TEAM_WORLD=Object.freeze({width:900,height:640});
export const TEAM_POSTS=Object.freeze([
 {id:'evidence',label:'Evidence',x:238,y:282,anchor:{x:238,y:211},desk:{x:215,y:246},hub:{x:305,y:315}},
 {id:'analyst',label:'Analysis',x:453,y:225,anchor:{x:453,y:154},desk:{x:435,y:190},hub:{x:460,y:282}},
 {id:'reviewer',label:'Review',x:704,y:315,anchor:{x:704,y:244},desk:{x:685,y:280},hub:{x:625,y:347}},
 {id:'operator',label:'Follow-up',x:669,y:506,anchor:{x:669,y:435},desk:{x:647,y:468},hub:{x:569,y:466}},
 {id:'bookkeeper',label:'Invoice check',x:278,y:484,anchor:{x:278,y:413},desk:{x:260,y:444},hub:{x:348,y:440}},
]);
const POSTS=new Map(TEAM_POSTS.map(post=>[post.id,post]));
const TAU=Math.PI*2;
const C={ground:'#faf9f4',floor:'#eeebe1',floorLight:'#f6f3eb',edge:'#ded9c9',rule:'#c9c3b3',wood:'#a77b55',woodLight:'#bd956d',woodDark:'#705139',sage:'#6c8268',sageDark:'#3f5c4a',sageLight:'#a5b29b',ink:'#38433f',cream:'#fffcf2',paper:'#f5eedb',rust:'#af5d43',rustLight:'#d38a65',brass:'#b69956',blue:'#628187',dark:'#38423d',glass:'#c3d5c7'};
const LOOKS={
 evidence:{coat:'#b9674c',dark:'#874c3b',skin:'#d8a17a',hair:'#49352b',hairStyle:'bob',shirt:'#f4e9d4',trousers:'#616b61',tool:'magnifier'},
 analyst:{coat:'#527d74',dark:'#345c54',skin:'#b97d58',hair:'#352b25',hairStyle:'curl',shirt:'#ecdfc1',trousers:'#555b5a',tool:'chart'},
 reviewer:{coat:'#5a6575',dark:'#3d4855',skin:'#e5bc95',hair:'#72756b',hairStyle:'bob',shirt:'#f6edda',trousers:'#4d5554',tool:'stamp'},
 operator:{coat:'#67858f',dark:'#476571',skin:'#9d6449',hair:'#2c2d29',hairStyle:'crop',shirt:'#e9d5a5',trousers:'#5b5e55',tool:'folder'},
 bookkeeper:{coat:'#bc9951',dark:'#8f733b',skin:'#e1ae82',hair:'#684b35',hairStyle:'swept',shirt:'#f2e6cd',trousers:'#59625b',tool:'calculator'},
};
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const mix=(a,b,t)=>a+(b-a)*t;
function shade(hex,k){const value=parseInt(hex.slice(1),16);return `rgb(${[value>>16,(value>>8)&255,value&255].map(n=>Math.round(clamp(n*k,0,255))).join(',')})`;}
const iso=(x,y,z=0)=>({x:(x-y)*.866,y:(x+y)*.46-z});
function poly(ctx,points,color,stroke=null,lineWidth=.7){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x??p[0],p.y??p[1]):ctx.moveTo(p.x??p[0],p.y??p[1]));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.lineWidth=lineWidth;ctx.strokeStyle=stroke;ctx.stroke();}}
function line(ctx,points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function round(ctx,x,y,w,h,r,color,stroke=null){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.8;ctx.stroke();}}
function cube(ctx,x,y,z,w,d,h,color){const a=iso(x-w/2,y-d/2,z),b=iso(x+w/2,y-d/2,z),c=iso(x+w/2,y+d/2,z),e=iso(x-w/2,y+d/2,z),top=[a,b,c,e].map(p=>({x:p.x,y:p.y-h}));poly(ctx,[b,c,top[2],top[1]],shade(color,.76));poly(ctx,[c,e,top[3],top[2]],shade(color,.9));poly(ctx,top,shade(color,1.1));}
function cylinder(ctx,x,y,z,r,h,color,sides=20){const bottom=[],top=[];for(let i=0;i<sides;i++){const p=iso(x+Math.cos(i*TAU/sides)*r,y+Math.sin(i*TAU/sides)*r,z);bottom.push(p);top.push({x:p.x,y:p.y-h});}for(let i=0;i<sides;i++){const j=(i+1)%sides;if(bottom[i].y>iso(x,y,z).y||bottom[j].y>iso(x,y,z).y)poly(ctx,[bottom[i],bottom[j],top[j],top[i]],shade(color,.77+.13*Math.cos((i+.5)*TAU/sides-.7)));}poly(ctx,top,shade(color,1.08));}
function paper(ctx,x,y,z,w=22,d=27,sheets=1,mark='line'){
 for(let i=0;i<sheets;i++)cube(ctx,x+(i%2)*.25,y,z+i*.7,w,d,.65,i%2?C.paper:C.cream);
 const top=z+(sheets-1)*.7+.7;
 if(mark==='check'){const p=iso(x-4,y,top);line(ctx,[[p.x-3,p.y],[p.x,p.y+2],[p.x+7,p.y-4]],C.sageDark,1.5);}else if(mark==='chart'){
  for(let i=0;i<4;i++){const p=iso(x-6+i*3.7,y+2,top);line(ctx,[[p.x,p.y],[p.x,p.y-(3+i%3*2)]],i===3?C.rust:C.sage,2.1);}
 }else for(let i=0;i<3;i++){const a=iso(x-w*.32,y-d*.24+i*d*.23,top),b=iso(x+w*(i===2?.05:.3),y-d*.24+i*d*.23,top);line(ctx,[[a.x,a.y],[b.x,b.y]],i===0?C.sage:C.rule,i===0?1:.65);}
}
function folder(ctx,x,y,z,w=27,d=20,color=C.rust){cube(ctx,x,y,z,w,d,2,color);cube(ctx,x-w*.24,y-d*.46,z+1,w*.3,3,1.1,color);paper(ctx,x+1,y-1,z+2,w-5,d-4,1,'line');cube(ctx,x,y+2,z+2.8,w,d-2,.7,color);}
function mug(ctx,x,y,z,color=C.sage){cylinder(ctx,x,y,z,3.4,6,color,14);const p=iso(x,y,z+6);ellipse(ctx,p.x,p.y,2.55,1.3,C.ink);ctx.strokeStyle=shade(color,.8);ctx.lineWidth=1.7;ctx.beginPath();ctx.ellipse(p.x+4,p.y+2.7,2.8,2.5,0,-1.3,1.7);ctx.stroke();}
function lamp(ctx,x,y,z){const p=iso(x,y,z);ellipse(ctx,p.x,p.y,6,3,C.sageDark);line(ctx,[[p.x,p.y-1],[p.x-1,p.y-18],[p.x-12,p.y-28]],C.ink,2.4);poly(ctx,[{x:p.x-20,y:p.y-28},{x:p.x-13,y:p.y-36},{x:p.x-4,y:p.y-29},{x:p.x-6,y:p.y-24}],C.sageDark);line(ctx,[[p.x-18,p.y-27],[p.x-6,p.y-25]],'#b7b88c',1.2);}
function monitor(ctx,x,y,z){cube(ctx,x,y,z,13,9,1.7,C.ink);cube(ctx,x,y,z+1,2,2,8,C.ink);const a=iso(x,y,z+10);ctx.save();ctx.translate(a.x,a.y);ctx.transform(.92,.18,0,1,0,0);round(ctx,-16,-23,32,24,1.7,C.ink);round(ctx,-13.5,-20,27,17,1,'#9eb6a9');line(ctx,[[-9,-15],[7,-15]],'#d4deca',1.5);line(ctx,[[-9,-10],[2,-10]],C.sageDark,1.3);line(ctx,[[-9,-5],[9,-5]],C.sageDark,.7);ctx.restore();cube(ctx,x,y+12,z+1,22,8,1.2,'#d2cfbd');for(let i=0;i<4;i++){const a=iso(x-7+i*4,y+12,z+2.3),b=iso(x-7+i*4,y+15,z+2.3);line(ctx,[[a.x,a.y],[b.x,b.y]],'#7f8c7f',.6);}}
function plant(ctx,x,y,size=1,kind='broadleaf'){ctx.save();ctx.translate(x,y);ctx.scale(size,size);ellipse(ctx,7,3,21,7,'#595b4920');cylinder(ctx,0,0,0,12,17,C.rust);cylinder(ctx,0,0,17,13,3,C.rustLight);ellipse(ctx,0,-20,10.5,4.8,'#6e5640');
 if(kind==='fern'){for(let i=0;i<7;i++){const angle=-2.9+i*.43,l=31+(i%3)*5,ex=Math.cos(angle)*l,ey=-22+Math.sin(angle)*l;line(ctx,[[0,-20],[ex,ey]],C.sageDark,1.1);for(let t=.2;t<1;t+=.15){const px=ex*t,py=-20+(ey+20)*t;ctx.save();ctx.translate(px,py);ctx.rotate(angle);ellipse(ctx,2,-4,7*(1-t*.6),2.6,i%2?C.sage:C.sageDark);ellipse(ctx,2,4,7*(1-t*.6),2.6,i%2?C.sageDark:C.sage);ctx.restore();}}ctx.restore();return;}
 if(kind==='olive'){line(ctx,[[0,-19],[-2,-58],[-9,-77]],C.woodDark,2);line(ctx,[[-2,-43],[14,-66]],C.woodDark,1.1);line(ctx,[[-3,-52],[-20,-64]],C.woodDark,1.1);for(let i=0;i<19;i++){const a=i*2.39,r=9+(i%4)*4,lx=-4+Math.cos(a)*r,ly=-66+Math.sin(a)*r*.8;ctx.save();ctx.translate(lx,ly);ctx.rotate(a);ellipse(ctx,0,0,4,8.5,i%3?C.sage:C.sageDark);line(ctx,[[0,-5],[0,5]],C.sageLight,.5);ctx.restore();}ctx.restore();return;}
 const leaves=[[-14,-57,-5,-20],[-24,-44,-2,-18],[4,-66,0,-20],[20,-51,1,-19],[27,-32,4,-18],[-4,-44,0,-20]];for(const [lx,ly,bx,by]of leaves){line(ctx,[[bx,by],[lx,ly]],C.sageDark,1.5);ctx.save();ctx.translate(lx,ly+4);ctx.rotate(Math.atan2(ly-by,lx-bx)+Math.PI/2);ellipse(ctx,0,0,6.8,15.5,lx<0?C.sageDark:C.sage);line(ctx,[[0,-11],[0,10]],'#b8bc8c',.65);ctx.restore();}ctx.restore();}
function chair(ctx,x,y,color=C.sage){ctx.save();ctx.translate(x,y);ellipse(ctx,5,2,18,5,'#554d3820');for(const [xx,yy]of[[-7,-4],[8,-4],[-7,6],[8,6]])line(ctx,[[xx,yy-15],[xx,yy+1]],C.woodDark,2);cube(ctx,0,0,15,21,22,4,color);const p=iso(-1,-10,19);round(ctx,p.x-10,p.y-22,22,22,5,shade(color,.82));round(ctx,p.x-8,p.y-20,18,17,4,color);ctx.restore();}
function cabinet(ctx,x,y){ctx.save();ctx.translate(x,y);ellipse(ctx,15,4,45,12,'#514a3620');cube(ctx,0,0,0,40,24,62,C.sage);for(const z of[8,24,40]){cube(ctx,0,12.5,z,35,1,13,'#81947c');cube(ctx,0,13.3,z+6,10,.7,2,C.brass);}cube(ctx,0,0,62,43,26,2,C.sageDark);for(let i=0;i<4;i++)folder(ctx,-10+i*7,-1,64,5,17,[C.rust,C.brass,C.sageDark,C.paper][i]);ctx.restore();}
function desk(ctx,id){const post=POSTS.get(id);ctx.save();ctx.translate(post.desk.x,post.desk.y);ellipse(ctx,11,8,61,15,'#63563d1a');for(const [x,y]of[[-41,-20],[41,-20],[-41,20],[41,20]])cube(ctx,x,y,0,3.8,3.8,33,C.woodDark);cube(ctx,0,0,31,97,51,4.7,C.wood);cube(ctx,0,0,35.7,98,52,1.5,C.woodLight);for(let i=-1;i<=1;i++){const a=iso(-48,i*13,37.3),b=iso(48,i*13,37.3);line(ctx,[[a.x,a.y],[b.x,b.y]],'#dfb78b',.45);}cube(ctx,-27,-1,5,25,39,23,C.wood);for(const z of[12,21])cube(ctx,-27,19.9,z,7,1,1.7,C.brass);
 if(id==='evidence'){paper(ctx,-8,1,37.7,30,30,3);folder(ctx,28,-10,37.7,23,24,C.rust);lamp(ctx,-36,-18,37.7);mug(ctx,34,15,37.7,C.sage);const p=iso(-2,0,42);ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,p.y-2,5.5,0,TAU);ctx.stroke();line(ctx,[[p.x+4,p.y+2],[p.x+10,p.y+8]],C.woodDark,2.8);
 }else if(id==='analyst'){monitor(ctx,-8,-7,37.7);paper(ctx,24,7,37.7,22,26,1,'chart');mug(ctx,-37,15,37.7,C.rust);lamp(ctx,36,-18,37.7);cube(ctx,12,18,38,12,17,2,C.sageDark);
 }else if(id==='reviewer'){paper(ctx,0,3,37.7,29,33,3,'check');cube(ctx,32,-2,38,15,12,3,C.ink);cylinder(ctx,32,-2,41,3.5,7,C.woodDark,12);cylinder(ctx,32,-2,48,5,3,C.rust);folder(ctx,-30,0,38,19,25,C.sageDark);lamp(ctx,-33,-18,37.7);mug(ctx,30,17,37.7,C.cream);
 }else if(id==='operator'){monitor(ctx,-12,-4,37.7);folder(ctx,24,1,38,24,28,C.blue);cube(ctx,30,-17,38,17,10,3,C.woodDark);paper(ctx,4,18,38,24,14,2);mug(ctx,-37,16,37.7,C.brass);
 }else{paper(ctx,-12,-1,37.7,28,33,3,'chart');cube(ctx,20,2,38,16,24,3.5,C.ink);for(let i=0;i<3;i++)for(let j=0;j<4;j++)cube(ctx,15+i*4.3,-4+j*4.8,42,2.9,3.2,.5,j===3?C.rust:C.paper);paper(ctx,33,-17,38,16,17,3);lamp(ctx,-36,-18,37.7);mug(ctx,-34,16,37.7,C.sage);}
 // Each desk owns a compact brass edge plaque, without invented record numbers.
 const p=iso(15,27,30);poly(ctx,[[p.x-16,p.y-3],[p.x+10,p.y+1],[p.x+10,p.y+6],[p.x-16,p.y+2]],C.brass);ctx.restore();}
function sharedTable(ctx){ctx.save();ctx.translate(448,385);ellipse(ctx,20,15,112,28,'#5a50351c');for(const [x,y]of[[-67,-28],[67,-28],[-67,28],[67,28]])cube(ctx,x,y,0,5,5,33,C.woodDark);cube(ctx,0,0,31,155,76,6,C.woodDark);cube(ctx,0,0,37,157,78,1.7,C.woodLight);for(let i=-2;i<=2;i++){const a=iso(-76,i*14,39),b=iso(76,i*14,39);line(ctx,[[a.x,a.y],[b.x,b.y]],'#d8ae83',.65);}folder(ctx,-17,0,39,54,48,C.sageDark);paper(ctx,27,4,40,38,47,3,'chart');paper(ctx,37,-21,40,27,16,1);mug(ctx,-53,11,39,C.rust);cube(ctx,5,27,40,20,7,1.4,C.brass);for(let i=0;i<8;i++){const p=iso(-3+i*2.2,27,41.5);line(ctx,[[p.x,p.y],[p.x,p.y+1.5]],C.woodDark,.5);}ctx.restore();}
function bench(ctx,x,y){ctx.save();ctx.translate(x,y);for(const xx of[-25,25])cube(ctx,xx,0,0,5,16,18,C.woodDark);for(let i=0;i<3;i++)cube(ctx,0,-8+i*8,18,74,6,3,C.woodLight);ctx.restore();}
function ground(ctx){
 ctx.fillStyle=C.ground;ctx.fillRect(0,0,900,640);
 // A continuous cutaway studio floor, not a collection of themed islands.
 ctx.save();ctx.shadowColor='#69604a14';ctx.shadowBlur=24;ctx.shadowOffsetY=13;poly(ctx,[[111,235],[436,83],[805,279],[715,563],[361,590],[105,391]],C.floor);ctx.restore();
 poly(ctx,[[111,235],[436,83],[805,279],[715,563],[361,590],[105,391]],C.floorLight);
 poly(ctx,[[105,391],[361,590],[715,563],[715,569],[361,597],[103,397]],'#ded9c9');
 ctx.save();poly(ctx,[[111,235],[436,83],[805,279],[715,563],[361,590],[105,391]],'#f1eee4');ctx.clip();
 for(let y=98;y<685;y+=35)line(ctx,[[50,y],[890,y+85]],'#e5dfd2',.7);
 for(let x=-300;x<900;x+=65)line(ctx,[[x,72],[x+660,660]],'#e5dfd2',.7);
 // Fine warm stone variation sits in the material, not random UI decoration.
 for(let i=0;i<560;i++){const x=100+(i*137.79)%700,y=90+(i*71.43)%500;ctx.fillStyle=i%2?'#c7bfa91b':'#fffdf434';ctx.fillRect(x,y,i%7===0?2:1,1);}
 ctx.restore();
 // Rear low walls leave faces, desks and incoming documents unobstructed.
 poly(ctx,[[134,222],[436,80],[436,120],[134,262]],'#e5dfd0');poly(ctx,[[436,80],[772,259],[772,298],[436,120]],'#ded7c6');
 line(ctx,[[134,221],[436,79],[772,258]],'#fefbf1',4);line(ctx,[[134,262],[436,120],[772,298]],'#cbc2ad',1);
 // Worn, unobtrusive aisles explain where people can actually walk.
 const ring=TEAM_POSTS.map(p=>p.hub);ctx.beginPath();ring.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.lineWidth=31;ctx.lineJoin='round';ctx.strokeStyle='#fffaf244';ctx.stroke();
 // Station rugs create practical work zones without enclosing the team.
 for(const p of TEAM_POSTS){ctx.save();ctx.translate(p.desk.x,p.desk.y+4);poly(ctx,[[-68,-5],[-9,-38],[69,5],[10,40]],'#c8c4b426');ctx.restore();}
}
function createSprite(draw,x,y,depth,pad=115){const canvas=document.createElement('canvas'),resolution=2;canvas.width=pad*2*resolution;canvas.height=pad*2*resolution;const ctx=canvas.getContext('2d');ctx.scale(resolution,resolution);ctx.translate(pad-x,pad-y);draw(ctx);return {canvas,x:x-pad,y:y-pad,width:pad*2,height:pad*2,depth};}
/** Bake only static geometry. Dynamic workers and work objects retain shared anchors. */
export function bakeTeamScene(){
 const floor=document.createElement('canvas');floor.width=1800;floor.height=1280;const floorContext=floor.getContext('2d');floorContext.scale(2,2);ground(floorContext);
 const objects=[];
 for(const post of TEAM_POSTS){objects.push(createSprite(ctx=>desk(ctx,post.id),post.desk.x,post.desk.y,post.desk.y));objects.push(createSprite(ctx=>chair(ctx,post.x-17,post.y+16,LOOKS[post.id].coat),post.x-17,post.y+16,post.y+13,70));}
 objects.push(createSprite(sharedTable,448,385,385,150));
 for(const [x,y,s,kind]of[[147,315,.9,'fern'],[771,355,1.1,'broadleaf'],[566,160,.78,'olive'],[735,513,.78,'broadleaf'],[150,451,.7,'fern']])objects.push(createSprite(ctx=>plant(ctx,x,y,s,kind),x,y,y,105));
 objects.push(createSprite(ctx=>cabinet(ctx,166,218),166,218,219,100));
 objects.push(createSprite(ctx=>bench(ctx,435,551),435,551,552,80));
 objects.push(createSprite(ctx=>{ctx.translate(329,169);cube(ctx,0,0,0,38,23,25,C.wood);paper(ctx,0,1,25,29,20,6);folder(ctx,8,-1,30,21,17,C.rust);},329,169,169,85));
 return {floor,objects,world:TEAM_WORLD};
}

/** Centre and scaling policy. Explicit focus is suitable for a phone crop. */
export function cameraForTeam(width,height,{focus=null,zoom=1,pan={x:0,y:0}}={}){
 const target=typeof focus==='string'?POSTS.get(focus):focus;
 const overview=Math.min(width/900,height/640);
 const scale=overview*clamp(zoom,.4,4)*(target?Math.max(1,Math.min(2.8,650/Math.max(width,250))):1);
 return {scale,x:width/2-(target?.x??450)*scale+(pan.x||0),y:height/2-((target?.y??340)-(target?45:0))*scale+(pan.y||0)};
}
export function projectTeam(point,camera){return {x:point.x*camera.scale+camera.x,y:point.y*camera.scale+camera.y};}
export function unprojectTeam(point,camera){return {x:(point.x-camera.x)/camera.scale,y:(point.y-camera.y)/camera.scale};}

function shortestRoute(from,to){
 const a=TEAM_POSTS.findIndex(p=>p.id===from),b=TEAM_POSTS.findIndex(p=>p.id===to);if(a<0||b<0||a===b)return [];
 const clockwise=(b-a+5)%5,counter=(a-b+5)%5,step=clockwise<=counter?1:-1,points=[{x:TEAM_POSTS[a].x,y:TEAM_POSTS[a].y}];
 for(let i=a;;i=(i+step+5)%5){points.push(TEAM_POSTS[i].hub);if(i===b)break;}
 const goal=TEAM_POSTS[b];points.push({x:goal.x-62,y:goal.y+2});return points;
}
function pointOnRoute(points,t){const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y)),total=lengths.reduce((a,b)=>a+b,0);let remaining=clamp(t)*total,traveled=0;for(let i=0;i<lengths.length;i++){if(remaining<=lengths[i]||i===lengths.length-1){const f=lengths[i]?remaining/lengths[i]:1,a=points[i],b=points[i+1];return {x:mix(a.x,b.x,f),y:mix(a.y,b.y,f),facing:Math.atan2(b.y-a.y,b.x-a.x),distance:traveled+remaining};}remaining-=lengths[i];traveled+=lengths[i];}return {...points[0],facing:0,distance:0};}
/** Pure positioning contract: pause and reverse use the same progress, not timers. */
export function teamWorkerPose(agentId,interaction=null){
 const post=POSTS.get(agentId)||TEAM_POSTS[0],base={x:post.x,y:post.y,act:LOOKS[post.id].tool,facing:-.5,walk:0,receiving:false,carrying:false,reach:0};
 if(!interaction||interaction.from===interaction.to||!POSTS.has(interaction.from)||!POSTS.has(interaction.to))return base;
 const p=clamp(interaction.progress),sender=agentId===interaction.from,recipient=agentId===interaction.to;
 if(sender){if(p>=.94)return base;const route=shortestRoute(interaction.from,interaction.to),walkOut=p>=.1&&p<.45,walkBack=p>.64&&p<.94;let routeProgress=p<.1?0:p<.45?smooth((p-.1)/.35):p<=.64?1:p<.94?1-smooth((p-.64)/.3):0;
  const point=pointOnRoute(route,routeProgress);return {...base,...point,act:walkOut||walkBack?'walk':p>.43&&p<.64?'give':p<.1?'lift':base.act,walk:point.distance/22,facing:walkOut||walkBack?point.facing+(walkBack?Math.PI:0):p>=.43&&p<=.64?0:base.facing,carrying:p<.55,reach:p>.44&&p<.6?Math.sin(clamp((p-.44)/.16)*Math.PI):0};
 }
 if(recipient)return {...base,act:p>=.44&&p<=.65?'receive':p>.65?'read':base.act,receiving:p>=.44,carrying:p>=.55&&p<.94,facing:Math.PI-.3,reach:p>=.44&&p<=.65?Math.sin(clamp((p-.44)/.21)*Math.PI):0};
 return base;
}

function handDocument(ctx,x,y,kind='source',angle=-.12,color=C.paper){ctx.save();ctx.translate(x,y);ctx.rotate(angle);round(ctx,-10,-10,20,25,1,color,'#b9aa89');if(kind==='approval'||kind==='decision'){ctx.strokeStyle=C.sageDark;ctx.lineWidth=1.8;ctx.beginPath();ctx.arc(0,2,5.4,0,TAU);ctx.stroke();line(ctx,[[-3,2],[-.5,4],[3,-1]],C.sageDark,1.1);}else{line(ctx,[[-6,-5],[5,-5]],C.sageDark,1.4);line(ctx,[[-6,0],[6,0]],'#bdb19a',.8);line(ctx,[[-6,5],[3,5]],'#bdb19a',.8);}ctx.restore();}
function drawWorker(ctx,id,pose,time=0,{selected=false,reduced=false,artifactKind='source'}={}){
 const look=LOOKS[id]||LOOKS.evidence;
 const walking=pose.act==='walk',phase=walking?pose.walk*TAU:0,step=Math.sin(phase),bounce=walking?Math.abs(Math.cos(phase))*1.2:0;
 const dir=Math.cos(pose.facing)>=0?1:-1,working=['magnifier','chart','stamp','calculator'].includes(pose.act),work=reduced?0:Math.sin(time*2.7+TEAM_POSTS.findIndex(p=>p.id===id));
 const lean=pose.act==='give'?pose.reach*3:pose.act==='receive'?-pose.reach*2:0;
 ctx.save();ctx.translate(pose.x,pose.y);
 ellipse(ctx,6,2,18,5.5,'#38392d20');if(selected){ctx.strokeStyle='#a25d3c';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,1,22,8,0,0,TAU);ctx.stroke();}
 ctx.scale(dir,1);ctx.translate(lean,-bounce);
 // Segmented legs use distance-derived stride, so walking never moonwalks when paused.
 const legs=[{x:-5,d:step*6,front:false},{x:5,d:-step*6,front:true}];
 for(const leg of legs){const hip={x:leg.x,y:-27},knee={x:leg.x+leg.d*.6,y:-14+(leg.front?1:0)},foot={x:leg.x+leg.d,y:0};line(ctx,[[hip.x,hip.y],[knee.x,knee.y],[foot.x,foot.y]],shade(look.trousers,leg.front?1:.82),7);round(ctx,foot.x-4,-2,11,5,2.3,'#3f3c31');line(ctx,[[foot.x-1,0],[foot.x+5,0]],'#b9aa8b',.6);}
 // Softly lit torso, collar, seams, pockets and the shoulder satchel share one look.
 ctx.beginPath();ctx.moveTo(-9,-47);ctx.quadraticCurveTo(0,-53,10,-46);ctx.lineTo(12,-27);ctx.quadraticCurveTo(0,-23,-11,-27);ctx.closePath();const coat=ctx.createLinearGradient(-11,-43,13,-29);coat.addColorStop(0,shade(look.coat,1.19));coat.addColorStop(.55,look.coat);coat.addColorStop(1,look.dark);ctx.fillStyle=coat;ctx.fill();
 poly(ctx,[[-4,-49],[3,-49],[1,-33]],look.shirt);line(ctx,[[1,-42],[1,-28]],shade(look.dark,.9),.7);round(ctx,5,-37,4.5,5,1,shade(look.coat,.89));ellipse(ctx,1,-30,.8,.8,C.brass);
 if(id==='operator'){line(ctx,[[-7,-48],[10,-29]],'#b89b68',2);round(ctx,7,-31,12,12,1.5,C.woodDark);line(ctx,[[8,-25],[17,-25]],C.brass,.8);}
 // The far arm is deliberately under the head/held artifact.
 const handY=pose.carrying?-34:pose.act==='stamp'?-33+work*3:pose.act==='magnifier'?-47+work*.7:pose.act==='chart'||pose.act==='calculator'||pose.act==='read'?-33:pose.act==='give'||pose.act==='receive'?-35:walking?-28+step*4:-29;
 const reach=pose.reach*10,handX=pose.act==='give'||pose.act==='receive'?20+reach:pose.carrying?17:pose.act==='magnifier'?14:pose.act==='read'?13:working?16:11;
 line(ctx,[[-8,-44],[-12,-35],[-7,-29+(walking?-step*4:0)]],look.dark,6);ellipse(ctx,-7,-28+(walking?-step*4:0),3,3.6,look.skin);
 line(ctx,[[8,-44],[14,-39],[handX,handY]],look.coat,6.5);line(ctx,[[11,-42],[15,-38]],shade(look.coat,1.16),1.5);ellipse(ctx,handX,handY,3.4,3.6,look.skin);
 // Neck and cheek define a real face in a compact silhouette, not an emoji badge.
 round(ctx,-3,-54,7,7,2,shade(look.skin,.88));ellipse(ctx,0,-59,9.2,11,look.skin);ellipse(ctx,2,-59,6.5,8.7,shade(look.skin,1.08));ellipse(ctx,-7,-59,2.3,3.1,shade(look.skin,.86));
 if(look.hairStyle==='bob'){ctx.fillStyle=look.hair;ctx.beginPath();ctx.moveTo(-10,-58);ctx.bezierCurveTo(-13,-75,8,-77,10,-63);ctx.lineTo(5,-65);ctx.lineTo(-1,-66);ctx.lineTo(-4,-58);ctx.lineTo(-6,-49);ctx.lineTo(-11,-51);ctx.closePath();ctx.fill();line(ctx,[[-8,-66],[-6,-71],[0,-72]],shade(look.hair,1.3),1.2);
 }else if(look.hairStyle==='curl'){for(const [x,y,r]of[[-7,-66,4],[-4,-70,4],[2,-71,4],[7,-68,4],[-9,-61,3]])ellipse(ctx,x,y,r,r,look.hair);
 }else{ctx.fillStyle=look.hair;ctx.beginPath();ctx.moveTo(-9,-59);ctx.bezierCurveTo(-12,-73,4,-76,10,-65);ctx.lineTo(7,-62);ctx.lineTo(2,-67);ctx.lineTo(-7,-65);ctx.closePath();ctx.fill();if(look.hairStyle==='swept')line(ctx,[[-7,-68],[3,-70],[7,-67]],shade(look.hair,1.4),1.2);}
 ellipse(ctx,6,-59,1,1.2,'#3c362f');poly(ctx,[[8,-59],[11,-55],[7,-54]],shade(look.skin,.92));line(ctx,[[5,-51],[8,-51]],'#965f47',.65);
 if(id==='reviewer'||id==='bookkeeper'){ctx.strokeStyle='#605d4f';ctx.lineWidth=.85;ctx.beginPath();ctx.ellipse(5,-59,3.7,3,0,0,TAU);ctx.stroke();line(ctx,[[1,-59],[-4,-60]],'#605d4f',.75);}
 if(pose.hideArtifact){}
 else if(pose.carrying)handDocument(ctx,handX+5,handY-1,artifactKind,-.14);
 else if(pose.act==='magnifier'){ctx.strokeStyle=C.ink;ctx.lineWidth=2.2;ctx.beginPath();ctx.arc(handX+2,handY-8,5.5,0,TAU);ctx.stroke();ellipse(ctx,handX+2,handY-8,3.8,3.8,'#e1eadd60');line(ctx,[[handX+1,handY-3],[handX-1,handY+2]],C.woodDark,2.4);}
 else if(['chart','read'].includes(pose.act))handDocument(ctx,handX+4,handY,pose.act==='chart'?'invoice':artifactKind,-.3);
 else if(pose.act==='stamp'){round(ctx,handX-4,handY+1,10,3,1,C.rust);round(ctx,handX-1,handY-6,4,8,1,C.woodDark);round(ctx,handX-4,handY-8,10,3,1.4,C.woodDark);}
 else if(pose.act==='calculator'){round(ctx,handX-2,handY-8,13,20,2,C.ink);round(ctx,handX,handY-6,9,4,.6,'#adbd9d');for(let i=0;i<3;i++)for(let j=0;j<2;j++)round(ctx,handX+i*3,handY+j*4,1.7,2,.25,j===1&&i===2?C.rust:C.paper);}
 ctx.restore();
}

/** Same authored worker model for the inspector portrait; no separate mascot. */
export function paintTeamPortrait(ctx,agentId,{time=0,act='idle',size=128}={}){
 ctx.clearRect(0,0,size,size);const gradient=ctx.createRadialGradient(size*.45,size*.4,0,size*.5,size*.55,size*.55);gradient.addColorStop(0,'#f4f0e5');gradient.addColorStop(1,'#f4f0e500');ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);ctx.save();const scale=size/112;ctx.translate(size*.47,size*.88);ctx.scale(scale,scale);drawWorker(ctx,agentId,{x:0,y:0,act:act==='idle'?(LOOKS[agentId]?.tool||'read'):act,facing:0,walk:0,carrying:act==='carry',reach:0},time,{reduced:act==='idle'});ctx.restore();
}

/** Selectable hit bounds follow moving workers. Foremost actor wins overlaps. */
export function hitTeamWorker(point,interaction=null,radius=24){return TEAM_POSTS.map(post=>({id:post.id,...teamWorkerPose(post.id,interaction)})).sort((a,b)=>b.y-a.y).find(p=>Math.abs(point.x-p.x)<=radius&&point.y>=p.y-76&&point.y<=p.y+11)?.id||null;}

/** Draw static studio + stable workers. time/progress are supplied, never advanced. */
export function paintTeamScene(ctx,cache,width,height,camera,{time=0,reduced=false,paused=false,selectedAgent=null,interaction=null,workers=null}={}){
 ctx.clearRect(0,0,width,height);ctx.fillStyle=C.ground;ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(camera.x,camera.y);ctx.scale(camera.scale,camera.scale);ctx.drawImage(cache.floor,0,0,900,640);
 const effectiveInteraction=interaction&&reduced?{...interaction,progress:interaction.progress>=.5?1:0}:interaction;
 const actors=TEAM_POSTS.map(post=>{const plan=Array.isArray(workers)?workers.find(w=>(w.id||w.agentId)===post.id):workers?.[post.id],busy=effectiveInteraction&&(effectiveInteraction.from===post.id||effectiveInteraction.to===post.id);const actAliases={reading:'read',checking:'magnifier',typing:'chart',reviewing:'stamp',carrying:'folder',waiting:'idle'},act=actAliases[plan?.act]||plan?.act;return {id:post.id,pose:{...teamWorkerPose(post.id,effectiveInteraction),...(!busy&&act?{act}:{}),...(!busy&&plan?.x!=null?{x:plan.x,y:plan.y}:{})}};});
 const handing=effectiveInteraction&&effectiveInteraction.progress>=.45&&effectiveInteraction.progress<=.64;
 if(handing){for(const actor of actors)if(actor.id===effectiveInteraction.from||actor.id===effectiveInteraction.to)actor.pose.hideArtifact=true;}
 const layers=[...cache.objects.map(object=>({depth:object.depth,draw:()=>ctx.drawImage(object.canvas,object.x,object.y,object.width,object.height)})),...actors.map(({id,pose})=>({depth:pose.y+3,draw:()=>drawWorker(ctx,id,pose,time,{selected:id===selectedAgent,reduced,artifactKind:interaction?.artifactKind||'source'})}))];
 layers.sort((a,b)=>a.depth-b.depth).forEach(layer=>layer.draw());
 if(handing){const a=actors.find(actor=>actor.id===effectiveInteraction.from),b=actors.find(actor=>actor.id===effectiveInteraction.to);if(a&&b){const t=smooth((effectiveInteraction.progress-.45)/.19),x=mix(a.pose.x+30,b.pose.x-27,t),y=mix(a.pose.y-35,b.pose.y-35,t);handDocument(ctx,x,y,effectiveInteraction.artifactKind,-.14+Math.sin(t*Math.PI)*.1);}}
 if(effectiveInteraction&&effectiveInteraction.progress>=.94&&POSTS.has(effectiveInteraction.to)){const desk=POSTS.get(effectiveInteraction.to).desk;ctx.save();ctx.translate(desk.x,desk.y);folder(ctx,9,10,38,26,19,effectiveInteraction.artifactKind==='approval'?C.sageDark:C.rust);ctx.restore();}
 ctx.restore();
}

/** Optional eager release when the scene is permanently unmounted. */
export function disposeTeamScene(cache){if(!cache)return;cache.floor.width=0;cache.floor.height=0;for(const object of cache.objects){object.canvas.width=0;object.canvas.height=0;}cache.objects.length=0;}
