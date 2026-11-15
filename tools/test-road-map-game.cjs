const {app,BrowserWindow,protocol,ipcMain,session}=require('electron'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {createSignalingServer,connectSignaling}=require('../signaling.cjs');const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'../road-map-game'),windows=[],clients=new Map(),tlsDir=path.join(out,'tls');let setupServer;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
protocol.registerSchemesAsPrivileged([{scheme:'hefei',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
ipcMain.handle('signal-connect',async(e,options)=>{try{const c=await connectSignaling({...options,host:'127.0.0.1',port:setupServer.port,ca:await fs.readFile(path.join(tlsDir,'cert.pem'))},m=>{if(!e.sender.isDestroyed())e.sender.send('signal-event',m);});clients.set(e.sender,c);return {ok:true,id:c.id,hostId:c.hostId,code:c.code};}catch(error){return {ok:false,message:error.message};}});ipcMain.on('signal-send',(e,m)=>clients.get(e.sender)?.send(m));ipcMain.handle('signal-close',e=>{clients.get(e.sender)?.close();clients.delete(e.sender);});
app.whenReady().then(async()=>{let result;const errors=[],until=async(fn,label,sec=20)=>{const end=Date.now()+sec*1000;await fs.writeFile(path.join(out,'phase.txt'),label);while(Date.now()<end){if(await fn())return;await sleep(40);}throw Error('Timeout: '+label);};
 try{await fs.mkdir(tlsDir,{recursive:true});const cert=require('node:child_process').spawnSync(process.env.OPENSSL||'openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(tlsDir,'key.pem'),'-out',path.join(tlsDir,'cert.pem'),'-days','2','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{windowsHide:true});if(cert.status!==0)throw Error('Test TLS certificate generation failed: '+cert.error);setupServer=await createSignalingServer({host:'127.0.0.1',port:0,tlsOptions:{key:await fs.readFile(path.join(tlsDir,'key.pem')),cert:await fs.readFile(path.join(tlsDir,'cert.pem'))}});session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:!/^(hefei:|data:|blob:|devtools:)/.test(d.url)}));
 protocol.handle('hefei',async req=>{const file=path.resolve(root,'dist','.'+new URL(req.url).pathname),mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.glb':'model/gltf-binary','.ogg':'audio/ogg','.oga':'audio/ogg'};try{return new Response(await fs.readFile(file),{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}catch{return new Response('',{status:404});}});
 const create=async()=>{const w=new BrowserWindow({width:1280,height:900,show:false,webPreferences:{preload:path.join(root,'preload.cjs'),offscreen:true,backgroundThrottling:false,contextIsolation:true,sandbox:true,nodeIntegration:false}});windows.push(w);w.webContents.on('console-message',(event,...legacy)=>{if(event.level==='error'||legacy[0]===3)errors.push(event.message||legacy[1]);});await w.loadURL('hefei://game/index.html?network-test=1');await until(()=>w.webContents.executeJavaScript("!document.querySelector('#start').disabled"),'models',60);await w.webContents.executeJavaScript(`(()=>{let t=null;Object.defineProperty(document,'pointerLockElement',{get:()=>t,configurable:true});HTMLCanvasElement.prototype.requestPointerLock=function(){t=this;queueMicrotask(()=>document.dispatchEvent(new Event('pointerlockchange')));return Promise.resolve();};document.exitPointerLock=()=>{t=null;queueMicrotask(()=>document.dispatchEvent(new Event('pointerlockchange')));};})()`);return w;};
 const host=await create(),guest=await create(),hj=s=>host.webContents.executeJavaScript(s,true),gj=s=>guest.webContents.executeJavaScript(s,true),inspect="(()=>{const e=document.querySelector('#error');if(e&&!e.classList.contains('hidden'))throw Error(document.querySelector('#error-message').textContent);return import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestState());})()",hs=()=>hj(inspect),gs=()=>gj(inspect),set=o=>hj(`import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestConfigure(${JSON.stringify(o)}))`),tap=(w,k)=>{w.webContents.sendInputEvent({type:'keyDown',keyCode:k});w.webContents.sendInputEvent({type:'keyUp',keyCode:k});},shot=async(w,name,delay=180)=>{await sleep(delay);await fs.writeFile(path.join(out,name+'.png'),(await w.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};



 await set({mapId:'hefei-road'});await shot(host,'lobby',800);
 let layout=await hs();assert.equal(layout.mapInfo.generators.length,7);assert.equal(layout.mapInfo.gates.length,2);
 await gj("document.querySelector('#hunter-role').click()");
 await hj("document.querySelector('#net-open').click();document.querySelector('#net-create').click()");
 await until(()=>hj("/^[0-9]{6}$/.test(document.querySelector('#room-code').textContent)"),'create local room');
 const code=await hj("document.querySelector('#room-code').textContent");
 await gj(`document.querySelector('#net-open').click();document.querySelector('#net-code').value='${code}';document.querySelector('#net-join').click()`);
 await until(()=>gj("!document.querySelector('#net-ready').disabled&&!document.querySelector('#net-room').classList.contains('hidden')"),'join');
 assert(await gj("document.querySelector('#map-choice').disabled"));
 await gj("document.querySelector('#net-ready').click()");await until(()=>hj("!document.querySelector('#net-start').disabled"),'ready');
 await hj("document.querySelector('#net-start').click()");await until(async()=>(await gs()).mode==='playing','playing');
 await until(async()=>(await gs()).mapId==='hefei-road'&&(await gs()).traffic.length===8,'map and traffic replicated');
 assert.equal((await gs()).mapInfo.generators.length,7);assert.equal((await hs()).cats.length,6);
 const initial=(await gs()).traffic[0].z;await sleep(400);assert(Math.abs((await gs()).traffic[0].z-initial)>1,'cars move on guest');await until(async()=>(await gs()).trafficVisuals.some(c=>c.samples>=3),'guest interpolation keeps multiple snapshots');
 const parked=(await hs()).traffic.map(c=>({...c,z:44,speed:0}));
 const freeze={freezeAI:true,clearCats:true,clearRedEyes:true,clearPigs:true,clearMailisu:true,stopCar:true,kuchi:{phase:'stunned',phaseTime:300},survivors:{0:{x:-12,z:24,stun:300},1:{x:18,z:-1,stun:300},2:{x:18,z:2,stun:300},3:{x:18,z:4,stun:300}},hunter:{x:18,z:-5,stun:300,attack:300,cooldown:300},camera:{yaw:0,pitch:.65,distance:12}};
 await set({...freeze,traffic:parked.map((c,i)=>({...c,z:[12,27,-16,5,25,-10,15,-28][i]})),survivors:{...freeze.survivors,0:{x:-11.5,z:30,stun:0}},camera:{yaw:-.6,pitch:.28,distance:12}});await shot(host,'street',800);await set({...freeze,traffic:parked});
 await set({survivors:{0:{x:-5.8,z:0,hp:2,stun:0,trafficImmunity:0}},hunter:{x:5.8,z:0,stun:0,trafficImmunity:0},traffic:[{id:0,x:-5.8,z:-6,speed:10,direction:1},{id:6,x:5.8,z:6,speed:10,direction:-1}]});
 await until(async()=>(await hs()).survivors[0].trafficFlight>.5,'survivor collision');
 await shot(host,'traffic-hit',200);
 await until(async()=>(await gs()).hunter.trafficFlight>0,'guest hunter receives hit');
 await until(async()=>(await hs()).survivors[0].trafficFlight===0,'land on sidewalk',4);
 await until(async()=>(await gs()).survivors[0].trafficFlight===0&&(await gs()).hunter.trafficFlight===0,'guest lands on sidewalk',4);
 for(const state of [await hs(),await gs()]){assert(state.survivors[0].x< -11.4);assert(state.hunter.x>11.4);assert.equal(state.survivors[0].hp,2);assert(state.hunter.stun>0);}
 assert((await gs()).renderActors[4].x>11.2,'guest predicted hunter reaches sidewalk');
 await set({survivors:{0:{x:-12,z:4,stun:300}},hunter:{x:18,z:-5,stun:300},cats:[{id:0,x:-10,z:0,cooldown:300}],traffic:[...parked.filter(c=>c.id!==0),{id:0,x:-5.8,z:-6,speed:2,direction:1}]});
 const catX=(await hs()).cats[0].x;await until(async()=>(await hs()).cats[0].x>catX+.5,'cat follows car');
 await until(async()=>(await gs()).cats[0]?.phase==='flattened','cat flattened on guest',10);
 await until(async()=>(await gs()).catVisuals[0].scaleY<.2,'flat mesh');
 await shot(host,'flat-cat');await set({trafficEnabled:false});
 await until(async()=>(await gs()).cats[0]?.phase==='roaming','cat recovers in ten seconds',12);
 await set({clearCats:true,gens:[1,1,1,1,1,0,0],survivors:{0:{x:-35,z:0,stun:0,trafficFlight:0}},camera:{yaw:Math.PI/2,pitch:.35,distance:10}});
 host.webContents.sendInputEvent({type:'keyDown',keyCode:'F'});
 await until(async()=>(await hs()).gates[0]===1,'gate opens under tower',9);
 host.webContents.sendInputEvent({type:'keyUp',keyCode:'F'});
 await shot(host,'building-gate');
 assert.equal((await hs()).survivors[0].state,'escaped');
 assert(!errors.length,errors.join('\n'));
 result={passed:true,version:require('../package.json').version,protocol:require('../signaling.cjs').GAME_PROTOCOL,actualThreeJSAndTwoPeerWebRTC:true,hostSelectsMap:true,sevenGeneratorsOnBothPeers:true,eightCarsMoveOnGuest:true,guestTrafficInterpolationKeepsHistory:true,bothFactionsKnockedToRoadside:true,guestHunterCollisionSync:true,noTrafficDamage:true,catChasesAndFlattensThenRecovers:true,gateUnderTowerOpensAndEscapes:true,errors};
 }catch(e){result={passed:false,error:e.stack,errors};for(let i=0;i<windows.length;i++)try{await fs.writeFile(path.join(out,'failure-'+i+'.json'),JSON.stringify(await windows[i].webContents.executeJavaScript("import(document.querySelector('script[type=module][src]').src).then(m=>m.networkTestState())"),null,2));await fs.writeFile(path.join(out,'failure-'+i+'.png'),(await windows[i].webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}catch{}}
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));for(const c of clients.values())c.close();windows.forEach(w=>w.destroy());if(setupServer)await setupServer.close();app.exit(result.passed?0:1);
});
