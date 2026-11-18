import assert from 'node:assert/strict';
import fs from 'node:fs';
import {launchTrafficCar,createTraffic,stepTraffic,stepTrafficNpc,trafficState,trafficHeight,trafficKind} from '../dist/road-traffic.mjs';
import {beginDrive,stepDrivenCar} from '../dist/drive-car.mjs';
import {createKuchi,stepKuchi,kuchiState} from '../dist/kuchi.mjs';
import {createSeekerPig,stepSeekerPig,seekerPigState} from '../dist/seeker-pig.mjs';
import {createRedEye,stepRedEye,redEyeState} from '../dist/red-eye.mjs';
const vehicle=(kind,id=0,x=0,z=0)=>({id,kind,x,z,direction:1,speed:0,angle:0,travel:0,lift:0,chaos:false});
const actor=(x=0,z=0)=>({x,z,state:'active',hp:2,stun:0});
const traffic=createTraffic();assert.equal(traffic.length,12);for(const kind of ['car','tricycle','electric'])assert.equal(traffic.filter(c=>c.kind===kind).length,4);
for(const [strong,weak] of [['electric','car'],['electric','tricycle'],['tricycle','car']])for(const reversed of [false,true]){
  const a=vehicle(strong,0),b=vehicle(weak,1);stepTraffic(reversed?[b,a]:[a,b],.02);assert.equal(a.lift,0,`${strong} wins in either iteration order`);assert(b.lift>0,`${weak} is launched`);
}
const same=[vehicle('electric',0),vehicle('electric',1)];stepTraffic(same,.02);assert(same.every(c=>c.lift>0),'equal two-wheel impact launches both');
for(const kind of ['car','tricycle','electric']){
  const driver={...actor(),angle:0,cooldown:0,hunterCharacter:0};beginDrive(driver);const target=vehicle(kind,0,0,5);let result;
  for(let i=0;i<30;i++){result=stepDrivenCar(driver,0,.02,[],[],new Set(),[],[],[target]);if(result.trafficCounterHit||result.trafficHits.length)break;}
  assert.equal(driver.drivePhase,kind==='car'?'driving':'airborne');assert.equal(target.lift>0,kind==='car');
}
const ordinary=actor(),olo={...actor(),characterId:6},vr={...actor(),hunterCharacter:1,vrTime:10};stepTraffic([vehicle('electric')],.02,[ordinary,olo,vr]);assert(ordinary.trafficFlight>0);assert.equal(olo.stun,0);assert.equal(vr.stun,0);assert.equal(ordinary.hp,2);
const orange={x:0,z:0,legendary:true,phase:'roaming'},cat={x:0,z:0,legendary:false,phase:'roaming'};
const electric=vehicle('electric');const defended=stepTraffic([electric],.02,[],[cat,orange]);assert(electric.lift>0);assert.equal(defended.catLaunched.length,0);assert.equal(orange.phase,'roaming');
const dog=createKuchi({x:0,z:0},()=>.5),owner={...actor(25,25),id:2},pig=createSeekerPig(owner,1),red=createRedEye(owner,{x:0,z:0},2);Object.assign(pig,{x:0,z:0,phase:'hunting'});
const normalCat={x:0,z:0,phase:'roaming',legendary:false};const hit=stepTraffic([vehicle('electric')],.02,[],[normalCat],[],[dog,pig,red]);assert.equal(hit.npcHits.length,3);assert.equal(hit.catLaunched.length,1);
for(const [npc,step,state] of [[dog,()=>stepKuchi(dog,.5),kuchiState],[pig,()=>stepSeekerPig(pig,.5,[]),seekerPigState],[red,()=>stepRedEye(red,.5,actor(30,30),[]),redEyeState]]){step();assert(trafficHeight(npc)>2.9);assert(state(npc).trafficFlight>0);assert(npc.trafficStun>2);assert(npc.active!==false);}
for(let i=0;i<150;i++)for(const npc of [dog,pig,red,normalCat])stepTrafficNpc(npc,.02);assert([dog,pig,red,normalCat].every(n=>n.trafficFlight===0&&n.trafficStun===0));
const headOn=[{...vehicle('car',0,0,-10),speed:40},{...vehicle('electric',1,0,10),speed:40,direction:-1}];stepTraffic(headOn,.4);assert(headOn[0].lift>0);assert.equal(headOn[1].lift,0,'swept head-on collision respects wheel priority');
let collisions=0;const natural=createTraffic();for(let i=0;i<3000;i++){collisions+=stepTraffic(natural,.02).crashes.length;for(const c of natural)assert(Number.isFinite(c.x)&&Number.isFinite(c.z)&&Math.abs(c.x)<1000&&Math.abs(c.z)<1000&&(c.lift>0||c.phase==='wreck'||Math.abs(c.x)<=7.11&&Math.abs(c.z)<=48));}
assert(collisions>=10,'ordinary traffic produces collisions without staged positions');
const debris=vehicle('car',8,-20,0);launchTrafficCar(debris);Object.assign(debris,{airTotal:2,lift:2,flightHeight:20,flightVX:20,flightVZ:0});
const victim={...actor(20,0),id:0},immune={...actor(20,0),id:1,characterId:6};let impacts=0;for(let i=0;i<101;i++)impacts+=stepTraffic([debris],.02,[victim,immune]).impactHits.length;
assert.equal(impacts,1);assert.equal(victim.stun,3);assert.equal(victim.hp,2);assert.equal(immune.stun,0);assert.equal(debris.phase,'wreck');
const wreckX=debris.x;stepTraffic([debris],2.8,[victim]);assert.equal(debris.phase,'wreck');assert.equal(debris.x,wreckX);stepTraffic([debris],.21);assert.equal(debris.phase,'driving');assert.equal(debris.z,-48);
const distant=vehicle('car',10);launchTrafficCar(distant,{x:-1,z:0});for(let i=0;i<80;i++)stepTraffic([distant],.04);assert(Math.abs(distant.x)>39||Math.abs(distant.z)>39,'flying wrecks may leave the playable map');assert.equal(distant.phase,'wreck');
const three=new URL('../dist/vendor/three.module.js',import.meta.url).href;
const data=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const carModule=data(fs.readFileSync(new URL('../dist/car-visual.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${three}'`));
const visualModule=data(fs.readFileSync(new URL('../dist/traffic-visual.mjs',import.meta.url),'utf8').replace("from 'three'",`from '${three}'`).replace("from './car-visual.mjs'",`from '${carModule}'`));
const {createTrafficVisual}=await import(visualModule);for(const kind of ['car','tricycle','electric']){const root=createTrafficVisual(kind);assert.equal(root.userData.wheelCount,trafficKind({kind}).wheels);assert(root.children.length>10);}
const report={passed:true,trafficCount:12,fourOfEachType:true,physicalWheelCounts:true,orderIndependentWheelPriority:true,electricVsElectricBothFly:true,classicCarCounteredByFewerWheels:true,oloAndVRImmunityPreserved:true,legendaryOrangeDefeatsElectric:true,catDogPigRedEyeLaunched:true,npcFlightAndStunReplicated:true,sweptHeadOnContact:true,naturalCollisionsIn60Seconds:collisions,finiteBoundedTraffic:true,debrisStunsOnceFor3Seconds:true,landedWreckLasts3SecondsThenRespawns:true,vehiclesCanFlyOutsideMap:true};
fs.writeFileSync(new URL('../../traffic-chaos-unit-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
