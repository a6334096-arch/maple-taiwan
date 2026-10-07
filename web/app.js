'use strict';
// Status values are loaded from Flask. Missing records stay unknown.
let places=[],dataMode='seasonal',loadCounter=0;
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unknownStage={name:'尚無資料',color:'#9ca29d',bg:'#edf0eb'};
const kindLabel=k=>({demo:'模擬資料',prediction:'匯入預測',observation:'觀測紀錄',unknown:'尚無資料','season-reference':'官方季節參考'}[k]||'尚無資料');

const maplePath = 'M0-20 5-10 9-13 8-3 14-7 14-2 20-3 17 4 21 6 6 15 2 14 2 22 -2 22 -2 14 -6 15 -21 6 -17 4 -20-3 -14-2 -14-7 -8-3 -9-13 -5-10Z';
const mapleIcon = `<svg viewBox="-26 -26 52 52" aria-hidden="true" focusable="false"><path d="${maplePath}" fill="currentColor"/><path d="M0-12V17M0 8L-11 1M0 8L11 1" fill="none" stroke="white" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const stages=[{name:'未轉紅',color:'#80a36e',bg:'#edf2e7'},{name:'轉色中',color:'#d39b31',bg:'#faf0d6'},{name:'最佳觀賞',color:'#c75537',bg:'#f8e6db'},{name:'落葉期',color:'#967666',bg:'#eee7df'}];
let saved;try{saved=new Set(JSON.parse(localStorage.getItem('maple-saved')||'[]'));}catch{saved=new Set();}
const dateParts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 document.querySelector('#month').value=dateParts.find(p=>p.type==='year').value+'-'+dateParts.find(p=>p.type==='month').value;
let region='all',county='all';
const normalize=v=>String(v).replace(/台/g,'臺').replace(/\s+/g,'');
let month=document.querySelector('#month').value,filter='all',query='',selected='aowanda',scale=1,panX=0,panY=0;
const $=s=>document.querySelector(s),stage=p=>dataMode==='seasonal'?(p.season_in===true?{name:'一般賞楓月',color:'#d39b31',bg:'#faf0d6'}:p.season_in===false?{name:'非參考月份',color:'#9ca29d',bg:'#edf0eb'}:{name:'月份待確認',color:'#9ca29d',bg:'#edf0eb'}):stages[p.status]||unknownStage,visible=()=>places.filter(p=>normalize(p.name+p.city+p.category).includes(normalize(query))&&(region==='all'||p.region===region)&&(county==='all'||p.city.includes(county))&&(filter==='all'||(filter==='best'&&(dataMode==='seasonal'?p.season_in===true:p.status===2))||(filter==='saved'&&saved.has(p.id))));
function render(){const data=visible();$('#count').textContent=`${data.length} 處`;$('#saved-count').textContent=saved.size;$('#list').innerHTML=data.length?data.map(p=>{const s=stage(p);return `<button class="place ${p.id===selected?'selected':''}" data-id="${escapeHTML(p.id)}" style="--c:${s.color};--bg:${s.bg}"><span class="place-icon">${mapleIcon}</span><span class="place-text"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.city)}</small></span><span class="status">${s.name}</span></button>`;}).join(''):'<p class="empty">沒有符合條件的景點。<br>試試其他關鍵字或切換篩選條件。</p>';renderMarkers();if(!data.some(p=>p.id===selected))selected=null;renderDetail();}
let markerGroups=[];
function renderMarkers(){
 const data=visible();markerGroups=[];
 for(const p of data){let g=markerGroups.find(g=>Math.hypot(g.x-p.x,g.y-p.y)*scale<34);if(g){g.items.push(p);g.x=g.items.reduce((a,p)=>a+p.x,0)/g.items.length;g.y=g.items.reduce((a,p)=>a+p.y,0)/g.items.length;}else markerGroups.push({x:p.x,y:p.y,items:[p]});}
 $('#markers').innerHTML=markerGroups.map((g,i)=>{
  const p=g.items[0],s=stage(p),cluster=g.items.length>1,sel=g.items.some(p=>p.id===selected);
  return `<g class="marker ${sel?'selected':''}" ${cluster?`data-cluster="${i}"`:`data-id="${escapeHTML(p.id)}"`} transform="translate(${g.x},${g.y})" tabindex="0" role="button" aria-label="${cluster?`${g.items.length} 處鄰近景點，點選展開`:escapeHTML(p.name)+'，'+s.name}"><title>${g.items.map(p=>escapeHTML(p.name)).join('、')}</title><g transform="scale(${1/scale})"><circle r="${cluster?22:18}" fill="${cluster?'#fffef8':s.bg}"/><path class="maple-leaf" d="${maplePath}" transform="translate(${cluster?-6:0} 0) scale(.58)" fill="${cluster?'#b54a2d':s.color}"/>${cluster?`<text class="cluster-count" x="7" y="4" text-anchor="middle">${g.items.length}</text>`:''}</g></g>`;
 }).join('');
}
function openCluster(index){
 const g=markerGroups[index];if(!g)return;const items=[...g.items];selected=null;scale=Math.min(10,scale*2);panX=-(g.x-400)*scale;panY=-(g.y-450)*scale;transform();
 $('#detail').hidden=false;$('#detail').innerHTML='<div class="cluster-list"><button class="detail-close" aria-label="關閉鄰近景點">×</button><h2>鄰近景點 '+items.length+' 處</h2>'+items.map(p=>`<button class="cluster-place" data-place="${escapeHTML(p.id)}">${escapeHTML(p.name)}<br><small>${escapeHTML(p.city)}</small></button>`).join('')+'</div>';
 $('.detail-close').onclick=()=>{$('#detail').hidden=true;};
}
function markerAction(e){const el=e.target.closest('[data-cluster],[data-id]');if(!el)return;if(el.hasAttribute('data-cluster'))openCluster(Number(el.dataset.cluster));else choose(el.dataset.id);}
$('#detail').addEventListener('click',e=>{const p=e.target.closest('[data-place]');if(p)choose(p.dataset.place);});
function foliageBlock(p){
 const o=p.foliage;
 if(!o)return `<section class="foliage-panel"><div class="panel-title"><h3>最新楓葉狀況</h3><span class="badge" style="--c:#7d877d;--bg:#edf0eb">尚無資料</span></div><p class="foliage-summary">目前楓況尚無資料</p><p class="foliage-meta">尚未確認有日期與來源的近期紀錄；一般賞楓月份不代表現在已轉紅。</p></section>`;
 const status=stages[o.status]||unknownStage;
 const referenceDate=o.observed_on||o.reported_at;
 const days=Math.floor((Date.now()-Date.parse(referenceDate+'T00:00:00+08:00'))/86400000);
 const stale=days>14;
 const mismatch=referenceDate.slice(0,7)!==month;
 return `<section class="foliage-panel"><div class="panel-title"><h3>最新楓況紀錄</h3><span class="badge" style="--c:${status.color};--bg:${status.bg}">${status.name}</span></div><p class="foliage-summary">${escapeHTML(o.summary)}</p><p class="foliage-meta">範圍：${escapeHTML(o.scope)}<br>公告日期：${escapeHTML(o.reported_at)}${o.observed_on?`<br>觀測日期：${escapeHTML(o.observed_on)}`:''}<br>${escapeHTML(o.source)} · <a href="${escapeHTML(o.source_url)}" target="_blank" rel="noopener noreferrer">查看楓況來源 ↗</a></p>${stale?'<p class="foliage-warning">這筆紀錄已超過 14 天，不能代表今天的楓況。</p>':''}${mismatch?'<p class="foliage-meta">紀錄日期與所選月份不同，不據此推估該月份楓況。</p>':''}</section>`;
}
function renderDetail(){
 let p=places.find(p=>p.id===selected);
 if(!p){$('#detail').innerHTML='';$('#detail').hidden=true;return;}
 $('#detail').hidden=false;const s=stage(p);
 $('#detail').innerHTML=`<div class="detail-head"><button class="detail-close" aria-label="關閉景點資訊">×</button><div class="eyebrow">SEASON & FOLIAGE INFORMATION</div><h2>${escapeHTML(p.name)}</h2><p>${escapeHTML(p.city)}</p></div><div class="detail-body">${foliageBlock(p)}<div class="location-info">${escapeHTML(p.category)} · ${escapeHTML(p.coordinate_scope)}<br><a href="${escapeHTML(p.coordinate_source_url)}" target="_blank" rel="noopener noreferrer">官方景點資訊 ↗</a>${p.intro?`<br>${escapeHTML(p.intro)}`:''}${p.notice_url?`<br><a href="${escapeHTML(p.notice_url)}" target="_blank" rel="noopener noreferrer">查看開放公告 ↗</a>`:''}</div><section class="season-panel"><div class="panel-title"><h3>一般賞楓／秋色季節</h3><span class="badge" style="--c:${s.color};--bg:${s.bg}">${s.name}</span></div><div class="dates-label">所選月份 ${escapeHTML(month)}・季節參考</div><div class="dates">${escapeHTML(p.dates)}</div><details class="season-source"><summary>季節來源與說明</summary><div class="source-line">${p.source?escapeHTML(p.source):'尚無季節來源'}${p.source_url?` · <a href="${escapeHTML(p.source_url)}" target="_blank" rel="noopener noreferrer">來源 ↗</a>`:''}</div><div class="source-line">${escapeHTML(p.note||'')}${p.checked_at?`<br>來源查核：${escapeHTML(p.checked_at.slice(0,10))}（不是觀測日期）`:''}</div></details></section><div class="detail-footer"><span>季節參考與楓況紀錄分別顯示</span><button class="save" aria-pressed="${saved.has(p.id)}">${saved.has(p.id)?'♥ 已收藏':'♡ 收藏景點'}</button></div></div>`;
 $('.detail-close').onclick=()=>{selected=null;render();};
 $('.save').onclick=()=>{if(saved.has(p.id))saved.delete(p.id);else saved.add(p.id);try{localStorage.setItem('maple-saved',JSON.stringify([...saved]));}catch{}render();};
}

function choose(id){selected=id;const p=places.find(p=>p.id===id);if(p){scale=Math.max(scale,4);panX=-(p.x-400)*scale;panY=-(p.y-450)*scale;transform();}$('#sidebar').classList.remove('open');$('#mobile-list').textContent='☰ 景點清單';$('#mobile-list').setAttribute('aria-expanded','false');render();}
$('#list').onclick=e=>{let el=e.target.closest('[data-id]');if(el)choose(el.dataset.id);};$('#markers').onclick=markerAction;$('#markers').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();markerAction(e);}};
$('#region').onchange=e=>{region=e.target.value;county='all';populateCounties();selected=null;render();};$('#county').onchange=e=>{county=e.target.value;selected=null;render();};
$('#search').oninput=e=>{query=e.target.value.trim();render();};$('#month').onchange=e=>{month=e.target.value;loadPlaces();};$('.filters').onclick=e=>{let b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el===b));render();};$('#mobile-list').onclick=()=>{const open=$('#sidebar').classList.toggle('open');$('#mobile-list').textContent=open?'× 關閉清單':'☰ 景點清單';$('#mobile-list').setAttribute('aria-expanded',String(open));};
const world=$('#map-world'),svg=$('#map-svg');function transform(){world.setAttribute('transform',`translate(${panX} ${panY}) translate(400 450) scale(${scale}) translate(-400 -450)`);renderMarkers();}function zoom(f){const before=scale;scale=Math.max(.8,Math.min(10,scale*f));panX*=scale/before;panY*=scale/before;transform();}$('#zoom-in').onclick=()=>zoom(1.2);$('#zoom-out').onclick=()=>zoom(1/1.2);$('#reset').onclick=()=>{scale=1;panX=panY=0;transform();};$('#map').onwheel=e=>{e.preventDefault();zoom(e.deltaY>0?1/1.08:1.08);};
let pointers=new Map(),lastDistance=null,drag=null,moved=false;
function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
$('#map').onpointerdown=e=>{if(e.target.closest('.marker'))return;const p=point(e);pointers.set(e.pointerId,p);e.currentTarget.setPointerCapture(e.pointerId);drag=p;moved=false;};$('#map').onpointermove=e=>{if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance)zoom(d/lastDistance);lastDistance=d;drag=null;}else if(drag){panX=Math.max(-5000,Math.min(5000,panX+p.x-drag.x));panY=Math.max(-5000,Math.min(5000,panY+p.y-drag.y));drag=p;transform();moved=true;}};function end(e){pointers.delete(e.pointerId);lastDistance=null;drag=pointers.size===1?[...pointers.values()][0]:null;}$('#map').onpointerup=end;$('#map').onpointercancel=end;$('#map').onkeydown=e=>{if(e.target!==$('#map'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)){e.preventDefault();if(e.key==='+')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='0')$('#reset').click();else{panX+=e.key==='ArrowLeft'?25:e.key==='ArrowRight'?-25:0;panY+=e.key==='ArrowUp'?25:e.key==='ArrowDown'?-25:0;transform();}}};
$('#about').onclick=()=>$('#about-dialog').showModal();document.querySelectorAll('#about-dialog .dialog-close').forEach(b=>b.onclick=()=>$('#about-dialog').close());document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(innerWidth<=700&&!$('#sidebar').classList.contains('open'))$('#mobile-list').click();$('#search').focus();}});loadPlaces();
async function loadPlaces(){
  const ticket=++loadCounter;
  places=[];render();$('#data-label').textContent='載入中';
  $('#data-note').textContent='正在讀取資料';
  try{
    const responses=await Promise.all([fetch('places.json'),fetch('seasons.json',{cache:'no-store'}),fetch('foliage.json',{cache:'no-store'})]);
    if(responses.some(r=>!r.ok))throw new Error('無法讀取季節資料');
    const [base,references,foliageData]=await Promise.all(responses.map(r=>r.json()));
    const data={mode:'seasonal',places:base.map(p=>{const r=references[p.id];return {...p,foliage:foliageData.foliage?.[p.id]||null,status:null,kind:'season-reference',dates:r?.period||'尚無季節資料',season_in:r?.months? r.months.includes(Number(month.slice(5))):null,source:r?.source,source_url:r?.source_url,note:r?.note,checked_at:r?.checked_at};})};
    if(ticket!==loadCounter)return;
        places=data.places;dataMode=data.mode;populateCounties();
    $('.demo-pill').textContent=dataMode==='seasonal'?'季節參考':dataMode==='demo'?'示範模式':'正式資料模式';
    $('[data-filter=best]').textContent=dataMode==='seasonal'?'賞楓季內':'最佳觀賞';
    updateLegend();
    $('#data-label').textContent=dataMode==='seasonal'?'官方季節資料':dataMode==='demo'?'模擬資料':'匯入紀錄';
    const count=places.filter(p=>p.status!==null).length;
    $('#data-note').textContent=dataMode==='seasonal'?seasonSyncText(references._sync):dataMode==='demo'?'模擬資料・非實際預測':`已載入 ${count} 筆正式紀錄・灰色表示尚無資料`;
    selected=places.find(p=>dataMode==='seasonal'?p.season_in===true:p.status!==null)?.id||places[0]?.id||null;
    render();
  }catch(err){
    if(ticket!==loadCounter)return;
    places=[];selected=null;render();$('.demo-pill').textContent='資料載入失敗';
    $('#data-label').textContent='讀取失敗';$('#data-note').textContent=err.message;
    $('#list').textContent='無法讀取資料，請重新整理網頁，或稍後重試。';
  }
}

function updateLegend(){
 const items=dataMode==='seasonal'?[{name:'一般賞楓月',color:'#d39b31'},{name:'非參考月／月份待確認',color:'#9ca29d'}]:[...stages,unknownStage];
 $('.legend').innerHTML='<span>'+ (dataMode==='seasonal'?'季節圖例':'秋色圖例')+'</span>'+items.map(s=>`<span><svg class="legend-leaf" viewBox="-26 -26 52 52" aria-hidden="true" style="color:${s.color}"><path d="${maplePath}" fill="currentColor"/></svg>${s.name}</span>`).join('');
}

function seasonSyncText(sync){
 if(!sync?.attempted_at)return '一般賞楓月份・尚未執行自動查核';
 const time=new Date(sync.attempted_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 const pending=Math.max(0,places.length-Object.keys(sync.checks||{}).length);
 return `查核 ${time}・${sync.successful_sources} 成功／${sync.failed_sources} 未完成${pending?`・新增 ${pending} 處待自動查核`:''}・非即時楓況`;
}

function populateCounties(){const names=[...new Set(places.filter(p=>region==='all'||p.region===region).flatMap(p=>p.city.match(/[^・／]+?[縣市]/g)||[]))].sort();$('#county').innerHTML='<option value="all">全部縣市</option>'+names.map(n=>`<option ${n===county?'selected':''}>${escapeHTML(n)}</option>`).join('');}
