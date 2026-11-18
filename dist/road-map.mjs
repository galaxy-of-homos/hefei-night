import * as T from 'three';
import {ROAD_GENERATORS,ROAD_GATES,ROAD_CAGES,ROAD_CROSSINGS,roadFenceSegments} from './road-traffic.mjs';

export const ROAD_SHOPS=[{name:'老乡鸡',color:'#aee1ab',background:'#145539'},{name:'麦当劳',color:'#ffdf55',background:'#9d2026'},{name:'肯德基',color:'#fff2de',background:'#9e2933'},{name:'必胜客',color:'#fff0ce',background:'#86242a'},{name:'逼养的火鸡面',color:'#ffe5b0',background:'#4c202a'}];
export const ROAD_BILLBOARD='星星大战9舔性者撅起';

// Geometry and collision boxes are created together; the archways remain walkable.
export function buildRoadMap({scene,obs,createGenerator,createGate,createCage}){
  const mats={},material=(name,color,glow=0)=>mats[name]??=new T.MeshStandardMaterial({color,roughness:.78,emissive:glow?color:'#000000',emissiveIntensity:glow});
  const asphalt=material('asphalt','#25323c'),sidewalk=material('paving','#80908d'),concrete=material('concrete','#41545c'),dark=material('dark','#243943'),white=material('white','#d8d6b9'),yellow=material('yellow','#edc467'),glass=material('glass','#97cacc',.7),brick=material('brick','#67514a'),green=material('green','#38534c');
  function box(x,y,z,w,h,d,mat,collision=false){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=h>.3;mesh.receiveShadow=true;scene.add(mesh);if(collision)obs.push({x,z,w,d});return mesh;}
  function text(label,x,y,z,w=6,color='#f2d291',rotate=0,background='#152f3d',poster=false){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=poster?384:192;const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,768,canvas.height);ctx.strokeStyle=color;ctx.lineWidth=6;ctx.strokeRect(8,8,752,canvas.height-16);ctx.fillStyle=color;ctx.font='bold 76px Microsoft YaHei';ctx.textAlign='center';ctx.textBaseline='middle';
    if(poster){ctx.font='bold 92px Microsoft YaHei';ctx.fillText('星星大战9',384,130,710);ctx.fillStyle='#ffb19c';ctx.font='bold 82px Microsoft YaHei';ctx.fillText('舔性者撅起',384,265,710);}else ctx.fillText(label,384,100,740);
    const texture=new T.CanvasTexture(canvas),mesh=new T.Mesh(new T.PlaneGeometry(w,w*canvas.height/canvas.width),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));mesh.userData.signText=label;mesh.name=poster?'RoadBillboard':'RoadSign';mesh.position.set(x,y,z);mesh.rotation.y=rotate;scene.add(mesh);return mesh;
  }
  box(0,-.16,0,160,.2,160,dark);
  box(0,-.025,0,17,.05,88,asphalt);
  for(const side of [-1,1]){
    box(side*24,-.025,0,31,.05,80,sidewalk);
    box(side*8.65,.045,0,.3,.09,80,concrete);
    for(let z=-38;z<40;z+=4)box(side*3.9,.018,z,.12,.025,2,white);
    box(side*.16,.02,0,.10,.025,80,yellow);
    box(side*8,.019,0,.13,.025,80,white);
    for(const z of [-25,0,25])for(let x=9;x<38;x+=2)box(side*x,.014,z,.03,.016,8,concrete);
    // Bollards and bus shelters sit outside the knockback landing strip.
    for(const z of [-30,-16,16,30]){
      box(side*10.1,2.3,z,.11,4.6,.11,dark);
      box(side*9.3,4.5,z,1.8,.12,.32,dark);box(side*9.2,4.39,z,.9,.08,.24,material('lamp','#ffe8a1',2));
    }
    for(const z of [-12,20]){
      box(side*16,2.7,z,4.8,.18,2.5,dark);
      for(const dz of [-.9,.9])box(side*17.9,1.35,z+dz,.14,2.7,.14,dark,true);
      box(side*18,1.2,z, .12,2.3,2,glass);
      box(side*16,.7,z,2.7,.15,.7,brick,true);
    }
    for(const z of [-26,-13,13,27]){
      const x=side*29,h=8+(Math.abs(z)%4)*2,w=13,d=8;
      box(x,h/2,z,w,h,d,Math.abs(z)%2?brick:concrete,true);
      box(x,h+.2,z,w+.5,.4,d+.5,dark);
      for(let floor=0;floor<3;floor++)for(const dz of [-2.5,0,2.5])box(side*22.46,2.3+floor*2.7,z+dz,.06,1.3,1.45,glass);
      const shop=ROAD_SHOPS[([-26,-13,13,27].indexOf(z)+(side>0?4:0))%ROAD_SHOPS.length];
      box(side*21.6,2.9,z,1.8,.18,7,material(shop.name,shop.background));
      text(shop.name,side*22.35,3.9,z,6,shop.color,side>0?-Math.PI/2:Math.PI/2,shop.background);
    }
    // Each escape gate sits INSIDE the ground-floor opening of a tower.
    const gx=side*36;
    box(gx,2.6,-5.9,5,5.2,6,concrete,true);box(gx,2.6,5.9,5,5.2,6,concrete,true);
    box(gx,10,0,5,9.6,18,dark);box(gx,5.4,0,5,.4,6,concrete);
    for(let floor=0;floor<3;floor++)for(const z of [-6,-3,0,3,6])box(side*33.46,7+floor*2.5,z,.07,1.4,1.3,glass);
    text('逃脱通道',side*33.4,4.7,0,5,'#aaf4cf',side>0?-Math.PI/2:Math.PI/2);
    for(const z of [-38,38])box(side*24,1.4,z,30,2.8,.6,dark,true);
    box(side*39.5,1.5,0,.6,3,80,dark,true);
    for(const z of [-35,6,35]){
      const x=side*20;box(x,.55,z,2,1.1,1.2,brick,true);box(x,1.25,z,2,.35,1.2,green);
    }
  }
  text(ROAD_BILLBOARD,22.25,8.6,13,10,'#ffe0a0',-Math.PI/2,'#18263c',true);
  // Three solid fence stretches on each curb leave exactly four pedestrian gaps.
  const posts=[];
  for(const fence of roadFenceSegments()){
    obs.push(fence);
    for(const y of [.28,1.25])box(fence.x,y,fence.z,.13,.10,fence.d,dark);
    const count=Math.ceil(fence.d/.55);
    for(let i=0;i<=count;i++)posts.push([fence.x,.7,fence.z-fence.d/2+i*fence.d/count]);
  }
  const bars=new T.InstancedMesh(new T.BoxGeometry(.07,1.4,.07),dark,posts.length),matrix=new T.Matrix4();
  posts.forEach((p,i)=>{matrix.makeTranslation(...p);bars.setMatrixAt(i,matrix);});bars.castShadow=bars.receiveShadow=true;bars.name='RoadsideFences';scene.add(bars);
  // Two marked crossing points; traffic is dangerous even on the stripes.
  for(const z of ROAD_CROSSINGS)for(let x=-7;x<8;x+=2)box(x,.022,z,1.1,.025,3.5,white);
  text('合 肥 车 道',0,6.5,-34,9,'#f2d291');
  for(const side of [-1,1])box(side*9,3.3,-34,.18,6.6,.18,dark);
  box(0,6.8,-34,18,.18,.18,dark);
  ROAD_GENERATORS.forEach(([x,z],id)=>createGenerator(x,z,id));
  ROAD_GATES.forEach(p=>createGate(...p));ROAD_CAGES.forEach(p=>createCage(...p));
  return {materials:new Set(Object.values(mats))};
}
