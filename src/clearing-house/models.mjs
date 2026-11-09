/**
 * Original clearing-house town geometry. Coordinates are model-local: x/y are
 * footprint centres, z is the bottom of the primitive, and +y is the public
 * facade. Roof ridges run along x. No artwork, mesh, or reference code is used.
 */
export const COLORS = Object.freeze({
  ivory: '#e6dfca', stone: '#c7c0a9', brick: '#a77554', green: '#526e5d',
  teal: '#55999a', brass: '#c5a05a', ink: '#3a443a',
  paper: '#f5f0df', mortar: '#bd9978', timber: '#795d43', glass: '#8db8b1',
  shadow: '#66746c', roof: '#3f5b4d', copper: '#a46d47', darkGlass: '#3e6967',
});
const C = COLORS;
const box = (parts, x, y, z, w, d, h, color) => parts.push({shape:'box', x, y, z, w, d, h, color});
const roof = (parts, x, y, z, w, d, h, color) => parts.push({shape:'roof', x, y, z, w, d, h, color});
const cylinder = (parts, x, y, z, r, h, color, sides=12) => parts.push({shape:'cylinder', x, y, z, r, h, color, sides});

function foundation(parts,w=64,d=60) {
  box(parts,0,0,0,w,d,1.6,C.stone);
  box(parts,0,0,1.6,w-2,d-2,.7,C.ivory);
  for(let x=-24;x<=24;x+=12)box(parts,x,27.4,2.3,10.5,2.6,.25,C.stone);
}

function frontWindow(parts,x,y,z,w=8,h=11,{frame=C.ivory,glass=C.darkGlass}={}) {
  box(parts,x,y,z,w+1.6,1.1,h+1.8,frame);
  box(parts,x,y+.64,z+.8,w,.7,h,glass);
  box(parts,x-w*.31,y+1.04,z+1.6,.6,.2,h-1.2,C.glass);
  box(parts,x,y+1.1,z+.8,w,.45,.65,frame);
  box(parts,x,y+1.1,z+h*.54,w,.45,.65,frame);
  box(parts,x,y+1.1,z+.8,.65,.45,h,frame);
  box(parts,x,y+1.1,z-.55,w+3,2.8,1,C.stone);
}

function sideWindow(parts,x,y,z,w=8,h=11,{frame=C.ivory,glass=C.darkGlass}={}) {
  box(parts,x,y,z,1.1,w+1.6,h+1.8,frame);
  box(parts,x+.64,y,z+.8,.7,w,h,glass);
  box(parts,x+1.04,y-w*.31,z+1.6,.2,.6,h-1.2,C.glass);
  box(parts,x+1.1,y,z+h*.54,.45,w,.65,frame);
  box(parts,x+1.1,y,z+.8,.45,.65,h,frame);
  box(parts,x+1.1,y,z-.55,2.8,w+3,1,C.stone);
}

function entrance(parts,x,y,z,w=10,h=18,{frame=C.stone,door=C.green}={}) {
  box(parts,x,y,z,w+3,1.5,h+2,frame);
  box(parts,x,y+1,z+.5,w,.8,h,door);
  box(parts,x,y+1.5,z+.8,.7,.35,h-1,C.ink);
  box(parts,x-w*.25,y+1.5,z+h*.5,w*.34,.35,h*.36,C.darkGlass);
  box(parts,x+w*.25,y+1.5,z+h*.5,w*.34,.35,h*.36,C.darkGlass);
  box(parts,x+1.1,y+1.95,z+h*.43,.6,.6,1.1,C.brass);
  box(parts,x,y+2,z-.3,w+5,4.5,1.2,C.ivory);
}

function pitchedRoof(parts,x,y,z,w,d,h,{color=C.green,trim=C.ivory}={}) {
  box(parts,x,y,z-1.3,w,d,1.3,trim);
  roof(parts,x,y,z,w,d,h,color);
  box(parts,x,y,z+h,w+1,1.5,1.15,C.roof);
  box(parts,x,y+d/2,z-.4,w+1,1.2,1.2,C.roof);
  box(parts,x+w/2,y,z-.4,1.2,d+1,1.2,C.roof);
}

function paperStack(parts,x,y,z,w=8,d=10,sheets=5) {
  for(let i=0;i<sheets;i++)box(parts,x+(i%3-1)*.22,y+(i%2)*.22,z+i*.65,w,d,.48,i%2?C.ivory:C.paper);
  box(parts,x+w*.2,y,z+sheets*.65-.3,.8,d+.3,.38,C.brass);
}

function crate(parts,x,y,z,w=10,d=9,h=8) {
  box(parts,x,y,z,w,d,h,C.timber);
  for(const side of [-1,1]){
    box(parts,x+side*(w/2-.7),y,z+.5,1.1,d+.5,h-.4,C.mortar);
    box(parts,x,y+side*(d/2-.5),z+h*.32,w,.8,.7,C.brass);
    box(parts,x,y+side*(d/2-.5),z+h*.7,w,.8,.7,C.brass);
  }
  box(parts,x,y,z+h,w-.8,d-.8,.5,C.brick);
}

function shrub(parts,x,y,z=2.3) {
  box(parts,x,y,z,10,9,1.6,C.stone);
  cylinder(parts,x,y,z+1.6,4.5,3.3,C.green);
  cylinder(parts,x-.7,y-.5,z+4.1,3.5,2.7,C.roof);
  cylinder(parts,x-1,y-.8,z+6.3,2,1.5,C.green);
}

function tree(parts,x,y,z=2.3) {
  cylinder(parts,x,y,z,1.1,8,C.timber,8);
  cylinder(parts,x,y,z+6.8,5.2,3.2,C.green);
  cylinder(parts,x-1,y,z+9.4,4.5,3.4,C.roof);
  cylinder(parts,x-.6,y,z+12.2,3.1,2.8,C.green);
}

// A vertical round relief made from shallow horizontal stone/metal courses.
// This keeps a real round vault/clock silhouette without needing rotated mesh
// support in the renderer's deliberately small primitive vocabulary.
function facadeDisc(parts,x,y,centreZ,r,color,depth=1.1,step=2) {
  for(let offset=-r+step/2;offset<r;offset+=step){
    const halfWidth=Math.sqrt(Math.max(.1,r*r-offset*offset));
    box(parts,x,y,centreZ+offset-step/2,halfWidth*2,depth,step+.12,color);
  }
}

function archive() {
  const p=[];foundation(p,66,62);
  // Receipt tower and lower sorting wing form an offset L, rather than a cube.
  box(p,-15,-9,3,27,29,46,C.brick);
  box(p,6,4,3,35,34,33,C.brick);
  box(p,-15,-9,3,29,31,3,C.stone);
  box(p,6,4,3,37,36,3,C.stone);
  for(const level of [11,20,29]){
    for(let column=0;column<5;column++)box(p,-7+column*6.5,21.12,level,5.7,.7,1,C.mortar);
    for(let column=0;column<4;column++)box(p,23.62,-8+column*7.4,level,.7,6.2,1,C.mortar);
  }
  box(p,-15,6,45,28,1.1,2,C.ivory);
  box(p,-1.2,-9,45,1.1,30,2,C.ivory);
  pitchedRoof(p,-15,-9,50,32,34,13);
  pitchedRoof(p,6,4,37,40,39,11);
  frontWindow(p,-19,6,27,8,12);
  frontWindow(p,-7,6,27,6,12);
  frontWindow(p,16,21.5,19,8,10);
  frontWindow(p,-4,21.5,19,7,10);
  sideWindow(p,23.8,-5,16,8,12);
  sideWindow(p,23.8,9,16,8,12);
  entrance(p,7,21.5,5,8,18,{frame:C.ivory,door:C.green});
  // Recessed filing hatch with individual ledger spines.
  box(p,-15,7.2,7,18,1.6,11,C.ivory);
  box(p,-15,8.2,8,15.7,.9,8.5,C.ink);
  for(let i=0;i<6;i++){
    box(p,-21.2+i*2.45,8.85,8.5,1.85,.9,7.5,[C.green,C.brass,C.brick][i%3]);
    box(p,-21.2+i*2.45,9.4,13,1.2,.25,.75,C.ivory);
  }
  box(p,-15,9.6,6.7,20,4.2,1.3,C.timber);
  paperStack(p,-20,10.2,8,5,6,4);
  // Oversized receipt standing above the archive roof is the district's sign.
  box(p,-16,-8,60,8.5,2.8,16.5,C.paper);
  box(p,-16,-6.4,71,5.5,.6,1,C.brass);
  for(let i=0;i<4;i++)box(p,-16,-6.4,62+i*1.8,5.5-i%2*1.3,.5,.55,C.stone);
  box(p,-16,-8,76.5,10,3.2,1,C.ivory);
  crate(p,23,23,2.3,11,10,8);
  paperStack(p,23,23,10.8,9,8,5);
  paperStack(p,20,-22,3,8,8,4);
  tree(p,-27,24);
  return p;
}

function review() {
  const p=[];foundation(p,68,64);
  box(p,-1,-3,5.5,49,36,32,C.stone);
  box(p,-1,-3,5.5,51,38,2,C.ivory);
  box(p,-1,-3,35,52,39,3,C.ivory);
  pitchedRoof(p,-1,-3,39,55,42,11,{color:C.green});
  // A broad civic portico has separate shafts, capitals and shadowed doorway.
  box(p,-1,22,2.3,44,16,1.8,C.stone);
  box(p,-1,21,4.1,38,13,1.7,C.ivory);
  box(p,-1,20,5.8,32,10,1.6,C.stone);
  for(const x of [-21,-8,6,19]){
    box(p,x,21,7.4,6,6,2,C.ivory);
    cylinder(p,x,21,9.4,2.25,24.7,C.ivory);
    cylinder(p,x,21,9.5,2.6,1.4,C.stone);
    box(p,x,21,33.5,5.8,5.8,1.8,C.stone);
    box(p,x,21,35.3,6.5,6.5,2.1,C.ivory);
  }
  box(p,-1,21,37.4,49,8,3.1,C.ivory);
  pitchedRoof(p,-1,20,41,54,13,8,{color:C.green,trim:C.stone});
  entrance(p,-1,15.8,7.4,11,22,{frame:C.ivory,door:C.ink});
  frontWindow(p,-17,15.6,16,7,12);
  frontWindow(p,14,15.6,16,7,12);
  sideWindow(p,24,-10,15,9,14);
  sideWindow(p,24,6,15,9,14);
  // Tall clock tower breaks the portico's horizontal silhouette.
  box(p,19,-13,5.5,16,19,57,C.stone);
  for(const x of [10.4,27.6])box(p,x,-13,6,1.7,20,57,C.ivory);
  box(p,19,-13,60.7,19,22,2.6,C.ivory);
  pitchedRoof(p,19,-13,64,20,23,10,{color:C.roof});
  cylinder(p,19,-13,75.2,1.6,6.4,C.brass);
  facadeDisc(p,19,-2.9,55.5,5.5,C.ivory,1.5,1.25);
  facadeDisc(p,19,-1.8,55.5,4.4,C.paper,.7,1.1);
  box(p,19,-1.3,55.2,3.2,.45,.65,C.ink);
  box(p,19,-1.3,55.5,.65,.45,3.5,C.ink);
  for(const dz of [-3.5,3.5])box(p,19,-1.3,55.2+dz,.55,.45,.7,C.brass);
  for(const dx of [-3.5,3.5])box(p,19+dx,-1.3,55.2,.7,.45,.55,C.brass);
  // Approval seal and two untouched document bundles at the entry.
  facadeDisc(p,-1,17,32,3.1,C.brass,.7,1.1);
  box(p,-1,17.6,30.5,.7,.4,2.8,C.ink);
  box(p,0,17.6,31.7,2,.4,.7,C.ink);
  paperStack(p,-27,23,2.3,7,8,4);
  shrub(p,27,25);
  return p;
}

function exchange() {
  const p=[];foundation(p,68,62);
  box(p,-1,-8,3,45,27,34,C.brick);
  box(p,-1,-8,3,47,29,3,C.stone);
  box(p,-1,-8,35,48,30,2,C.ivory);
  pitchedRoof(p,-1,-8,39,51,32,10,{color:C.copper});
  frontWindow(p,-14,6,23,9,9,{frame:C.timber,glass:C.darkGlass});
  frontWindow(p,4,6,23,9,9,{frame:C.timber,glass:C.darkGlass});
  sideWindow(p,22, -12,14,10,13,{frame:C.ivory});
  entrance(p,16,6,5,7,18,{frame:C.timber,door:C.green});
  // Open dealing counter, striped pitched awning and brass balance.
  for(const x of [-24,24]){
    box(p,x,22,2.3,4.2,4.2,2,C.stone);
    box(p,x,22,4.3,1.8,1.8,29,C.timber);
    box(p,x,22,30.5,4,4,1.5,C.brass);
  }
  roof(p,0,15,33,53,17,5,C.green);
  for(let i=0;i<9;i++)roof(p,-23+i*5.75,15,33.1,2.5,17,5.1,C.ivory);
  box(p,0,23.7,32.8,54,1.3,3,C.green);
  for(let x=-24;x<=24;x+=6)box(p,x,24.5,32.3,2.5,.5,3.6,C.ivory);
  box(p,0,20,5,43,6,11,C.green);
  for(const x of [-16,-6,6,16])box(p,x,23.2,6.8,7,.8,7,C.roof);
  box(p,0,20,16,48,9,1.6,C.timber);
  box(p,0,20,17.6,48,9,.6,C.ivory);
  // The open ledger is an actual small double-sloped solid on the counter.
  roof(p,7,20,18.3,15,11,2.2,C.paper);
  box(p,7,20,20.4,15.5,.65,.7,C.brass);
  for(const y of [16.4,18,21.8,23.4])box(p,7,y,18.8,9,.5,.35,C.stone);
  box(p,-14,19,18.2,1.3,1.3,12,C.brass);
  box(p,-14,19,30.2,13,1.5,1,C.brass);
  for(const x of [-19,-9]){
    box(p,x,19,25, .6,.6,5.2,C.brass);
    cylinder(p,x,19,24.7,3.1,.75,C.brass);
    cylinder(p,x,19,25.45,2.3,.4,C.stone);
  }
  // A recessed quotation board uses engraved geometric marks, not fake data.
  box(p,0,6.8,15,13,1.4,6.2,C.timber);
  box(p,0,7.7,15.8,11.5,.6,4.6,C.ink);
  for(const x of [-4,-1,2,4])box(p,x,8.1,16.7,1,.3,1.2+(x+4)*.15,C.brass);
  crate(p,27,-20,2.3,8,10,8);
  for(let i=0;i<4;i++)cylinder(p,27,-20,10.5+i*.8,2.4,.7,C.brass);
  paperStack(p,-26,-20,2.3,8,9,5);
  return p;
}

function vault() {
  const p=[];foundation(p,68,64);
  // Heavy safe chamber with an offset counting-house tower.
  box(p,1,-1,3,47,38,43,C.stone);
  box(p,1,-1,3,49,40,4,C.ink);
  box(p,1,-1,43,50,41,3,C.ivory);
  box(p,1,-1,46,47,38,3.5,C.green);
  box(p,1,-18,49.5,48,3,3,C.stone);
  box(p,23,-1,49.5,3,36,3,C.stone);
  box(p,-18,-9,3,19,27,60,C.brick);
  box(p,-18,-9,60,22,30,3,C.ivory);
  pitchedRoof(p,-18,-9,64,24,31,10,{color:C.green});
  sideWindow(p,24.8,-9,17,8,13,{frame:C.stone,glass:C.ink});
  sideWindow(p,24.8,6,17,8,13,{frame:C.stone,glass:C.ink});
  frontWindow(p,-18,5.2,43,9,11,{frame:C.ivory});
  // Twenty-centimetre-looking bands, hinges and round layered vault door.
  box(p,3,18.8,8.4,37,2.1,35,C.ink);
  facadeDisc(p,3,20.3,26,16.1,C.ivory,1.6,2.3);
  facadeDisc(p,3,21.5,26,14.3,C.ink,1.4,2.05);
  facadeDisc(p,3,22.6,26,12.9,C.shadow,1.1,1.85);
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6;
    box(p,3+Math.cos(angle)*14.1,23,25.4+Math.sin(angle)*14.1,1.15,.8,1.15,C.brass);
  }
  for(const z of [14,34]){
    box(p,-13.6,22.6,z,5.4,3.6,5,C.ink);
    box(p,-13.6,24.5,z+.9,3.1,.9,3.2,C.brass);
  }
  facadeDisc(p,3,23.6,26,3.8,C.brass,1,1.1);
  box(p,3,24.4,25.5,12,.9,1.3,C.brass);
  box(p,3,24.4,20,1.3,.9,12,C.brass);
  box(p,3,25.1,24.8,2.5,1.1,2.5,C.ink);
  box(p,10.5,24.2,29,2.5,1,4,C.ink);
  box(p,10.5,24.9,30,1.2,.6,1.2,C.brass);
  // Counting tray and physically distinct stacks of coins outside the safe.
  box(p,-24,23,2.3,14,12,2,C.timber);
  for(const [x,y,count,r] of [[-28,22,7,2.5],[-21,25,5,2.8],[-23,19,9,2.4]])for(let level=0;level<count;level++){
    cylinder(p,x,y,4.3+level*.85,r,.72,C.brass);
    if(level===count-1)cylinder(p,x,y,5.05+level*.85,r*.6,.15,C.ivory);
  }
  paperStack(p,25,-23,2.3,8,9,5);
  box(p,-18,-9,75.1,8,7,1.2,C.brass);
  return p;
}

function lab() {
  const p=[];foundation(p,66,62);
  // Glass instrument wing and taller service room support a round observatory.
  box(p,-8,1,3,35,35,29,C.ivory);
  box(p,-8,1,3,37,37,3,C.stone);
  box(p,17,-7,3,17,31,40,C.stone);
  box(p,17,-7,40.5,20,34,3,C.ivory);
  box(p,17,-7,43.5,19,33,2,C.teal);
  box(p,-8,1,31,38,38,2.5,C.ivory);
  box(p,-8,1,33.5,36,36,1.2,C.teal);
  for(const x of [-21,-10,1])frontWindow(p,x,19.4,8,8.3,18,{frame:C.ivory,glass:C.teal});
  sideWindow(p,10.4,13,9,8,17,{frame:C.ivory,glass:C.darkGlass});
  entrance(p,-11,20.2,4,8,19,{frame:C.ivory,door:C.darkGlass});
  box(p,-11,25,2.3,17,10,1.7,C.stone);
  box(p,-11,23.5,4,13,7,1.2,C.ivory);
  // Server/instrument cabinet on the service wing has distinct recessed trays.
  box(p,17,9,7,11,1.5,21,C.ink);
  for(let i=0;i<6;i++){
    box(p,17,10,9+i*2.8,8.2,.7,1.8,C.shadow);
    box(p,13.9,10.5,9.4+i*2.8,.8,.4,.6,C.brass);
  }
  sideWindow(p,26.1,-12,18,8,12,{frame:C.ivory});
  // The drum, stepped dome and brass slit remain a round roof silhouette.
  cylinder(p,-8,-4,34.7,13.4,10,C.ivory);
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    box(p,-8+Math.cos(angle)*11.3,-4+Math.sin(angle)*11.3,38,2.4,2.4,4.7,C.teal);
  }
  cylinder(p,-8,-4,44.7,14.4,3.2,C.teal);
  cylinder(p,-8,-4,47.9,13.2,3.2,C.teal);
  cylinder(p,-8,-4,51.1,11.5,3.2,C.darkGlass);
  cylinder(p,-8,-4,54.3,9.1,3.2,C.teal);
  cylinder(p,-8,-4,57.5,6,2.4,C.teal);
  box(p,-8,-4,50.2,1.8,21.4,4.4,C.brass);
  box(p,-8,-4,54,1.8,16.8,3.7,C.brass);
  box(p,-8,-4,57.5,1.8,9.6,3.1,C.brass);
  // Original stepped telescope assembly: column, fork, oblique optical tube,
  // brass collars and a dark square-cut objective on its high end.
  cylinder(p,17,-7,45.5,4.1,12,C.ink);
  cylinder(p,17,-7,57.5,5.3,2.3,C.brass);
  box(p,17,-7,59.8,8,3.8,8,C.ink);
  for(let i=0;i<5;i++)box(p,4+i*4.1,-7,62+i*2.5,7.3,7.8,7.2,i%2?C.ivory:C.teal);
  box(p,24.7,-7,73,3.6,10.2,10.2,C.brass);
  box(p,26.8,-7,74.3,1.5,7.9,7.9,C.darkGlass);
  box(p,27.7,-8.3,77,.4,3.7,2.5,C.glass);
  box(p,1.2,-7,61.7,4.4,5.6,4.8,C.ink);
  // Sample trays and a compact outside instrument chest.
  box(p,20,24,2.3,13,10,9,C.teal);
  box(p,20,24,11.3,14,11,1.3,C.ivory);
  for(const x of [16.5,20,23.5])cylinder(p,x,24,12.6,1.1,3.4,C.brass,8);
  shrub(p,-27,-23);
  return p;
}

function dispatch() {
  const p=[];foundation(p,64,62);
  box(p,-5,0,3,35,29,27,C.ivory);
  box(p,-5,0,3,37,31,3,C.stone);
  pitchedRoof(p,-5,0,32,41,35,11,{color:C.copper});
  box(p,15,-7,3,14,20,37,C.brick);
  box(p,15,-7,38,17,23,2,C.ivory);
  pitchedRoof(p,15,-7,41,19,25,10,{color:C.green});
  entrance(p,1,15.2,5,8,18,{frame:C.stone,door:C.green});
  frontWindow(p,-14,15.2,16,9,10,{frame:C.timber,glass:C.darkGlass});
  sideWindow(p,22.5,-9,16,8,11,{frame:C.ivory});
  box(p,-14,17.4,15.4,13,4,1.2,C.timber);
  paperStack(p,-15.5,18,16.8,6,5,3);
  // Sorting hatch, stamped envelope sign and two freestanding collection boxes.
  box(p,15,4.2,16,8,1.3,10,C.ivory);
  box(p,15,5.1,17,6,.8,7.8,C.green);
  box(p,15,5.7,21.6,4.5,.4,.9,C.ink);
  box(p,15,-7,52,1.1,1.1,10,C.ink);
  box(p,15,-7,58,10,1.7,6,C.paper);
  box(p,17.8,-5.9,61,1.7,.4,1.4,C.brass);
  box(p,13,-5.9,59,3.6,.4,.45,C.stone);
  box(p,24,22,2.3,8,9,13,C.teal);
  roof(p,24,22,15.3,9,10,3,C.green);
  box(p,24,26.9,11.5,5.5,.45,1.1,C.ink);
  box(p,24,27.2,5.5,5.2,.35,4,C.ivory);
  box(p,24,27.5,7.2,2.8,.3,.5,C.brass);
  box(p,29.2,22,10,1,1,13,C.ink);
  box(p,30.4,22,20,3,4.2,2.8,C.brass);
  // Dispatch table carries small layered envelopes with stamped corners.
  box(p,-22,22,2.3,13,10,7,C.timber);
  for(let i=0;i<4;i++){
    box(p,-22+i*.25,22-i*.2,9.3+i*.65,10.2,7.4,.5,C.paper);
    roof(p,-22+i*.25,22-i*.2,9.8+i*.65,9.7,7.1,.8,C.ivory);
  }
  box(p,-19,24.3,12.8,2.2,2,.35,C.brass);
  crate(p,-25,-21,2.3,10,10,7);
  paperStack(p,-25,-21,9.8,8,7,4);
  return p;
}

const factories=Object.freeze({archive,review,exchange,vault,lab,dispatch});

function model(parts) {
  const minX=Math.min(...parts.map(part=>part.x-(part.shape==='cylinder'?part.r:part.w/2)));
  const maxX=Math.max(...parts.map(part=>part.x+(part.shape==='cylinder'?part.r:part.w/2)));
  const minY=Math.min(...parts.map(part=>part.y-(part.shape==='cylinder'?part.r:part.d/2)));
  const maxY=Math.max(...parts.map(part=>part.y+(part.shape==='cylinder'?part.r:part.d/2)));
  return {parts,width:maxX-minX,depth:maxY-minY,height:Math.max(...parts.map(part=>part.z+part.h))};
}

export function createBuilding(kind) {
  if(!Object.hasOwn(factories,kind))throw new RangeError(`Unknown clearing-house building: ${kind}`);
  const factory=factories[kind];
  return model(factory());
}

/** Small paper-carrying town clerk; same coordinate and primitive contract. */
export function createClerk({coat=C.green,hat=C.ink,skin='#c69976'}={}) {
  const p=[];
  box(p,-1.5,0,0,2.1,3.6,6.3,C.ink);
  box(p,1.5,0,0,2.1,3.6,6.3,C.ink);
  box(p,-1.5,1,0,2.5,4.8,1.4,C.timber);
  box(p,1.5,1,0,2.5,4.8,1.4,C.timber);
  box(p,0,0,6.1,6.4,4.2,7.2,coat);
  box(p,-4,0,7,1.8,3.1,5.4,coat);
  box(p,4,0,8,1.8,3.1,4.4,coat);
  cylinder(p,0,0,13.3,2.3,4.5,skin,10);
  cylinder(p,0,0,17.8,3.1,.8,hat,10);
  cylinder(p,0,-.2,18.6,2.35,1.5,hat,10);
  box(p,0,2.25,14.4,2.8,.35,.5,C.ink);
  box(p,1.8,2.4,7.8,5.1,1.2,4.8,C.paper);
  box(p,3,3.1,10.9,1.2,.35,.8,C.brass);
  return model(p);
}
