import {blocked,clamp,move} from './core.mjs';
import {immuneToNegative} from './vr-hunter.mjs';

export const TRAFFIC_STUN=3,TRAFFIC_FLIGHT=1.05,ROAD_EDGE=8.5;
export const ROAD_CROSSINGS=[-22,22],ROAD_FENCE_X=8.9,ROAD_GAP_HALF=1.8,TRAFFIC_AIR_SECONDS=1.1;
export const roadFenceSegments=()=>[-1,1].flatMap(side=>[[-39,ROAD_CROSSINGS[0]-ROAD_GAP_HALF],[ROAD_CROSSINGS[0]+ROAD_GAP_HALF,ROAD_CROSSINGS[1]-ROAD_GAP_HALF],[ROAD_CROSSINGS[1]+ROAD_GAP_HALF,39]].map(([start,end])=>({x:side*ROAD_FENCE_X,z:(start+end)/2,w:.18,d:end-start,roadFence:true})));
export function launchTrafficCar(car,source=null){
 if(car.lift>0||car.phase==='wreck')return false;car.baseX??=car.x;const wheels=trafficKind(car).wheels;car.serial=(car.serial||0)+1;
 const dx=source?car.x-source.x:0,dz=source?car.z-source.z:0,base=Math.hypot(dx,dz)>.1?Math.atan2(dx,dz):(source?.angle??car.angle??0),spread=Math.sin((car.id||0)*2.17+car.serial)*.3,angle=base+spread;
 car.airTotal=2.2+(wheels-2)*.25;car.lift=car.airTotal;car.flightHeight=16+(wheels-2)*4;car.flightVX=Math.sin(angle)*(28+wheels*3);car.flightVZ=Math.cos(angle)*(28+wheels*3);car.phase='airborne';car.wreckTime=0;car.debrisHitIds=new Set();return true;
}
export const trafficVehicleHeight=car=>car.lift>0?4*(1-car.lift/car.airTotal)*(car.lift/car.airTotal)*(car.flightHeight||16):0;
function respawnTraffic(car){Object.assign(car,{x:car.baseX,z:car.direction>0?-48:48,phase:'driving',lift:0,wreckTime:0,angle:car.direction>0?0:Math.PI,flightVX:0,flightVZ:0,serial:(car.serial||0)+1});}

export const ROAD_GENERATORS=[[-16,-29],[18,-25],[-28,-6],[16,1],[-17,17],[19,30],[-27,34]];
export const ROAD_GATES=[[-36,0,'西侧大楼出口'],[36,0,'东侧大楼出口']];
export const ROAD_CAGES=[[-25,-33],[19,10],[-19,9]];
export const ROAD_CHESTS=[{x:-35,z:-36},{x:35,z:-36},{x:-35,z:36},{x:35,z:36},{x:-14,z:2}];
export const TRAFFIC_KINDS={car:{name:'汽车',wheels:4,halfWidth:.9,halfLength:1.75},tricycle:{name:'三轮车',wheels:3,halfWidth:.72,halfLength:1.25},electric:{name:'电动车',wheels:2,halfWidth:.42,halfLength:1.05}};
export const trafficKind=c=>TRAFFIC_KINDS[c.kind]||TRAFFIC_KINDS.car;
export const TRAFFIC_NPC_FIELDS=['trafficFlight','trafficVX','trafficVZ','trafficImmunity','trafficSerial','trafficStun'];
export function createTraffic(){
  return [-5.8,-2,2,5.8].flatMap((x,lane)=>[0,1,2].map(i=>{const kind=['car','tricycle','electric'][(lane+i)%3];return {id:lane*3+i,kind,baseX:x,x,z:-38+i*32+lane*3,direction:lane<2?1:-1,speed:kind==='electric'?14:kind==='tricycle'?11:10,angle:lane<2?0:Math.PI,lift:0,travel:0,chaos:true,serial:0,phase:'driving',wreckTime:0};}));
}
export const trafficState=car=>Object.fromEntries(['id','kind','baseX','x','z','direction','speed','angle','lift','airTotal','flightHeight','phase','wreckTime','flightVX','flightVZ','travel','chaos','serial'].map(k=>[k,car[k]]));
export function ramTraffic(driver,vehicle){
  if(vehicle.lift>0||vehicle.phase==='wreck')return null;
  if(trafficKind(vehicle).wheels<4){
    const angle=vehicle.angle||0;
    Object.assign(driver,{drivePhase:'airborne',driveTime:0,driveAirTime:1.8,driveAirTotal:1.8,driveVX:Math.sin(angle)*24/1.8,driveVZ:Math.cos(angle)*24/1.8,launchTime:0,moving:false,swing:0,hitDelay:0,stun:Math.max(driver.stun||0,1.8)});
    return 'driver';
  }
  launchTrafficCar(vehicle,driver);return 'traffic';
}
export function stepTrafficFlight(actor,dt,obstacles=[]){
  actor.trafficImmunity=Math.max(0,(actor.trafficImmunity||0)-dt);
  if(immuneToNegative(actor)||actor.state&&actor.state!=='active'||actor.active===false){actor.trafficFlight=0;return;}
  let left=Math.min(dt,actor.trafficFlight||0);
  const flightObstacles=actor.trafficFlight>0?obstacles.filter(o=>!o.roadFence):obstacles;
  while(left>1e-7){const step=Math.min(.01,left);move(actor,(actor.trafficVX||0)*step,(actor.trafficVZ||0)*step,flightObstacles);left-=step;}
  actor.trafficFlight=Math.max(0,(actor.trafficFlight||0)-dt);
}
export function stepTrafficNpc(npc,dt,obstacles=[]){
  if(!(npc.trafficStun>0)&&!(npc.trafficFlight>0)){npc.trafficImmunity=Math.max(0,(npc.trafficImmunity||0)-dt);return false;}
  stepTrafficFlight(npc,dt,obstacles);npc.trafficStun=Math.max(0,(npc.trafficStun||0)-dt);npc.moving=false;return true;
}
export const trafficHeight=actor=>actor.trafficFlight>0?Math.sin(Math.PI*clamp(1-actor.trafficFlight/TRAFFIC_FLIGHT,0,1))*3:0;
function launchActor(actor,car,obstacles){
  const side=(actor.x||car.x)>=0?1:-1;
  let target={x:side*11.6,z:clamp(actor.z+car.direction*2,-35,35)};
  for(const offset of [0,2,-2,4,-4]){const candidate={...target,z:clamp(target.z+offset,-36,36)};if(!blocked(candidate.x,candidate.z,obstacles,.6)){target=candidate;break;}}
  Object.assign(actor,{trafficFlight:TRAFFIC_FLIGHT,trafficVX:(target.x-actor.x)/TRAFFIC_FLIGHT,trafficVZ:(target.z-actor.z)/TRAFFIC_FLIGHT,trafficImmunity:4,trafficSerial:(actor.trafficSerial||0)+1,
    stun:Math.max(actor.stun||0,TRAFFIC_STUN),launchTime:0,jumpTime:0,driving:false,drivePhase:'crashed',moving:false,interacting:false,attack:0,swing:0,hitDelay:0,path:[],repath:0});
}
// Relative swept rectangles catch both head-on traffic and side-swipes without tunnelling.
export function trafficContact(a,oldA,b,oldB,halfWidth,halfLength){
  let enter=0,leave=1;
  for(const [key,extent] of [['x',halfWidth],['z',halfLength]]){
    const origin=oldA[key]-oldB[key],delta=(a[key]-oldA[key])-(b[key]-oldB[key]);
    if(Math.abs(delta)<1e-9){if(Math.abs(origin)>extent)return false;continue;}
    let low=(-extent-origin)/delta,high=(extent-origin)/delta;if(low>high)[low,high]=[high,low];enter=Math.max(enter,low);leave=Math.min(leave,high);if(enter>leave)return false;
  }return true;
}
export function stepTraffic(cars,dt,actors=[],cats=[],obstacles=[],npcs=[]){
  const hits=[],flattened=[],lifted=[],rammed=[],driverHits=[],npcHits=[],catLaunched=[],crashes=[],impactHits=[];
  const previous=new Map(cars.map(c=>[c,{x:c.x,z:c.z,y:trafficVehicleHeight(c)}])),debris=new Set(),respawned=new Set();
  for(const car of cars){
    car.baseX??=car.x;const travel=car.direction*car.speed*dt;car.travel+=Math.abs(travel);
    if(car.phase==='wreck'){car.wreckTime=Math.max(0,(car.wreckTime||0)-dt);if(car.wreckTime<=0){respawnTraffic(car);previous.set(car,{x:car.x,z:car.z,y:0});respawned.add(car);}continue;}
    if(car.lift>0){debris.add(car);const step=Math.min(dt,car.lift);car.x+=(car.flightVX||0)*step;car.z+=(car.flightVZ||0)*step;car.lift=Math.max(0,car.lift-dt);if(car.lift===0){car.phase='wreck';car.wreckTime=3;}}
    else{car.z+=travel;if(car.chaos&&car.speed>0){const amplitude=car.kind==='electric'?3.1:car.kind==='tricycle'?1.5:.55,target=clamp(car.baseX+Math.sin(car.travel*.09+car.id*1.7)*amplitude,-6.6,6.6),dx=clamp(target-car.x,-3*dt,3*dt);car.x+=dx;car.angle=car.direction>0?Math.atan2(dx,Math.max(.001,travel)):Math.PI-Math.atan2(dx,Math.max(.001,-travel));}}
  }
  // The legendary orange cat has priority even over an electric bike.
  for(const car of cars)if(!car.lift&&car.phase!=='wreck'&&!respawned.has(car)){const k=trafficKind(car),old=previous.get(car),orange=cats.find(c=>c.legendary&&c.phase!=='kicked'&&trafficContact(car,old,c,c,k.halfWidth+.5,k.halfLength+.4));if(orange){launchTrafficCar(car,orange);lifted.push(orange);}}
  for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
    const a=cars[i],b=cars[j],ka=trafficKind(a),kb=trafficKind(b);
    if(a.lift>0||b.lift>0||a.phase==='wreck'||b.phase==='wreck'||respawned.has(a)||respawned.has(b))continue;
    if(!trafficContact(a,previous.get(a),b,previous.get(b),ka.halfWidth+kb.halfWidth,ka.halfLength+kb.halfLength))continue;
    if(ka.wheels>=kb.wheels){launchTrafficCar(a,b);crashes.push(a);}if(kb.wheels>=ka.wheels){launchTrafficCar(b,a);crashes.push(b);}
  }
  for(const car of cars){
    const old=previous.get(car),k=trafficKind(car),contact=a=>trafficContact(car,old,a,a,k.halfWidth+.48,k.halfLength+.4);
    if(debris.has(car)){
      // A flying chassis can strike a character only while passing through body height.
      if(Math.min(old.y,trafficVehicleHeight(car))<=2.7)for(const actor of actors){const id=actor.id??4;if(actor.state!=='active'||immuneToNegative(actor)||car.debrisHitIds?.has(id)||!contact(actor))continue;car.debrisHitIds??=new Set();car.debrisHitIds.add(id);Object.assign(actor,{stun:Math.max(actor.stun||0,3),moving:false,interacting:false,swing:0,attack:0,hitDelay:0,path:[],repath:0});impactHits.push(actor);}
      continue;
    }
    if(car.phase==='wreck'||respawned.has(car))continue;
    if(!car.lift){
      const driver=actors.find(a=>a.state==='active'&&a.driving&&a.drivePhase==='driving'&&(a.hunterCharacter??0)===0&&contact(a));
      if(driver){if(ramTraffic(driver,car)==='driver')driverHits.push(driver);else rammed.push(car);}
      if(!car.lift){
        for(const actor of actors){
          if(actor===driver||actor.state!=='active'||immuneToNegative(actor)||actor.invincible>0&&car.kind!=='electric'||actor.trafficImmunity>0||actor.trafficFlight>0||actor.launchTime>0||actor.shoeTime>0||actor.driving&&actor.drivePhase==='airborne'||!contact(actor))continue;
          launchActor(actor,car,obstacles);hits.push(actor);
        }
        for(const cat of cats)if(!cat.legendary&&cat.phase!=='kicked'&&!(cat.trafficImmunity>0)&&contact(cat)){
          if(car.kind==='electric'){launchActor(cat,car,obstacles);cat.trafficStun=3;catLaunched.push(cat);}else if(cat.phase!=='flattened')flattened.push(cat);
        }
        if(car.kind==='electric')for(const npc of npcs)if(npc&&npc.active!==false&&!(npc.trafficImmunity>0)&&!immuneToNegative(npc)&&contact(npc)){launchActor(npc,car,obstacles);npc.trafficStun=3;npcHits.push(npc);}
      }
    }
    if(!car.lift&&car.phase!=='wreck'){while(car.z>48)car.z-=96;while(car.z< -48)car.z+=96;}
  }
  return {hits,flattened:[...new Set(flattened)],lifted,rammed,driverHits,npcHits,catLaunched,crashes,impactHits};
}
