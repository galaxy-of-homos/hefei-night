'use strict';
const $ = id => document.getElementById(id);
let state;
let catalogData;
const mb = bytes => (bytes / 1024 / 1024).toFixed(1) + ' MB';
function render(next) {
  const previous = state?.phase;
  state = next;
  const busy = ['checking', 'downloading', 'verifying', 'restarting'].includes(state.phase);
  const downloading = state.phase === 'downloading';
  $('current-version').textContent = 'v' + state.currentVersion;
  $('status').textContent = state.message;
  $('source').textContent = state.source ? '下载来源：' + state.source : '优先从 GitHub Release 获取更新';
  $('check').disabled = busy || state.phase === 'ready';
  $('check').textContent = state.phase === 'offline' ? '重新检查' : '检查更新';
  $('update').hidden = !['available', 'ready', 'restarting'].includes(state.phase);
  $('update').disabled = state.phase === 'restarting';
  $('update').textContent = state.phase === 'ready' ? '重启并更新' : state.phase === 'restarting' ? '正在重启…' : '下载 v' + state.availableVersion;
  $('cancel').hidden = !['checking', 'downloading'].includes(state.phase);
  $('play').disabled = ['downloading', 'verifying', 'restarting'].includes(state.phase);
  $('play').textContent = state.phase === 'ready' ? '启动当前版本' : '启动游戏';
  $('progress').hidden = !['checking', 'downloading', 'verifying'].includes(state.phase);
  if (downloading && state.total) $('progress').value = state.received / state.total * 100;
  else $('progress').removeAttribute('value');
  $('transfer').hidden = !downloading;
  $('transfer').textContent = mb(state.received) + ' / ' + mb(state.total);
  if (state.notes) $('notes').textContent = state.notes;
  document.querySelectorAll('[data-version-action],#refresh-versions,#release-select,#select-version').forEach(button => { button.disabled = busy; });
  $('select-version').disabled = busy || !$('release-select').value;
  if (next.phase === 'ready' && previous !== 'ready') void refreshVersions();
}
async function action(fn) { try { await fn(); } catch (error) { $('status').textContent = error.message || '操作未完成，请重试。'; } }
async function refreshVersions() {
  try {
    catalogData = await window.launcher.catalog();
    const {online,releases,installed} = catalogData;
    $('catalog-status').textContent = !online ? '网络暂不可用，已安装版本仍可启动。' : releases.length ? '来自 galaxy-of-homos/hefei-night · 正式 Releases' : '仓库暂未发布正式版本，内置游戏可直接启动。';
    const select = $('release-select'), value = select.value;
    select.replaceChildren();
    if (!releases.length) select.append(new Option('暂无发布版本',''));
    for (const release of releases) {
      const option = new Option('v' + release.version + (release.installable ? '' : ' · 发布文件不完整'),release.version);
      option.disabled = !release.installable;
      select.append(option);
    }
    if (releases.some(r => r.version === value && r.installable)) select.value = value;
    const list = $('installed-list'); list.replaceChildren();
    for (const item of installed) {
      const row = document.createElement('div');row.className='installed-version';
      const name = document.createElement('span');name.textContent='v'+item.version+(item.current?' · 当前使用':' · 已安装');row.append(name);
      if (!item.current) {
        for (const [label,method] of [['切换','use'],['删除','remove']]) {
          const button=document.createElement('button');button.type='button';button.className='text-button';button.textContent=label;button.dataset.versionAction=method;
          button.onclick=()=>action(async()=>{
            if(method==='remove'&&!confirm(`删除已安装的 v${item.version}？以后可以重新下载。`))return;
            await window.launcher[method](item.version);if(method==='remove')await refreshVersions();
          });row.append(button);
        }
      }
      list.append(row);
    }
    if (state) render(state);
  } catch { $('catalog-status').textContent='版本列表暂时不可用，内置游戏仍可启动。'; }
}
$('check').onclick = () => action(() => window.launcher.check());
$('update').onclick = () => action(() => state.phase === 'ready' ? window.launcher.apply() : window.launcher.download());
$('cancel').onclick = () => action(() => window.launcher.cancel());
$('play').onclick = () => action(() => window.launcher.play());
$('help').onclick = () => action(() => window.launcher.help());
window.launcher.onUpdate(render);
window.launcher.state().then(render).catch(() => { $('status').textContent = '登录器初始化失败，请重启。'; });
$('refresh-versions').onclick=()=>action(refreshVersions);
$('release-select').onchange=()=>{ $('select-version').disabled=!$('release-select').value || ['checking','downloading','verifying','restarting'].includes(state?.phase); };
$('select-version').onclick=()=>action(async()=>{
  const version=$('release-select').value;
  if(!version)return;
  const installed=catalogData?.installed.find(item=>item.version===version);
  if(installed?.current){$('status').textContent='已经在使用此版本。';return;}
  if(installed){await window.launcher.use(version);return;}
  await window.launcher.select(version);
});
void refreshVersions();
