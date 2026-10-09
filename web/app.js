'use strict';
// Map colors use dated foliage reports; seasonal references remain separate.
let places=[],dataMode='seasonal',loadCounter=0;
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const unknownStage={name:'尚無資料',color:'#9ca29d',bg:'#edf0eb'};
const kindLabel=k=>({demo:'模擬資料',prediction:'匯入預測',observation:'觀測紀錄',unknown:'尚無資料','season-reference':'官方季節參考'}[k]||'尚無資料');

const maplePath = 'M0-20 5-10 9-13 8-3 14-7 14-2 20-3 17 4 21 6 6 15 2 14 2 22 -2 22 -2 14 -6 15 -21 6 -17 4 -20-3 -14-2 -14-7 -8-3 -9-13 -5-10Z';
const beechPath = 'M0-21C-15-15-19-3-14 8L-10 10L-8 14L-3 16L0 19L3 16L8 14L10 10L14 8C19-3 15-15 0-21ZM-1 17V23H1V17Z';
const isBeech=p=>(p.species||[]).some(n=>n.includes('山毛櫸'));
const reportStage=(p,status)=>isBeech(p)?{...stages[status],...(status===0?{name:'未轉色'}:[1,2].includes(status)?{color:'#d6aa32',bg:'#faf0d3'}:{})}:stages[status];
const mapleIcon = `<svg viewBox="-26 -26 52 52" aria-hidden="true" focusable="false"><path d="${maplePath}" fill="currentColor"/><path d="M0-12V17M0 8L-11 1M0 8L11 1" fill="none" stroke="white" stroke-opacity=".35" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const stages=[{name:'未轉紅',color:'#80a36e',bg:'#edf2e7'},{name:'初期變色',color:'#679641',bg:'#edf3e5'},{name:'最佳觀賞',color:'#dc6030',bg:'#fbe8dc'},{name:'觀賞尾聲',color:'#854a7c',bg:'#f1e5ef'}];
function foliageStage(p){
 const state=leafStage(p);
 return state.stale?{...unknownStage,name:'紀錄過期／待更新'}:state;
}
// Leaf color preserves the last verified observation; age stays visible separately.
function leafStage(p){
 const o=p.foliage;
 if(!o||!Number.isInteger(o.status)||!stages[o.status])return unknownStage;
 const date=o.observed_on||o.reported_at;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return unknownStage;
 const timestamp=Date.parse(date+'T00:00:00+08:00');
 const days=Math.floor((Date.now()-timestamp)/86400000);
 if(!Number.isFinite(days)||days<0)return unknownStage;
 const state=reportStage(p,o.status);
 return {...state,stale:days>14,name:state.name+(days>14?'（舊紀錄）':'')};
}
function clusterStage(items){
 const states=items.map(leafStage);
 const stale=states.some(s=>s.stale);
 if(states.every(s=>s.color===states[0].color))return {...states[0],stale};
 return {...unknownStage,stale,name:'楓況不同／含待確認景點'};
}
let saved;try{saved=new Set(JSON.parse(localStorage.getItem('maple-saved')||'[]'));}catch{saved=new Set();}
for(const [old,parent] of Object.entries({'wuling-forest':'wuling','taoshan':'wuling','daxue-trails':'daxueshan'}))if(saved.delete(old))saved.add(parent);
for(const id of ['jingtong-maple','xindian-maple','puan-maple','wenshan-farm','wulai-autumn','xiaojinping','puli-maple','fengli-trail','hongye-village','fenglin'])saved.delete(id);
const dateParts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 document.querySelector('#month').value=dateParts.find(p=>p.type==='year').value+'-'+dateParts.find(p=>p.type==='month').value;
let region='all',county='all',listMode='seasonal',leafType='all',sortOrder='season';
const todayTaipei=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
document.querySelector('#travel-date').value=todayTaipei.slice(0,7);
const normalize=v=>String(v).replace(/台/g,'臺').replace(/\s+/g,'');
let month=document.querySelector('#month').value,filter='all',query='',selected=null,scale=1.1,panX=20,panY=-24;
const $=s=>document.querySelector(s),stage=p=>dataMode==='seasonal'?(p.season_in===true?{name:'參考季節內',color:'#d39b31',bg:'#faf0d6'}:p.season_in===false?{name:'非參考月份',color:'#9ca29d',bg:'#edf0eb'}:{name:'月份待確認',color:'#9ca29d',bg:'#edf0eb'}):stages[p.status]||unknownStage;
function matchesLeaf(p){
 const names=p.species||[];
 return leafType==='all'||(leafType==='beech'&&isBeech(p))||(leafType==='maple'&&names.some(n=>/楓|槭/.test(n)))||(leafType==='conifer'&&names.some(n=>/落羽松|水杉/.test(n)));
}
function matchesFilters(p){
 const text=p.name+p.city+p.category+(p.species||[]).join(' ')+(p.aliases||[]).join(' ');
 const peak=listMode==='seasonal'?p.season_in===true:foliageStage(p).name==='最佳觀賞';
 return normalize(text).includes(normalize(query))&&(region==='all'||p.region===region)&&(county==='all'||p.city.includes(county))&&matchesLeaf(p)&&(filter==='all'||filter==='best'&&peak||filter==='saved'&&saved.has(p.id));
}
function reportDate(p){return p.foliage?.observed_on||p.foliage?.reported_at||'';}
function orderPlaces(data){
 return data.map((p,index)=>({p,index})).sort((a,b)=>sortOrder==='season'?(Number(b.p.season_in===true)-Number(a.p.season_in===true)||a.index-b.index):sortOrder==='recent'?(reportDate(b.p).localeCompare(reportDate(a.p))||a.index-b.index):a.index-b.index).map(o=>o.p);
}
const visible=()=>orderPlaces(places.filter(matchesFilters));
function syncFilterUI(){
 $('[data-filter=best]').textContent=listMode==='seasonal'?'季節內':'近期盛期';
 $('#mode-note').textContent=listMode==='seasonal'?'依歷年月份找景點；葉色依官方紀錄，虛線表示舊紀錄。':'葉色依最後官方紀錄；超過 14 天標示舊紀錄，不列入近期盛期。';
 $('#clear-filters').hidden=!(query||region!=='all'||county!=='all'||leafType!=='all'||filter!=='all');
 $('#data-label').textContent=listMode==='seasonal'?'歷年月份':'近期紀錄';
 $('#sort-order').value=sortOrder;
 if(!$('#sidebar').classList.contains('open'))$('#mobile-list').textContent='☰ 景點 '+visible().length;
}
function clearFilters(){
 query='';region='all';county='all';leafType='all';filter='all';selected=null;
 $('#search').value='';$('#region').value='all';populateCounties();
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));
 document.querySelectorAll('[data-leaf-type]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.leafType==='all')));
 render();
}
$('#clear-filters').onclick=clearFilters;
$('.leaf-filters').onclick=e=>{const b=e.target.closest('[data-leaf-type]');if(!b)return;leafType=b.dataset.leafType;document.querySelectorAll('[data-leaf-type]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));render();};
$('#sort-order').onchange=e=>{sortOrder=e.target.value;render();};

function render(){syncFilterUI();const data=visible();$('#count').textContent=`${data.length} 處`;$('#saved-count').textContent=places.filter(p=>saved.has(p.id)).length;renderForecastList(data);renderMarkers();if(!data.some(p=>p.id===selected))selected=null;renderDetail();}
function renderForecastList(data){
 const groups=['北部','中部','南部','東部'];
 const eligible=data.filter(p=>p.season_in===true).length;
 const best=data.filter(p=>foliageStage(p).name==='最佳觀賞').length;
 const partial=data.filter(p=>foliageStage(p).name==='初期變色').length;
 $('#forecast-summary').innerHTML=listMode==='seasonal'?`參考季節內 <b>${eligible}</b> 處 · 共 <b>${data.length}</b> 處`:`盛期 <b>${best}</b> 處 · 轉色中 <b>${partial}</b> 處`;
 $('.forecast-heading h2').textContent=listMode==='seasonal'?'賞楓季節清單':'近期楓況清單';
 $('#list').innerHTML=data.length?groups.map(r=>{const items=data.filter(p=>p.region===r);return items.length?`<section class="forecast-region"><h3>${r}景點</h3>`+items.map(p=>{
  const state=listMode==='seasonal'?stage(p):leafStage(p),leaf=leafStage(p);
  const meta=listMode==='recent'?reportDate(p):'';
  const caption=meta?'紀錄 '+meta:'尚無近期紀錄';
  const quiet=listMode==='seasonal'?p.season_in!==true:state.color===unknownStage.color;
  return `<button class="forecast-row ${quiet?'quiet':''} ${selected===p.id?'selected':''}" data-id="${escapeHTML(p.id)}" aria-label="${escapeHTML(p.name+'，'+p.city+'，'+leaf.name+'，'+p.dates)}"><span class="forecast-swatch ${leaf.stale?'stale-leaf':''}" style="color:${leaf.color};background:${leaf.bg}" title="${escapeHTML(leaf.name)}" aria-hidden="true"><svg viewBox="-26 -26 52 52">${markerLeaf(p,leaf.color)}</svg></span><span class="forecast-place"><strong>${escapeHTML(p.name)}</strong><small>${escapeHTML(p.city)}${listMode==='recent'?`<span class="row-report-date">${escapeHTML(caption)}</span>`:leaf.stale?'<span class="row-report-date">葉色：舊紀錄待更新</span>':''}</small></span><span class="forecast-period">${escapeHTML(listMode==='seasonal'?p.dates:state.name)}</span></button>`;
 }).join('')+'</section>':'';}).join(''):'<div class="empty"><strong>目前沒有符合條件的景點</strong><p>可清除篩選，或切換歷年季節查看其他月份。</p><button id="empty-reset">清除篩選</button></div>';
}
$('#list').addEventListener('click',e=>{if(e.target.closest('#empty-reset'))clearFilters();});
$('#travel-date').onchange=e=>{if(!e.target.value)return;month=e.target.value.slice(0,7);$('#month').value=month;loadPlaces();};
$('.forecast-tabs').onclick=e=>{const b=e.target.closest('[data-list-mode]');if(!b)return;listMode=b.dataset.listMode;sortOrder=listMode==='recent'?'recent':'season';document.querySelectorAll('[data-list-mode]').forEach(el=>el.setAttribute('aria-pressed',String(el===b)));render();};
$('#close-list').onclick=()=>{if($('#sidebar').classList.contains('open'))$('#mobile-list').click();};
let markerGroups=[];
function groupNearbyPlaces(data,pixelsPerUnit){
 const groups=[];const remaining=new Set(data);
 for(const seed of data){
  if(!remaining.delete(seed))continue;
  const items=[seed];
  // Bound the whole group, rather than chaining neighbours across Taiwan.
  // Every pair must be close, and broad regions remain separately selectable.
  for(const p of remaining){
   if(p.region===seed.region&&items.every(item=>Math.hypot(item.x-p.x,item.y-p.y)*pixelsPerUnit<56)){remaining.delete(p);items.push(p);}
  }
  groups.push({items,x:items.reduce((sum,p)=>sum+p.x,0)/items.length,y:items.reduce((sum,p)=>sum+p.y,0)/items.length});
 }
 return groups;
}
function clusterLeaves(items){
 const colors=[...new Set(items.map(p=>leafStage(p).color))];
 return colors.map((color,index)=>`<g transform="translate(${colors.length===1?-6:-10+index*5} 0) scale(${colors.length===1?1:.72})">${markerLeaf(items.find(p=>leafStage(p).color===color),color)}</g>`).join('');
}
function renderMarkers(){
 const data=visible();
 // Convert SVG viewBox units to CSS pixels so touch targets stay usable on phones.
 const matrix=$('#map-svg').getScreenCTM();
 const unit=matrix?Math.hypot(matrix.a,matrix.b):1;
 const markerScale=1/(scale*unit);
 const phone=window.matchMedia('(max-width:700px)').matches;
 markerGroups=groupNearbyPlaces(data,scale*unit);
 $('#markers').innerHTML=markerGroups.map((g,i)=>{
  const p=g.items[0],cluster=g.items.length>1,s=cluster?clusterStage(g.items):leafStage(p),sel=g.items.some(p=>p.id===selected);
  return `<g class="marker ${sel?'selected':''}" ${cluster?`data-cluster="${i}"`:`data-id="${escapeHTML(p.id)}"`} transform="translate(${g.x},${g.y})" tabindex="0" role="button" aria-label="${cluster?`${g.items.length} 處鄰近景點，${s.name}，點選展開`:escapeHTML(p.name)+'，地圖代表：'+escapeHTML(representativeSpecies(p)||'品種待確認')+'，'+s.name}"><title>${g.items.map(p=>escapeHTML(p.name)+'（'+escapeHTML(p.city)+'）｜代表：'+escapeHTML(representativeSpecies(p)||'品種待確認')+'｜'+leafStage(p).name).join('、')}</title><g transform="scale(${markerScale})"><circle class="marker-hit" r="22" fill="transparent" stroke="none"/><circle class="marker-disc" r="${phone?(cluster?16:14):(cluster?24:22)}" fill="${cluster?'#fffef8':s.bg}" ${s.stale?'stroke="#7b8175" stroke-width="1.5" stroke-dasharray="3 2"':''}/>${cluster?clusterLeaves(g.items):markerLeaf(p,s.color)}${cluster?`<text class="cluster-count" x="7" y="4" text-anchor="middle">${g.items.length}</text>`:''}</g></g>`;
 }).join('');
 renderPlaceLabels(data);
 const chosen=data.find(p=>p.id===selected);
 if(chosen){
  const width=Math.max(140,chosen.name.length*12+24,chosen.city.length*10+24);
  $('#markers').insertAdjacentHTML('beforeend',`<g class="selected-location" transform="translate(${chosen.x} ${chosen.y})" aria-hidden="true"><g transform="scale(${1/scale})"><path d="M0 -22V-34"/><rect x="${-width/2}" y="-88" width="${width}" height="54" rx="10"/><text class="location-name" y="-65" text-anchor="middle">${escapeHTML(chosen.name)}</text><text class="location-city" y="-47" text-anchor="middle">${escapeHTML(chosen.city)}</text></g></g>`);
 }
 $('#map-location').textContent=chosen?chosen.city:(county!=='all'?county:region!=='all'?region+'景點':'台灣賞楓地圖');
}
function renderPlaceLabels(data){
 const counties=new Map();
 for(const p of data)for(const name of p.city.match(/[^・／]+?[縣市]/g)||[]){const group=counties.get(name)||[];group.push(p);counties.set(name,group);}
 $('#county-labels').innerHTML=[...counties].map(([name,items])=>{const x=items.reduce((a,p)=>a+p.x,0)/items.length,y=items.reduce((a,p)=>a+p.y,0)/items.length;return `<g class="county-label" transform="translate(${x} ${y})"><text transform="scale(${1/scale})" y="${scale>=3?-50:27}" text-anchor="middle">${escapeHTML(name)}</text></g>`;}).join('');
 $('#town-labels').replaceChildren();
 if(scale<3)return;
 const towns=new Map();
 for(const p of data){const names=p.city.split(/[・／]/).map(n=>n.trim()).filter(n=>/[鄉鎮區]$/.test(n));for(const name of names){const key=(p.city.match(/[^・／]+?[縣市]/)||[p.region])[0]+'／'+name,group=towns.get(key)||[];group.push(p);towns.set(key,group);}}
 const townOccupied=[];
 $('#town-labels').innerHTML=[...towns].map(([key,items])=>{const name=key.split('／')[1],x=items.reduce((a,p)=>a+p.x,0)/items.length,y=items.reduce((a,p)=>a+p.y,0)/items.length,width=name.length*12;
  const screenX=(x-400)*scale+panX,screenY=(y-450)*scale+panY;
  if(townOccupied.some(b=>Math.abs(b.x-screenX)<(b.width+width)/2+10&&Math.abs(b.y-screenY)<22))return '';
  townOccupied.push({x:screenX,y:screenY,width});
  return `<g class="town-label" transform="translate(${x} ${y})"><text transform="scale(${1/scale})" y="-27" text-anchor="middle">${escapeHTML(name)}</text></g>`;}).join('');
 const occupied=[];
 for(const g of markerGroups){
  if(g.items.length!==1||g.items[0].id===selected)continue;
  const p=g.items[0],width=Math.min(200,p.name.length*11),x=(p.x-400)*scale+panX,y=(p.y-450)*scale+panY+34;
  if(occupied.some(b=>Math.abs(b.x-x)<(b.width+width)/2+8&&Math.abs(b.y-y)<24))continue;
  occupied.push({x,y,width});
  $('#markers').insertAdjacentHTML('beforeend',`<g class="place-map-label" transform="translate(${p.x} ${p.y})" aria-hidden="true"><text transform="scale(${1/scale})" y="34" text-anchor="middle">${escapeHTML(p.name.length>18?p.name.slice(0,17)+'…':p.name)}</text></g>`);
 }
}
function openCluster(index){
 const g=markerGroups[index];if(!g)return;const items=[...g.items];selected=null;scale=Math.min(10,scale*2);panX=-(g.x-400)*scale;panY=-(g.y-450)*scale;transform();
 $('#detail').hidden=false;$('#detail').innerHTML='<div class="cluster-list"><button class="detail-close" aria-label="關閉鄰近景點">×</button><h2>鄰近景點 '+items.length+' 處</h2><p class="cluster-hint">點選下方景點查看楓況</p>'+items.map(p=>`<button class="cluster-place" data-place="${escapeHTML(p.id)}">${escapeHTML(p.name)}<br><small>${escapeHTML(p.city)}</small></button>`).join('')+'</div>';
 $('.detail-close').onclick=()=>{$('#detail').hidden=true;};
}
function markerAction(e){const el=e.target.closest('[data-cluster],[data-id]');if(!el)return;if(el.hasAttribute('data-cluster'))openCluster(Number(el.dataset.cluster));else choose(el.dataset.id);}
$('#detail').addEventListener('click',e=>{const p=e.target.closest('[data-place]');if(p)choose(p.dataset.place);});
function foliageBlock(p){
 const o=p.foliage;
 if(!o)return `<section class="foliage-panel"><div class="panel-title"><h3>最新楓葉狀況</h3><span class="badge" style="--c:#7d877d;--bg:#edf0eb">尚無資料</span></div><p class="foliage-summary">目前楓況尚無資料</p><p class="foliage-meta">尚未確認有日期與來源的近期紀錄；一般賞楓月份不代表現在已轉紅。</p></section>`;
 const status=reportStage(p,o.status)||unknownStage;
 const referenceDate=o.observed_on||o.reported_at;
 const days=Math.floor((Date.now()-Date.parse(referenceDate+'T00:00:00+08:00'))/86400000);
 const stale=days>14;
 const mismatch=referenceDate.slice(0,7)!==month;
 return `<section class="foliage-panel"><div class="panel-title"><h3>最新楓況紀錄</h3><span class="badge" style="--c:${status.color};--bg:${status.bg}">${status.name}</span></div><p class="foliage-summary">${escapeHTML(o.summary)}</p><p class="foliage-meta">範圍：${escapeHTML(o.scope)}<br>公告日期：${escapeHTML(o.reported_at)}${o.observed_on?`<br>觀測日期：${escapeHTML(o.observed_on)}`:''}<br>${escapeHTML(o.source)} · <a href="${escapeHTML(o.source_url)}" target="_blank" rel="noopener noreferrer">查看楓況來源 ↗</a></p>${stale?'<p class="foliage-warning">這筆紀錄已超過 14 天，不能代表今天的楓況。</p>':''}${mismatch?'<p class="foliage-meta">紀錄日期與所選月份不同，不據此推估該月份楓況。</p>':''}</section>`;
}
function blogPhotosBlock(p){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const cutoff=String(Number(today.slice(0,4))-10)+today.slice(4);
 const newsHost=/(^|\.)(cna.com.tw|ltn.com.tw|life.tw|tvbs.com.tw|ettoday.net|chinatimes.com|yahoo.com)$/;
 const links=(p.blog_photo_links||[]).filter(o=>{try{const u=new URL(o.url);const date=o.published_on||'';const full=/^\d{4}-\d{2}-\d{2}$/.test(date);const month=/^\d{4}-\d{2}$/.test(date);const compare=month?date+'-01':date;return u.protocol==='https:'&&!newsHost.test(u.hostname)&&o.source&&o.title&&o.route&&o.summary&&((o.date_kind==='undated'&&o.official_guide===true&&/^(recreation.forest.gov.tw|www.tsfa.com.tw|www.ali-nsa.net|www.erv-nsa.gov.tw)$/.test(u.hostname))||((full||month)&&Number.isFinite(Date.parse(compare))&&compare>=cutoff&&compare<=today));}catch{return false;}}).sort((a,b)=>(b.updated_on||b.published_on||'').localeCompare(a.updated_on||a.published_on||''));
 if(!links.length)return `<details class="blog-photos"><summary>旅遊文章</summary><p class="share-note">尚未找到符合條件的賞楓／賞葉行程文章，待補。</p></details>`;
 return `<details class="blog-photos"><summary>旅遊文章（${links.length}）</summary><p class="share-note">優先收錄較新的賞楓／賞葉行程與路線攻略。文章日期不等於照片年份，歷年照片不代表目前楓況。</p>${links.map(o=>`<article class="blog-photo-link"><a class="share-button" href="${escapeHTML(o.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(o.title)} ↗</a><p class="share-source">來源：${escapeHTML(o.source)}<br>日期：${o.date_kind==='undated'?'原站未標日期（官方路線指南）':(o.date_kind==='updated'?'更新':'發表')+' '+escapeHTML(o.published_on)}${o.updated_on?` · 更新 ${escapeHTML(o.updated_on)}`:''}${o.reference_period?`<br>造訪時期：${escapeHTML(o.reference_period)}`:''}</p><p class="share-note"><strong>賞葉路線：</strong>${escapeHTML(o.route)}<br><strong>內容重點：</strong>${escapeHTML(o.summary)}</p>${o.viewing_area_group?viewingAreasBlock(p,o.viewing_area_group):''}</article>`).join('')}</details>`;
}
function latestBlock(p){
 const observation=p.foliage?foliageBlock(p).replace(/<h3>.*?<\/h3>/,''):'';
 const shares=photosBlock(p).replace(/<div class="panel-title">.*?<\/div>/,'');
 return `<section class="latest-panel"><h3>最新楓況與現場分享</h3>${observation}${shares}${blogPhotosBlock(p)}</section>`;
}
function viewingAreasBlock(p,group){
 const areas=(p.viewing_areas||[]).filter(a=>a.group===group);
 if(!areas.length)return '';
 return `<div class="viewing-areas"><h4>${group==='park'?'園區內賞楓地點':'阿里山公路賞楓地點'}</h4>${areas.map(a=>`<p class="reference-note"><strong>${escapeHTML(a.name)}</strong><br>${escapeHTML(a.description)}</p>`).join('')}${group==='road'&&p.viewing_areas_note?`<p class="share-note">${escapeHTML(p.viewing_areas_note)}</p>`:''}</div>`;
}
function relatedRoutesBlock(p){
 if(!p.related_routes?.length)return '';
 return `<section class="season-panel"><h3>園區內賞楓路線</h3>${p.related_routes.map(r=>`<p class="reference-note"><strong>${escapeHTML(r.name)}</strong><br>${escapeHTML(r.period)}<br><a href="${escapeHTML(r.source_url)}" target="_blank" rel="noopener noreferrer">路線來源 ↗</a></p>`).join('')}</section>`;
}
function officialInfoLink(p){
 const candidates=[
  {url:p.official_info_url,label:p.official_info_label||'官方景點資訊'},
  {url:p.official_website_url,label:p.official_link_label||'景點官方網站'},
  ...(p.official_alternate_links||[]),
  ...(!p.official_info_url&&!p.official_website_url?[{url:p.coordinate_source_url,label:'官方景點介紹'}]:[])
 ];
 const fb=publicShareUrl(p.official_facebook_url);
 if(fb)candidates.push({url:fb,label:p.official_facebook_kind==='recommended'?'官方推薦的在地 Facebook':'官方 Facebook・'+(p.official_facebook_name||p.name)});
 const seen=new Set();const links=candidates.filter(o=>{
  try{const u=new URL(o.url);if(u.protocol!=='https:')return false;const key=linkDestination(u.href);if(seen.has(key))return false;seen.add(key);return true;}catch{return false;}
 });
 return `<div class="official-links"><div class="location-heading">官方資訊</div>${links.length?links.map(o=>`<a href="${escapeHTML(o.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(o.label)} ↗</a>`).join(''):'<span>官方資訊待查核</span>'}</div>`;
}
function navigationLink(p){
 return `<a class="location-navigation" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(p.lat+','+p.lon)}" target="_blank" rel="noopener noreferrer">地圖導航 ↗</a>`;
}
function liveCamerasBlock(p){
 const cameras=p.live_cameras||[];
 return `<div class="live-cameras"><div class="location-heading">即時影像</div>${cameras.length?cameras.map(c=>`<div class="live-camera"><a href="${escapeHTML(c.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(c.label)} ↗</a><small>${escapeHTML(c.scope)}</small></div>`).join('')+'<p class="camera-note">開啟官方影像頁面；景觀鏡頭不代表賞楓區的葉色。</p>':'<p class="camera-note">尚未確認此景點的官方即時影像。</p>'}</div>`;
}
function representativeSpecies(p){
 const names=p.species||[];
 return names.includes(p.representative_species)?p.representative_species:(names[0]||null);
}
// Simplified leaf silhouettes, shared by map markers and species cards.
function leafGeometry(name=''){
 const maple='M50 8L57 31L66 21L64 42L86 27L78 49L94 48L72 64L78 71L54 77L50 73L46 77L22 71L28 64L6 48L22 49L14 27L36 42L34 21L43 31Z';
 const sweetgum='M50 7L59 37L66 33L65 44L91 35L79 57L84 62L58 75L50 71L42 75L16 62L21 57L9 35L35 44L34 33L41 37Z';
 const oval='M50 10L58 17L61 15L65 25L69 23L72 34L76 33L77 43L81 45L78 55L79 59L71 67L71 72L61 77L50 83L40 77L29 72L30 67L22 59L23 55L19 45L24 43L24 33L29 34L31 23L36 25L39 15L43 17Z';
 const fan='M50 76C46 64 36 59 23 57L10 50L7 39L13 25L26 14L42 10L50 25L58 10L74 14L87 25L93 39L90 50L77 57C64 59 54 64 50 76Z';
 if(/落羽松|水杉/.test(name))return {kind:'feather',shape:Array.from({length:10},(_,i)=>{const y=18+i*6,w=7+i*1.7;return `M50 ${y+6}Q${50-w-5} ${y+1} ${50-w} ${y-3}Q${49-w/2} ${y-2} 50 ${y+3}M50 ${y+6}Q${50+w+5} ${y+1} ${50+w} ${y-3}Q${51+w/2} ${y-2} 50 ${y+3}`;}).join(' ')};
 if(name.includes('銀杏'))return {kind:'fan',shape:fan};
 if(name==='楓香')return {kind:'lobed',shape:sweetgum};
 if(name==='三角楓')return {kind:'lobed',shape:'M50 12L65 45L88 37L77 62L63 73L50 78L37 73L23 62L12 37L35 45Z'};
 if(/紅榨槭/.test(name))return {kind:'lobed',shape:'M50 9L61 33L75 27L76 43L94 47L84 65L64 78L50 83L36 78L16 65L6 47L24 43L25 27L39 33Z'};
 if(name==='青楓')return {kind:'lobed',shape:'M50 7L58 37L85 20L71 49L96 48L77 69L58 80L50 75L42 80L23 69L4 48L29 49L15 20L42 37Z'};
 if(/楓|槭/.test(name))return {kind:'lobed',shape:maple};
 return {kind:'oval',shape:oval};
}
function markerLeaf(p,color){
 const name=representativeSpecies(p);
 if(!name)return `<path class="maple-leaf" d="${maplePath}" transform="scale(.58)" fill="${color}"/>`;
 const {shape,kind}=leafGeometry(name);
 return `<g class="maple-leaf" data-representative-species="${escapeHTML(name)}" transform="scale(.32) translate(-50 -50)"><path d="${shape}" fill="${color}"/><path d="M50 ${kind==='feather'?14:72}V93" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></g>`;
}
function speciesIllustration(name){
 const {shape,kind}=leafGeometry(name);
 const color=kind==='feather'?'#c88234':kind==='fan'?'#d6af38':name.includes('櫸')?'#d68e34':/紫/.test(name)?'#99515b':name==='青楓'?'#8b9e43':'#ce693e';
 let art=kind==='feather'?Array.from({length:10},(_,i)=>{const y=18+i*6,w=7+i*1.7;return `<path d="M50 ${y+6}Q${50-w-5} ${y+1} ${50-w} ${y-3}Q${49-w/2} ${y-2} 50 ${y+3}M50 ${y+6}Q${50+w+5} ${y+1} ${50+w} ${y-3}Q${51+w/2} ${y-2} 50 ${y+3}" fill="${color}"/>`;}).join(''):`<path d="${shape}" fill="${color}" stroke="${color}" stroke-linejoin="round"/><path d="M50 17V78" stroke="#fff3d1" stroke-opacity=".5" stroke-width="1.5"/>`;
 if(kind==='lobed')art+='<path d="M50 71L25 47M50 71L75 47M50 66L39 34M50 66L61 34" fill="none" stroke="#ffecc3" stroke-opacity=".55" stroke-width="1.3"/>';
 if(kind==='oval')art+=Array.from({length:5},(_,i)=>`<path d="M50 ${32+i*9}L${35-i} ${24+i*9}M50 ${32+i*9}L${65+i} ${24+i*9}" fill="none" stroke="#fff0c8" stroke-opacity=".5" stroke-width="1.2"/>`).join('');
 if(kind==='fan')art+='<path d="M50 74L18 31M50 74L32 19M50 74L43 26M50 74L57 26M50 74L68 19M50 74L82 31" fill="none" stroke="#fff3c4" stroke-opacity=".65" stroke-width="1.2"/>';
 return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${art}<path d="M50 ${kind==='feather'?14:72}V93" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round"/></svg>`;
}
function speciesBlock(p){
 const names=[...new Set(p.species||[])];
 return `<section class="species-panel"><h3>樹種／品種</h3><p class="reference-note">地圖代表品種：<strong>${escapeHTML(representativeSpecies(p)||'待確認')}</strong></p>${names.length?`<div class="species-grid">${names.map(n=>`<figure class="species-card">${speciesIllustration(n)}<figcaption>${escapeHTML(n)}</figcaption></figure>`).join('')}</div><p class="species-note">葉形與配色為示意，不代表目前葉色。</p>`:'<p class="reference-note">樹種資料待補。</p>'}</section>`;
}

function publicShareUrl(value){
 try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='facebook.com'||u.hostname==='www.facebook.com'||u.hostname==='m.facebook.com')?u.href:null;}catch{return null;}
}
function currentShares(p){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 return (p.recent_shares||[]).filter(o=>publicShareUrl(o.url)&&o.source&&/^\d{4}-\d{2}-\d{2}$/.test(o.published_on||'')&&Number.isFinite(Date.parse(o.published_on))&&o.published_on<=today).sort((a,b)=>b.published_on.localeCompare(a.published_on)).slice(0,2);
}
function photosBlock(p){
 const records=currentShares(p),fb=publicShareUrl(p.official_facebook_url);
 const additional=(p.additional_facebook_links||[]).filter(o=>publicShareUrl(o.url)&&o.name).map(o=>`<a class="share-button" href="${escapeHTML(publicShareUrl(o.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(o.name)} Facebook ↗</a><p class="share-source">${escapeHTML(o.kind||'在地分享')} · ${escapeHTML(o.name)}</p>`).join('');
 if(!records.length&&!fb&&!additional)return '<section class="photos-panel"><div class="panel-title"><h3>最新現場分享</h3></div><p class="share-empty">尚無近期賞楓貼文</p></section>';
 const cards=records.map(o=>{
  const stale=Date.now()-Date.parse(o.observed_on||o.published_on)>14*86400000;
  const thumb=o.thumbnail_url&&o.thumbnail_permission&&/^https:\/\//.test(o.thumbnail_url)?o.thumbnail_url:null;
  return `<article class="share-card"><a class="share-preview" href="${escapeHTML(publicShareUrl(o.url))}" target="_blank" rel="noopener noreferrer">${thumb?`<img src="${escapeHTML(thumb)}" alt="${escapeHTML(o.title||p.name+'現場分享')}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="share-image-fallback" hidden>📷 查看原始貼文照片 ↗</span>`:'<span>📷 查看原始貼文照片 ↗</span>'}</a><div class="share-caption"><strong>${escapeHTML(o.title||'現場分享')}</strong><p>貼文日期：${escapeHTML(o.published_on)}${o.observed_on?` · 拍攝日期：${escapeHTML(o.observed_on)}`:' · 拍攝日期未標示'}</p><p>來源：${escapeHTML(o.source)}</p>${stale?'<p class="foliage-warning">這則分享已超過 14 天，請查看較新的貼文。</p>':''}</div></article>`;
 }).join('');
 return `<section class="photos-panel"><div class="panel-title"><h3>最新現場分享</h3><span class="share-label">${records.length?'公開貼文':'官方入口'}</span></div>${cards||'<p class="share-empty">尚無近期賞楓貼文</p>'}${fb?`<a class="share-button" href="${escapeHTML(fb)}" target="_blank" rel="noopener noreferrer">${p.official_facebook_kind==='recommended'?'查看官方推薦 Facebook 分享':'查看官方 Facebook 現場分享'} ↗</a><p class="share-source">來源：${escapeHTML(p.official_facebook_name||p.name+'官方 Facebook')}</p>`:''}${additional}<p class="share-note">開啟原站查看照片與發文日期；Facebook 可能需要登入。此入口不代表已有最新楓況。</p></section>`;
}
function historicalPhotosBlock(p){
 const seen=new Set();
 const photos=(p.historical_photos||[]).filter(o=>{const key=o.src;if(!key||seen.has(key))return false;seen.add(key);return true;});
 if(!photos.length)return `<div class="historical-photos"><h4>歷年秋色照片</h4><p class="share-note">尚未找到可直接展示且確認來源的秋色照片，待補。</p></div>`;
 const dateText=o=>o.date_kind==='captured'?`拍攝 ${o.date}`:o.date?`${o.date_kind==='source-updated'?'來源更新':'來源公告'} ${o.date}（拍攝日未標）`:'拍攝日期未標示';
 return `<div class="historical-photos"><h4>歷年秋色照片</h4><p class="share-note">點照片開啟大圖；歷年景觀參考，非目前楓況。</p>${photos.map(o=>`<figure class="history-photo"><a class="photo-image-link" href="${escapeHTML(o.large_src||o.src)}" data-photo-title="${escapeHTML(o.title)}" data-photo-caption="${escapeHTML(dateText(o)+' · 攝影／來源：'+o.author)}" data-photo-source="${escapeHTML(o.source_url)}" aria-label="開啟${escapeHTML(o.title)}大圖"><img src="${escapeHTML(o.src)}" alt="${escapeHTML(o.title)}" loading="lazy" decoding="async"><span class="photo-open-label">開啟大圖 ↗</span></a><p class="photo-unavailable" hidden>照片暫時無法載入，請由下方來源查看。</p><figcaption><p class="photo-date">${escapeHTML(o.title)} · ${escapeHTML(dateText(o))}</p><p class="photo-credit">攝影／來源：${escapeHTML(o.author)} · <a href="${escapeHTML(o.source_url)}" target="_blank" rel="noopener noreferrer">照片來源 ↗</a>${o.license&&o.license!=='原站查閱'?`<br>授權：<a href="${escapeHTML(o.license_url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(o.license)}（授權說明）</a>`:''}</p>${o.note?`<p class="share-note">${escapeHTML(o.note)}</p>`:''}</figcaption></figure>`).join('')}</div>`;
}
function openPhotoViewer(link){
 const dialog=$('#photo-dialog');
 $('#photo-viewer-title').textContent=link.dataset.photoTitle;
 $('#photo-viewer-image').src=link.href;
 $('#photo-viewer-image').alt=link.dataset.photoTitle;
 $('#photo-viewer-caption').textContent=link.dataset.photoCaption;
 $('#photo-viewer-original').href=link.href;
 $('#photo-viewer-source').href=link.dataset.photoSource;
 dialog.classList.remove('photo-zoomed');
 $('#photo-viewer-zoom').setAttribute('aria-pressed','false');
 $('#photo-viewer-zoom').textContent='放大照片';
 dialog.showModal();
}
// Deduplicate destinations within each attraction, including collapsed sections.
function linkDestination(value){
 try{
  const u=new URL(value,location.href);u.hash='';
  u.hostname=u.hostname.replace(/^www\./,'').replace(/^m\.facebook\.com$/,'facebook.com');
  for(const key of [...u.searchParams.keys()])if(/^utm_/i.test(key)||['fbclid','locale'].includes(key))u.searchParams.delete(key);
  u.searchParams.sort();u.pathname=u.pathname.replace(/\/+$/,'')||'/';
  return u.href;
 }catch{return value;}
}
function deduplicateDetailLinks(root){
 const anchors=[...root.querySelectorAll('a[href]')];
 const priority=a=>a.closest('.share-preview')?0:a.closest('.share-button')?1:a.closest('.live-camera')?2:a.closest('.location-info')?3:a.closest('.foliage-panel')?4:5;
 anchors.sort((a,b)=>priority(a)-priority(b));
 const seen=new Map();let removed=0;
 for(const anchor of anchors){
  const key=linkDestination(anchor.getAttribute('href'));
  if(anchor.closest('.official-links')){seen.set(key,anchor);continue;}
  if(!seen.has(key)){seen.set(key,anchor);continue;}
  // Keep attribution/permission wording without a second clickable destination.
  if(anchor.closest('.photo-credit')){
   const label=document.createElement('span');label.textContent=anchor.textContent.replace(/\s*↗$/,'');anchor.replaceWith(label);
  }else if(anchor.closest('.blog-photo-link')){
   // Keep the article useful even when its official guide is also an official entry.
   continue;
  }else anchor.remove();
  removed++;
 }
 return removed;
}
function renderDetail(){
 let p=places.find(p=>p.id===selected);
 if(!p){$('#detail').innerHTML='';$('#detail').hidden=true;return;}
 $('#detail').hidden=false;const s=stage(p);
 $('#detail').innerHTML=`<div class="detail-head"><button class="detail-close" aria-label="關閉景點資訊">×</button><h2>${escapeHTML(p.name)}</h2><p>${escapeHTML(p.city)}</p><nav class="detail-nav" aria-label="景點資訊區塊"><button data-section="latest-panel">楓況與分享</button><button data-section="season-panel">歷年時間</button><button data-section="species-panel">品種</button><button data-section="location-disclosure">官方資訊</button></nav></div><div class="detail-body">${latestBlock(p)}<section class="season-panel"><h3>歷年賞楓時間</h3><p class="reference-note">${escapeHTML(p.dates||'尚無資料')}</p>${historicalPhotosBlock(p)}</section>${relatedRoutesBlock(p)}${speciesBlock(p)}<section class="location-disclosure"><h3>位置與交通</h3><div class="location-info">${navigationLink(p)}${officialInfoLink(p)}${liveCamerasBlock(p)}</div></section><button class="save" type="button">${saved.has(p.id)?'★ 已收藏':'☆ 加入收藏'}</button></div>`;
 deduplicateDetailLinks($('#detail'));
 $('#detail').querySelectorAll('[data-section]').forEach(button=>{button.onclick=()=>{const target=$('#detail').querySelector('.'+button.dataset.section);if(target){if(target.tagName==='DETAILS')target.open=true;const head=$('#detail').querySelector('.detail-head');const container=$('#detail');container.scrollTop+=target.getBoundingClientRect().top-container.getBoundingClientRect().top-head.offsetHeight-14;}};});
 $('#detail').querySelectorAll('.share-preview img').forEach(img=>{img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;};});
 $('#detail').querySelectorAll('.history-photo img').forEach(img=>{img.onerror=()=>{img.closest('.photo-image-link').hidden=true;img.closest('.history-photo').querySelector('.photo-unavailable').hidden=false;};});
 $('#detail').querySelectorAll('.photo-image-link').forEach(link=>{link.onclick=e=>{e.preventDefault();openPhotoViewer(link);};});
 $('.detail-close').onclick=()=>{selected=null;render();};
 $('.save').onclick=()=>{if(saved.has(p.id))saved.delete(p.id);else saved.add(p.id);try{localStorage.setItem('maple-saved',JSON.stringify([...saved]));}catch{}render();};
}

function choose(id){
 fittedView=false;selected=id;
 const p=places.find(p=>p.id===id);if(!p)return;
 scale=Math.min(Math.max(scale,1.5),2.35);
 $('#sidebar').classList.remove('open');$('#mobile-list').textContent='☰ 景點清單';$('#mobile-list').setAttribute('aria-expanded','false');render();
 const mapRect=svg.getBoundingClientRect(),card=$('#detail').getBoundingClientRect();
 const target=svg.createSVGPoint();
 target.x=innerWidth>=1051?mapRect.left+Math.max(90,card.left-mapRect.left)/2:mapRect.left+mapRect.width/2;
 target.y=innerWidth<=1050&&card.top>mapRect.top?mapRect.top+(card.top-mapRect.top)/2:mapRect.top+mapRect.height/2;
 const q=target.matrixTransform(svg.getScreenCTM().inverse());
 panX=q.x-400-(p.x-400)*scale;panY=q.y-450-(p.y-450)*scale;transform();
}
$('#list').onclick=e=>{let el=e.target.closest('[data-id]');if(el)choose(el.dataset.id);};$('#markers').onclick=markerAction;$('#markers').onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();markerAction(e);}};
$('#region').onchange=e=>{region=e.target.value;county='all';populateCounties();selected=null;render();};$('#county').onchange=e=>{county=e.target.value;selected=null;render();};
$('#search').oninput=e=>{query=e.target.value.trim();render();};$('#month').onchange=e=>{month=e.target.value;loadPlaces();};$('.filters').onclick=e=>{let b=e.target.closest('[data-filter]');if(!b)return;filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>el.classList.toggle('active',el===b));render();};$('#mobile-list').onclick=()=>{const open=$('#sidebar').classList.toggle('open');if(open){selected=null;renderDetail();}$('#mobile-list').textContent=open?'× 關閉清單':'☰ 景點清單';$('#mobile-list').setAttribute('aria-expanded',String(open));};
const world=$('#map-world'),svg=$('#map-svg');function transform() {
  const movement = 'translate(' + panX + ' ' + panY + ')';
  const center = 'translate(400 450)';
  const sizing = 'scale(' + scale + ')';
  const restore = 'translate(-400 -450)';

  world.setAttribute(
    'transform',
    movement + ' ' + center + ' ' + sizing + ' ' + restore
  );

  renderMarkers();
};
function zoom(f){fittedView=false;const before=scale;scale=Math.max(.4,Math.min(10,scale*f));panX*=scale/before;panY*=scale/before;transform();}$('#zoom-in').onclick=()=>zoom(1.2);$('#zoom-out').onclick=()=>zoom(1/1.2);$('#reset').onclick=()=>{fitIsland();transform();};$('#map').onwheel=e=>{e.preventDefault();zoom(e.deltaY>0?1/1.08:1.08);};
let pointers=new Map(),lastDistance=null,drag=null,moved=false;
function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
$('#map').onpointerdown=e=>{if(e.target.closest('.marker'))return;fittedView=false;const p=point(e);pointers.set(e.pointerId,p);e.currentTarget.setPointerCapture(e.pointerId);drag=p;moved=false;};$('#map').onpointermove=e=>{if(!pointers.has(e.pointerId))return;const p=point(e);pointers.set(e.pointerId,p);if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(lastDistance)zoom(d/lastDistance);lastDistance=d;drag=null;}else if(drag){panX=Math.max(-5000,Math.min(5000,panX+p.x-drag.x));panY=Math.max(-5000,Math.min(5000,panY+p.y-drag.y));drag=p;transform();moved=true;}};function end(e){pointers.delete(e.pointerId);lastDistance=null;drag=pointers.size===1?[...pointers.values()][0]:null;}$('#map').onpointerup=end;$('#map').onpointercancel=end;$('#map').onkeydown=e=>{if(e.target!==$('#map'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key)){e.preventDefault();if(e.key==='+')zoom(1.2);else if(e.key==='-')zoom(1/1.2);else if(e.key==='0')$('#reset').click();else{panX+=e.key==='ArrowLeft'?25:e.key==='ArrowRight'?-25:0;panY+=e.key==='ArrowUp'?25:e.key==='ArrowDown'?-25:0;transform();}}};

let fittedView=false;
function fitIsland(){
 const boxes=[...document.querySelectorAll('.coastline .island')].map(p=>p.getBBox()).filter(b=>b.width>0&&b.height>0);
 const b=boxes.sort((a,b)=>b.width*b.height-a.width*a.height)[0];if(!b)return;
 const rect=svg.getBoundingClientRect(),unit=Math.min(rect.width/800,rect.height/900);if(!unit)return;
 const legend=document.querySelector('.legend');
 const reservedBottom=innerWidth<=700&&legend?legend.getBoundingClientRect().height+16:0;
 const padding=24;
 scale=Math.max(.4,Math.min(10,(rect.width-padding*2)/unit/b.width,(rect.height-reservedBottom-padding*2)/unit/b.height));
 const point=svg.createSVGPoint();point.x=rect.left+rect.width/2;point.y=rect.top+(rect.height-reservedBottom)/2;
 const q=point.matrixTransform(svg.getScreenCTM().inverse());
 panX=q.x-400-(b.x+b.width/2-400)*scale;panY=q.y-450-(b.y+b.height/2-450)*scale;fittedView=true;
}
globalThis.addEventListener?.('resize',()=>{if(fittedView&&!selected)fitIsland();transform();});
if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(fittedView&&!selected)fitIsland();transform();}).observe($('#map'));



fitIsland();transform();
$('#about').onclick=()=>$('#about-dialog').showModal();document.querySelectorAll('#about-dialog .dialog-close').forEach(b=>b.onclick=()=>$('#about-dialog').close());document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();if(innerWidth<=700&&!$('#sidebar').classList.contains('open'))$('#mobile-list').click();$('#search').focus();}});loadPlaces();
async function loadPlaces({refresh=false}={}){
  const ticket=++loadCounter;
  if(!refresh){places=[];render();$('#data-label').textContent='載入中';$('#data-note').textContent='正在讀取資料';}
  try{
    const responses=await Promise.all([fetch('places.json'),fetch('seasons.json',{cache:'no-store'}),fetch('foliage.json',{cache:'no-store'})]);
    if(responses.some(r=>!r.ok))throw new Error('無法讀取季節資料');
    const [base,references,foliageData]=await Promise.all(responses.map(r=>r.json()));
    const data={mode:'seasonal',places:base.map(p=>{const r=references[p.id];return {...p,foliage:foliageData.foliage?.[p.id]||null,status:null,kind:'season-reference',season_months:r?.months||[],dates:r?.period||'尚無季節資料',season_in:r?.months? r.months.includes(Number(month.slice(5))):null,source:r?.source,source_url:r?.source_url,note:r?.note,checked_at:r?.checked_at};})};
    if(ticket!==loadCounter)return;
        places=data.places;dataMode=data.mode;populateCounties();$('#directory-total').textContent=places.length;$('#about-total').textContent=places.length;
    $('.demo-pill').textContent='楓況＋季節參考';
    $('[data-filter=best]').textContent=dataMode==='seasonal'?'賞楓季內':'最佳觀賞';
    updateLegend();
    $('#data-label').textContent=dataMode==='seasonal'?'官方季節資料':dataMode==='demo'?'模擬資料':'匯入紀錄';
    const count=places.filter(p=>p.status!==null).length;
    $('#data-note').textContent = dataMode === 'seasonal'
  ? seasonSyncText(references._sync)
  : dataMode === 'demo'
    ? '模擬資料，非實際預測'
    : '已載入 ' + count + ' 筆正式紀錄，灰色表示尚無資料';
    if(!refresh)selected=null;
    render();
  }catch(err){
    if(ticket!==loadCounter)return;
    if(refresh&&places.length){$('#data-note').textContent='楓況重新讀取失敗，暫保留上次資料';render();return;}
    places=[];selected=null;render();$('.demo-pill').textContent='資料載入失敗';
    $('#data-label').textContent='讀取失敗';$('#data-note').textContent=err.message;
    $('#list').textContent='無法讀取資料，請重新整理網頁，或稍後重試。';
  }
}

function updateLegend(){
 // Explain both observation colors and their age whenever data refreshes.
 $('.legend').setAttribute('aria-label','官方楓況葉色：初期變色、最佳觀賞、觀賞尾聲；山毛櫸轉黃；虛線為超過 14 天的舊紀錄');
 $('.color-legend-heading').textContent='官方楓況葉色';
 $('.color-legend-note').textContent='山毛櫸轉黃・虛線：舊紀錄待更新';
}

function seasonSyncText(sync){
 if(!sync?.attempted_at)return '一般賞楓月份・尚未執行自動查核';
 const time=new Date(sync.attempted_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
 const pending=Math.max(0,places.length-Object.keys(sync.checks||{}).length);
 return `查核 ${time}・${sync.successful_sources} 成功／${sync.failed_sources} 未完成${pending?`・新增 ${pending} 處待自動查核`:''}・非即時楓況`;
}

function populateCounties(){const names=[...new Set(places.filter(p=>region==='all'||p.region===region).flatMap(p=>p.city.match(/[^・／]+?[縣市]/g)||[]))].sort();$('#county').innerHTML='<option value="all">全部縣市</option>'+names.map(n=>`<option ${n===county?'selected':''}>${escapeHTML(n)}</option>`).join('');}

// Refresh open pages without changing the selected month, map view or detail.
globalThis.setInterval?.(()=>{if(!document.hidden)loadPlaces({refresh:true});},5*60*1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadPlaces({refresh:true});});

new ResizeObserver(()=>renderMarkers()).observe(svg);

$('#photo-viewer-close').onclick=()=>$('#photo-dialog').close();
$('#photo-dialog').onclick=e=>{if(e.target===$('#photo-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
$('#photo-viewer-zoom').onclick=()=>{const zoomed=$('#photo-dialog').classList.toggle('photo-zoomed');$('#photo-viewer-zoom').setAttribute('aria-pressed',String(zoomed));$('#photo-viewer-zoom').textContent=zoomed?'適合畫面':'放大照片';};

// A predictable dismissal on phones, tablets and computers.
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!document.querySelector('#photo-dialog')?.open&&selected){selected=null;renderDetail();}if($('#sidebar').classList.contains('open'))$('#close-list').click();});
