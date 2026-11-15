import assert from 'node:assert/strict';
import {createTraffic,stepTraffic,stepTrafficFlight,trafficHeight,ROAD_GENERATORS,ROAD_GATES,ROAD_CHESTS,ROAD_CAGES} from '../dist/road-traffic.mjs';
import {createCat,stepCats,flattenCats} from '../dist/hakimi.mjs';
import {blocked,findPath} from '../dist/core.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import {context} from './test-restored.mjs';

const actor=(x=-5.8,z=0)=>({x,z,state:'active',hp:2,stun:0});
const car=()=>({...createTraffic()[0],z:-8,speed:20});
const a=actor(),c=car();
assert.equal(stepTraffic([c],.8,[a]).hits[0],a,'swept collision catches a car passing fully through a player');
assert.equal(a.stun,3);assert.equal(a.hp,2);assert.equal(a.trafficSerial,1);
stepTrafficFlight(a,.525);assert(trafficHeight(a)>2.99);
stepTrafficFlight(a,.525);assert(Math.abs(a.x+11.6)<1e-6);assert.equal(trafficHeight(a),0);
assert.equal(stepTraffic([{...c,z:a.z,x:a.x}],.01,[a]).hits.length,0,'post-hit grace');
const safe=actor(-12,0),olo={...actor(),characterId:6},vr={...actor(),hunterCharacter:1,vrTime:10},captured={...actor(),state:'captured'};
assert.equal(stepTraffic([car()],.8,[safe,olo,vr,captured]).hits.length,0);
const b=actor(5.8,0);stepTraffic([{...car(),x:5.8,z:8,direction:-1}],.8,[b]);stepTrafficFlight(b,1.05);assert(Math.abs(b.x-11.6)<1e-6);
const wrapActor=actor(-5.8,0);stepTraffic([{...car(),z:47}],.1,[wrapActor]);assert.equal(wrapActor.stun,0,'wrapping does not sweep the whole road');
const cat=createCat(0,{x:-10,z:0},()=>.5);stepCats([cat],[],.2,[],[],()=>.5,[{...car(),z:0}]);assert.equal(cat.chaseCar,0);assert(cat.x>-10,'cat follows nearby vehicle');
Object.assign(cat,{x:-5.8,z:0});const flat=stepTraffic([car()],.8,[],[cat]);assert.equal(flat.flattened[0],cat);flattenCats(flat.flattened,[cat],[]);assert.equal(cat.phase,'flattened');stepCats([cat],[],9.9);assert.equal(cat.phase,'flattened');stepCats([cat],[],.11);assert.equal(cat.phase,'roaming');
const orange={...createCat(5,{x:-5.8,z:0}),legendary:true},orangeCar=car();assert.equal(stepTraffic([orangeCar],.8,[],[orange]).flattened.length,0);assert(orangeCar.lift>0);

// Build the real scene, including generator/gate meshes, with the existing Three.js renderer stub.
globalThis.document=context.document;
vm.runInContext("setMap('hefei-road')",context);
const layout=vm.runInContext("({obs:JSON.parse(JSON.stringify(obs)),gens:gens.map(g=>[g.x,g.z]),gates:gates.map(g=>[g.x,g.z]),children:mapRoot.children.length})",context);
assert.equal(layout.gens.length,7);assert.equal(layout.gates.length,2);
for(const [x,z] of [...ROAD_GENERATORS,...ROAD_GATES,...ROAD_CAGES,...ROAD_CHESTS.map(p=>[p.x,p.z])]){
  assert(!blocked(x,z,layout.obs,.6),`fixture inside building at ${x},${z}`);
  assert(findPath({x:0,z:0},{x,z},layout.obs).length,`fixture unreachable at ${x},${z}`);
}
for(let i=0;i<3;i++)vm.runInContext("setMap('manor');setMap('hefei-road')",context);
assert.equal(vm.runInContext('mapRoot.children.length',context),layout.children,'switching maps does not duplicate static objects');
assert.equal(vm.runInContext('scene.children.filter(c=>c.name.startsWith("Map:")).length',context),1);
const report={passed:true,sevenGeneratorsReachable:true,gatesUnderBuildingsReachable:true,chestsAndCagesReachable:true,sweptCarCollision:true,stun3SecondsWithoutDamage:true,roadsideFlight:true,postHitGrace:true,existingImmunityPreserved:true,catFollowsCarAndFlattens10Seconds:true,legendaryCatRepelsCar:true,mapSwitchCleanup:true};
fs.writeFileSync(new URL('../../road-unit-result.json',import.meta.url),JSON.stringify(report,null,2));console.log(report);
