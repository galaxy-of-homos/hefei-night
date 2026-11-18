import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {context} from './test-restored.mjs';
import {CHEST_REFRESH_SECONDS,CHEST_DROP_WEIGHTS,advanceChest,refreshChest,rollChestLoot,rollActorLoot} from '../dist/match-loot.mjs';
const actor=()=>({id:0,characterId:0,x:0,z:0,state:'active',item:null});
const make=()=>({x:0,z:1,opened:false,progress:0,loot:'friedrice',refreshIn:0});
const chest=make(),a=actor();assert.equal(CHEST_REFRESH_SECONDS,90);
assert(!advanceChest(a,chest,9.99,[]));assert(advanceChest(a,chest,.01,[]));assert.equal(a.item,'friedrice');assert.equal(chest.refreshIn,90);
a.item=null;assert(!advanceChest(a,chest,10,[]),'consumed chest cannot grant another item');
assert(!refreshChest(chest,89.99,()=>{throw Error('rerolled before deadline');}));assert(chest.opened);
assert(refreshChest(chest,.01,()=>.99));assert.equal(chest.loot,'mushroom');assert.equal(chest.progress,0);assert.equal(chest.opened,false);
assert(advanceChest(a,chest,10,[]));assert.equal(a.item,'mushroom');assert.equal(chest.refreshIn,90);
const unopened=make();unopened.progress=.5;assert(!refreshChest(unopened,1000,()=>{throw Error('unopened reroll');}));assert.equal(unopened.progress,.5);
const counts={};for(let i=0;i<10000;i++){const item=rollChestLoot(()=>(i+.5)/10000);counts[item]=(counts[item]||0)+1;}
for(const [item,weight] of Object.entries(CHEST_DROP_WEIGHTS))assert.equal(counts[item],weight*100,item);
const olo={...actor(),characterId:6},oloCounts={};for(let i=0;i<10000;i++){let draw=0;const item=rollActorLoot(olo,()=>draw++===0?(i+.5)/10000:((i*37)%10000+.5)/10000);assert(!['egg','hotpot'].includes(item));oloCounts[item]=(oloCounts[item]||0)+1;}
assert.equal(oloCounts.mushroom,800);assert(oloCounts.friedrice<2000,'Olo reroll must also reduce rice weight');
const integrated=vm.runInContext(`(()=>{
 role='survivor';$('survivor-choice').value='0';start(820);clearCats();clearKuchi();testFreezeAI=true;const a=current();Object.assign(a,{x:0,z:14,item:null});const c=chests[0];Object.assign(c,{x:0,z:15,opened:false,progress:0,loot:'friedrice'});openChest(a,c,10);const began=c.refreshIn===90;
 mode='paused';update(200);const paused=c.opened&&c.refreshIn===90;mode='playing';update(89.99);const noEarly=c.opened&&c.refreshIn>0;update(.01);const fresh=!c.opened&&c.progress===0;const visible=c.lid.rotation.x===0&&c.egg.visible;
 a.item=null;openChest(a,c,10);const again=c.opened&&!!a.item;const synced=netSnapshot().chests[0].refreshIn===90;
 a.item='exhaust';useActorItem(a,false);updateExhausts(.1);const exhaustNoCrash=gases.length===1;
 back();start(821);const reset=chests.every(c=>!c.opened&&c.progress===0&&c.refreshIn===0);back();return {began,paused,noEarly,fresh,visible,again,synced,exhaustNoCrash,reset};
})()`,context);for(const [key,value] of Object.entries(integrated))assert(value,key);
const result={passed:true,version:JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url))).version,chestRefreshSeconds:90,openSeconds:10,dropPercent:CHEST_DROP_WEIGHTS,oloFilteredDropCounts:oloCounts,...integrated};
fs.writeFileSync(new URL('../../chest-131-unit.json',import.meta.url),JSON.stringify(result,null,2));console.log(result);
