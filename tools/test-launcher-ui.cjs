'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
exports.run = async (win, output, app, updater) => {
  const errors=[],currentVersion=app.getVersion(),fixtureVersion=currentVersion.replace(/\d+$/,n=>String(Number(n)+1));
  win.webContents.on('console-message', event=>{if(event.level==='error')errors.push(event.message);});
  const js=source=>win.webContents.executeJavaScript(source,true);
  try {
    await fs.mkdir(output,{recursive:true});
    await js('document.fonts.ready');
    await new Promise(resolve=>setTimeout(resolve,500));
    await js(`render({phase:'current',currentVersion:'${currentVersion}',availableVersion:'${currentVersion}',source:'GitHub Release',message:'当前已是最新版本',received:0,total:0,notes:'版本分发从 ${currentVersion} 开始。'})`);
    assert.equal(await js("document.querySelector('#current-version').textContent"),'v'+currentVersion);
    assert(await js("document.querySelector('.character').complete && document.querySelector('.character').naturalWidth > 0"));
    await fs.writeFile(path.join(output,'launcher.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    // Drive the real preload / IPC and on-disk install using a signed, isolated test release.
    const crypto=require('node:crypto'),{canonical}=require('../launcher/manifest.cjs');
    const pair=crypto.generateKeyPairSync('ed25519'),bytes=Buffer.from('MZ launcher test fixture, never executed');
    const payload={schema:1,version:fixtureVersion,platform:'win32',arch:'x64',channel:'stable',protocol:require('../signaling.cjs').GAME_PROTOCOL,publishedAt:'2026-11-15T00:00:00Z',notes:'版本管理验证',artifact:{name:`HefeiNight-${fixtureVersion}-win-x64.exe`,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}};
    const envelope={payload,signature:crypto.sign(null,Buffer.from(canonical(payload)),pair.privateKey).toString('base64')};
    updater.publicKey=pair.publicKey;
    updater.transport=async(url,options={})=>{
      const release={tag_name:'v'+fixtureVersion,assets:[{name:'latest.json'},{name:payload.artifact.name}]};
      if(url.includes('/releases?'))return [release];
      if(url.includes('api.github.com'))return release;
      if(url.endsWith('latest.json'))return envelope;
      if(options.destination){await fs.writeFile(options.destination,bytes,{flag:'wx'});options.onProgress?.(bytes.length);return;}
      throw Error('Unexpected test URL');
    };
    await js('refreshVersions()');
    assert(await js(`document.querySelector('#release-select').value==='${fixtureVersion}' && document.querySelector('#installed-list').textContent.includes('当前使用')`));
    await js(`window.launcher.select('${fixtureVersion}')`);assert.equal(updater.state.phase,'available');
    await js('window.launcher.download()');assert.equal(updater.state.phase,'ready');
    await js('refreshVersions()');
    assert(await js(`document.querySelector('#installed-list').textContent.includes('v${fixtureVersion}') && document.querySelector('[data-version-action=use]') !== null`));
    await fs.writeFile(path.join(output,'version-management.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
    assert(await js("window.launcher.remove('../outside').then(()=>false,()=>true)"));
    assert(await js(`window.launcher.remove('${currentVersion}').then(()=>false,()=>true)`));
    await js(`window.launcher.remove('${fixtureVersion}')`);
    assert.equal((await updater.installed()).length,1);
    await js("render({...state,phase:'downloading',received:50,total:100,message:'正在下载更新…'})");
    assert(await js("document.querySelector('#play').disabled && document.querySelector('#progress').value === 50 && !document.querySelector('#cancel').hidden"));
    await js("render({...state,phase:'offline',message:'暂时无法检查更新，可启动当前版本或稍后重试。'})");
    assert(await js("!document.querySelector('#play').disabled && document.querySelector('#check').textContent === '重新检查'"));
    await js(`render({...state,phase:'ready',availableVersion:'${fixtureVersion}'})`);
    assert(await js("!document.querySelector('#play').disabled && document.querySelector('#update').textContent === '重启并更新'"));
    await js("render({...state,phase:'current',notes:'<img src=x onerror=alert(1)>'})");
    assert(await js("!document.querySelector('#notes img') && document.querySelector('#notes').textContent.includes('<img')"));
    await win.setSize(800,620);
    assert(await js('document.documentElement.scrollWidth <= innerWidth'));
    assert.equal(errors.length,0,errors.join('\n'));
    // Exercise the real isolated preload and the transition into the existing game.
    await js("document.querySelector('#play').click()");
    const until=Date.now()+30000;
    let game;
    while(Date.now()<until){game=require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('hefei://game/'));if(game&&!game.webContents.isLoading())break;await new Promise(resolve=>setTimeout(resolve,100));}
    assert(game,'Launcher must open the game');
    assert.equal(game.webContents.getURL(),'hefei://game/index.html');
    const modelsDeadline=Date.now()+60000;
    let modelsReady=false;
    while(Date.now()<modelsDeadline){
      modelsReady=await game.webContents.executeJavaScript("!!document.querySelector('#start') && !document.querySelector('#start').disabled");
      if(modelsReady)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert(modelsReady,'Game models must load and the start button must become available');
    const result={passed:true,version:app.getVersion(),preloadIsolation:true,offlinePlay:true,progress:true,versionCatalog:true,signedDownloadViaIPC:true,installedVersionControls:true,protectedRemoval:true,releaseNotesEscaped:true,gameLaunch:true,modelsReady:true,errors};
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));
    app.exit(0);
  } catch(error) {await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:false,error:error.stack},null,2));console.error(error);app.exit(1);}
};
