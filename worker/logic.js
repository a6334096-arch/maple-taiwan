const KEY='maple/season-state-v1.json';
const JSON_HEADERS={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
async function readState(env){
 if(!env.BUCKET)throw new Error('Persistent storage binding is unavailable');
 const stored=await env.BUCKET.get(KEY);
 const current=stored?await stored.json():{seasons:SEED,sync:null};
 // Merge newly added places without overwriting any persisted source or observation.
 current.seasons={...SEED,...current.seasons};
 current.foliage={...Object.fromEntries(Object.keys(SEED).map(id=>[id,null])),...(current.foliage||{})};
 current.foliage_sync??=null;return current;
}
function validate(input,current){
 if(!input||typeof input!=='object'||!input.seasons||!input.checks)throw new Error('Expected seasons and checks');
 const ids=Object.keys(SEED);
 if(Object.keys(input.seasons).length!==ids.length||Object.keys(input.checks).length!==ids.length)throw new Error('All directory places must be provided');
 for(const id of ids){
  const record=input.seasons[id],check=input.checks[id];
  if(!record||!check||!['success','failed'].includes(check.status))throw new Error('Invalid place/check: '+id);
  if(typeof check.message!=='string'||check.message.length>500)throw new Error('Invalid check message');
  if(check.status==='failed'){
   if(JSON.stringify(record)!==JSON.stringify(current.seasons[id]))throw new Error('Failed source must preserve previous record: '+id);
   continue;
  }
  if(record.months!==null&&(!Array.isArray(record.months)||record.months.length===0||record.months.some(m=>!Number.isInteger(m)||m<1||m>12)))throw new Error('Invalid seasonal months');
  for(const f of ['period','source','source_url','note','checked_at'])if(typeof record[f]!=='string'||!record[f]||record[f].length>2000)throw new Error('Missing field '+f);
  const u=new URL(record.source_url),original=new URL(SEED[id].source_url);
  if(!['http:','https:'].includes(u.protocol)||u.hostname!==original.hostname)throw new Error('Source must remain on the verified official domain');
  const stamp=Date.parse(record.checked_at);
  if(!Number.isFinite(stamp)||stamp>Date.now()+300000||stamp<Date.parse(current.seasons[id].checked_at))throw new Error('Invalid or older check time');
  if(Object.keys(record).some(k=>!['months','period','source','source_url','note','checked_at'].includes(k)))throw new Error('Unsupported fields: no forecast/observation values accepted');
 }
}

function validateFoliage(input,current){
 const ids=Object.keys(SEED);
 if(!input?.foliage||!input.checks||Object.keys(input.foliage).length!==ids.length||Object.keys(input.checks).length!==ids.length)throw new Error('Provide all directory foliage records and checks');
 for(const id of ids){
  const o=input.foliage[id],c=input.checks[id];
  if(!c||!['success','failed'].includes(c.status)||typeof c.message!=='string'||c.message.length>500)throw new Error('Invalid check');
  if(c.status==='failed'){
   if(JSON.stringify(o)!==JSON.stringify(current.foliage[id]))throw new Error('Failed source must preserve foliage record');
   continue;
  }
  if(o===null){if(current.foliage[id]!==null)throw new Error('Keep older records when no new report is found');continue;}
  if(!o||!Number.isInteger(o.status)||o.status<0||o.status>3)throw new Error('Invalid observed status');
  for(const f of ['summary','scope','source','source_url','reported_at','checked_at'])if(typeof o[f]!=='string'||!o[f]||o[f].length>1000)throw new Error('Missing foliage field '+f);
  const u=new URL(o.source_url),host=u.hostname.replace(/^www\./,'');
  const domains=['forest.gov.tw','wuling-farm.com.tw','fushoushan.com.tw','taiwan.net.tw','tycg.gov.tw','wra.gov.tw','ntu.edu.tw',...Object.values(SEED).map(r=>new URL(r.source_url).hostname.replace(/^www\./,''))];
  if(!['http:','https:'].includes(u.protocol)||!domains.some(d=>host===d||host.endsWith('.'+d)))throw new Error('Official foliage source required');
  for(const date of [o.reported_at,...(o.observed_on?[o.observed_on]:[])]){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00+08:00'))||Date.parse(date+'T00:00:00+08:00')>Date.now())throw new Error('Invalid report or observation date');
  }
  if(!Number.isFinite(Date.parse(o.checked_at))||Date.parse(o.checked_at)>Date.now()+300000)throw new Error('Invalid check timestamp');
  if(current.foliage[id]&&o.reported_at<current.foliage[id].reported_at)throw new Error('Cannot overwrite a newer report');
  if(Object.keys(o).some(k=>!['status','summary','scope','source','source_url','reported_at','observed_on','checked_at'].includes(k)))throw new Error('Unsupported foliage field');
 }
}

export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  // Public query routes are read-only. Update routes require a server-side secret
  // held by the owner-private updater Site; platform service access alone is insufficient.
  if(['/api/update-context','/api/seasons/update','/api/foliage/update'].includes(path)){
   const provided=request.headers.get('X-Maple-Update-Key')||'',expected=env.MAPLE_UPDATE_KEY;
   if(!expected||provided.length!==expected.length)return json({error:'Unauthorized'},401);
   const enc=new TextEncoder();
   const a=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(provided)));
   const b=new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(expected)));
   let difference=0;for(let i=0;i<a.length;i++)difference|=a[i]^b[i];
   if(difference!==0)return json({error:'Unauthorized'},401);
  }
  if(path==='/api/update-context'&&request.method==='GET'){
   try{return json({...await readState(env),instructions:INSTRUCTIONS});}catch(e){return json({error:e.message},503);}
  }
  if(path==='/api/seasons/update'){
   if(request.method!=='POST')return json({error:'POST required'},405);
   const origin=request.headers.get('origin');
   if(origin&&origin!==url.origin)return json({error:'Cross-origin writes rejected'},403);
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
   try{
    const text=await request.text();if(text.length>200000)return json({error:'Payload too large'},413);
    const input=JSON.parse(text),current=await readState(env);validate(input,current);
    const checks=input.checks,successful_sources=Object.values(checks).filter(c=>c.status==='success').length;
    const sync={run_id:crypto.randomUUID(),attempted_at:new Date().toISOString(),successful_sources,failed_sources:Object.keys(SEED).length-successful_sources,checks};
    await env.BUCKET.put(KEY,JSON.stringify({...current,seasons:input.seasons,sync}),{httpMetadata:{contentType:'application/json'}});
    return json({ok:true,sync});
   }catch(e){return json({error:e.message},400);}
  }

  if(path==='/foliage.json'&&request.method==='GET'){
   try{const state=await readState(env);return json({foliage:state.foliage,sync:state.foliage_sync});}catch(e){return json({foliage:{},sync:null,storage_error:true});}
  }
  if(path==='/api/foliage/update'){
   if(request.method!=='POST')return json({error:'POST required'},405);
   const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Cross-origin writes rejected'},403);
   if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'JSON required'},415);
   try{
    const text=await request.text();if(text.length>200000)return json({error:'Payload too large'},413);
    const input=JSON.parse(text),current=await readState(env);validateFoliage(input,current);
    const successful_sources=Object.values(input.checks).filter(c=>c.status==='success').length;
    const sync={run_id:crypto.randomUUID(),attempted_at:new Date().toISOString(),successful_sources,failed_sources:Object.keys(SEED).length-successful_sources,checks:input.checks};
    await env.BUCKET.put(KEY,JSON.stringify({...current,foliage:input.foliage,foliage_sync:sync}),{httpMetadata:{contentType:'application/json'}});
    return json({ok:true,sync});
   }catch(e){return json({error:e.message},400);}
  }
  if(path==='/seasons.json'&&request.method==='GET'){
   try{const state=await readState(env);return json({...state.seasons,_sync:state.sync});}catch(e){return json({...SEED,_sync:null,_storage_error:true});}
  }
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=ASSETS[path==='/'?'/index.html':path];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }
};
