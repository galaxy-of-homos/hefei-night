import {blocked,clamp,move} from './core.mjs';
import {immuneToNegative} from './vr-hunter.mjs';

export const TRAFFIC_STUN=3,TRAFFIC_FLIGHT=1.05,ROAD_EDGE=8.5;
export const ROAD_GENERATORS=[[-16,-29],[18,-25],[-28,-6],[16,1],[-17,17],[19,30],[-27,34]];
export const ROAD_GATES=[[-36,0,'西侧大楼出口'],[36,0,'东侧大楼出口']];
export const ROAD_CAGES=[[-25,-33],[19,10],[-19,9]];
export const ROAD_CHESTS=[{x:-35,z:-36},{x:35,z:-36},{x:-35,z:36},{x:35,z:36},{x:-14,z:2}];
export function createTraffic(){
  return [-5.8,-2,2,5.8].flatMap((x,lane)=>[0,1].map(i=>({id:lane*2+i,x,z:-38+i*48+lane*9,direction:lane<2?1:-1,speed:10+lane*.8,angle:lane<2?0:Math.PI,lift:0,travel:0})));
}
export const trafficState=car=>Object.fromEntries(['id','x','z','direction','speed','angle','lift','travel'].map(k=>[k,car[k]]));
export function stepTrafficFlight(actor,dt,obstacles=[]){
  actor.trafficImmunity=Math.max(0,(actor.trafficImmunity||0)-dt);
  if(immuneToNegative(actor)){actor.trafficFlight=0;return;}
  if(actor.state!=='active'){actor.trafficFlight=0;return;}
  let left=Math.min(dt,actor.trafficFlight||0);
  while(left>1e-7){const step=Math.min(.01,left);move(actor,actor.trafficVX*step,actor.trafficVZ*step,obstacles);left-=step;}
  actor.trafficFlight=Math.max(0,(actor.trafficFlight||0)-dt);
}
export const trafficHeight=actor=>actor.trafficFlight>0?Math.sin(Math.PI*clamp(1-actor.trafficFlight/TRAFFIC_FLIGHT,0,1))*3:0;
export function stepTraffic(cars,dt,actors=[],cats=[],obstacles=[]){
  const hits=[],flattened=[],lifted=[];
  for(const car of cars){
    const oldZ=car.z,travel=car.direction*car.speed*dt;
    car.z+=travel;car.travel+=Math.abs(travel);car.lift=Math.max(0,(car.lift||0)-dt);
    const low=Math.min(oldZ,car.z)-2.15,high=Math.max(oldZ,car.z)+2.15;
    const contact=a=>Math.abs(a.x-car.x)<1.45&&a.z>=low&&a.z<=high;
    if(!car.lift){
      const orange=cats.find(c=>c.legendary&&!['kicked','flattened'].includes(c.phase)&&contact(c));
      if(orange){car.lift=1.1;lifted.push(orange);}
      else {
        for(const actor of actors){
          if(actor.state!=='active'||immuneToNegative(actor)||actor.invincible>0||actor.trafficImmunity>0||actor.trafficFlight>0||actor.launchTime>0||actor.shoeTime>0||!contact(actor))continue;
          const side=(actor.x||car.x)>=0?1:-1;
          let target={x:side*11.6,z:clamp(actor.z+car.direction*2,-35,35)};
          for(const offset of [0,2,-2,4,-4]){const candidate={...target,z:clamp(target.z+offset,-36,36)};if(!blocked(candidate.x,candidate.z,obstacles,.6)){target=candidate;break;}}
          Object.assign(actor,{trafficFlight:TRAFFIC_FLIGHT,trafficVX:(target.x-actor.x)/TRAFFIC_FLIGHT,trafficVZ:(target.z-actor.z)/TRAFFIC_FLIGHT,trafficImmunity:4,trafficSerial:(actor.trafficSerial||0)+1,
            stun:Math.max(actor.stun||0,TRAFFIC_STUN),launchTime:0,jumpTime:0,driving:false,drivePhase:'crashed',moving:false,interacting:false,attack:0,swing:0,hitDelay:0,path:[],repath:0});
          hits.push(actor);
        }
        for(const cat of cats)if(!cat.legendary&&!['flattened','kicked'].includes(cat.phase)&&contact(cat))flattened.push(cat);
      }
    }
    if(car.z>48)car.z-=96;if(car.z< -48)car.z+=96;
  }
  return {hits,flattened:[...new Set(flattened)],lifted};
}
