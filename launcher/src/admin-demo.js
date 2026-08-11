const express=require("express");
const db=require("./database");
const docker=require("./docker");
const actions=require("./docker-actions");
const {managerCsrf}=require("./security");
const {adminPage}=require("./ui");
const {esc,fmtSec}=require("./helpers");

const r=express.Router();

function cls(s){
  return s==="running"?"success":s==="failed"?"danger":["queued","provisioning","resetting"].includes(s)?"warn":"";
}
function eventsFor(id){
  try{return db.prepare("SELECT created_at,created_at_ms,stage,level,message FROM provisioning_events WHERE demo_id=? ORDER BY id").all(id);}
  catch(_){return db.prepare("SELECT CAST(created_at_ms/1000 AS INTEGER) created_at,created_at_ms,stage,level,message FROM events WHERE demo_id=? ORDER BY id").all(id);}
}
async function payload(id){
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);
  if(!d)return null;
  const events=eventsFor(id);
  let wpLogs=d.archived_wp_logs||"",dbLogs=d.archived_db_logs||"";
  if(d.status!=="deleted"&&d.container_id){
    try{wpLogs=await actions.logs(docker.getContainer(d.container_id),180)}catch(_){}
  }
  if(d.status!=="deleted"&&d.db_container_id){
    try{dbLogs=await actions.logs(docker.getContainer(d.db_container_id),120)}catch(_){}
  }
  return {demo:d,events,wpLogs,dbLogs};
}

/*
 * Keep this route ahead of the legacy Manager router. provisioning_events is
 * intentionally a read-only compatibility VIEW; deletion must target the
 * canonical events table. Catch failures so a maintenance action never drops
 * the Manager onto Express' generic 500 page.
 */
r.post("/demos/purge-history",managerCsrf,(req,res)=>{
  try{
    const cutoff=Math.floor(Date.now()/1000)-(7*86400);
    const ids=db.prepare("SELECT id FROM demos WHERE status='deleted' AND created_at<?").all(cutoff).map(x=>x.id);
    const delEvents=db.prepare("DELETE FROM events WHERE demo_id=?");
    const delDemo=db.prepare("DELETE FROM demos WHERE id=?");
    const tx=db.transaction(()=>{
      for(const id of ids){
        delEvents.run(id);
        delDemo.run(id);
      }
    });
    tx();
    try{
      db.prepare("INSERT INTO admin_actions(created_at,action,demo_id,message) VALUES(?,?,?,?)")
        .run(Math.floor(Date.now()/1000),"purge_history",null,`Purged ${ids.length} deleted demo records older than 7 days`);
    }catch(_){}
    res.redirect("/manage/demos?saved="+encodeURIComponent(ids.length?`Purged ${ids.length} deleted demo record${ids.length===1?"":"s"}`:"No deleted demo records older than 7 days"));
  }catch(e){
    console.error("Demo history purge failed:",e);
    res.redirect("/manage/demos?error="+encodeURIComponent(`Could not purge deleted history: ${e.message||"unknown error"}`));
  }
});

r.get("/demos/:id/live.json",async(req,res)=>{
  const x=await payload(req.params.id);
  if(!x)return res.status(404).json({error:"Demo not found"});
  const d=x.demo;
  res.json({
    id:d.id,status:d.status,stage:d.provision_stage,message:d.status_message||"",
    health:d.health_status||"unknown",route:d.public_route_status||"unknown",
    url:d.url||"",username:d.admin_user||"",password:d.admin_password||"",
    oneClick:d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"",
    createdAt:d.created_at||0,expiresAt:d.expires_at||0,hardExpiresAt:d.hard_expires_at||0,
    template:d.template_version||"",platform:d.platform_version||"",
    timings:{database:d.database_ms||0,import:d.import_ms||0,wordpress:d.wordpress_ms||0,finalise:d.finalise_ms||0,routing:d.routing_ms||0},
    events:x.events,wpLogs:x.wpLogs||"",dbLogs:x.dbLogs||"",
    error:d.error_message||""
  });
});

r.get("/demos/:id",async(req,res,next)=>{
  const x=await payload(req.params.id);
  if(!x)return next();
  const d=x.demo;
  const active=["queued","provisioning","resetting"].includes(d.status);
  const oneClick=d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"";
  const elapsed=Math.max(0,(d.provision_finished_at||Math.floor(Date.now()/1000))-(d.provision_started_at||d.created_at||0));
  const rows=x.events.map(e=>`<tr><td>${new Date((e.created_at_ms||e.created_at*1000)).toLocaleTimeString()}</td><td>${esc(e.stage)}</td><td class="${e.level==='error'?'danger':e.level==='warn'?'warn':''}">${esc(e.level)}</td><td>${esc(e.message)}</td></tr>`).join("");
  res.send(adminPage("Demo Detail",`
<div class="crumb"><a href="/manage/demos">← Back to Demos</a> / ${esc(d.id)}</div>
<div class="kpirow">
 <div><h1>${esc(d.id)}</h1><div class="sub"><span id="status" class="${cls(d.status)}">${esc(d.status)}</span> · <span id="stage">${esc(d.provision_stage||'queued')}</span> · ${d.demo_type==='admin_test'?'administrator test':'public launch'}</div></div>
 <div class="actions"><span id="health" class="badge">Health ${esc(d.health_status||'unknown')}</span><span id="route" class="badge">Route ${esc(d.public_route_status||'unknown')}</span><span class="badge">${esc(d.platform_version||'unknown')}</span></div>
</div>

<div class="grid">
 <div class="card"><div class="label">Current message</div><div id="message" class="value">${esc(d.status_message||'')}</div></div>
 <div class="card"><div class="label">Template</div><div class="value">${esc(d.template_version||'—')}</div></div>
 <div class="card"><div class="label">Elapsed</div><div id="elapsed" class="stat">${fmtSec(elapsed)}</div></div>
 <div class="card"><div class="label">Expires</div><div id="expires" class="value">${d.expires_at?new Date(d.expires_at*1000).toLocaleString():'—'}</div></div>
</div>

<div class="card">
 <div class="kpirow"><div><div class="label">Access details</div><h2 style="margin:5px 0 0">Demo credentials</h2></div><span class="badge">Private disposable environment</span></div>
 <div class="credential-grid">
   <div class="credential"><span>Site URL</span><code id="cred-url">${esc(d.url||'Pending')}</code><button type="button" onclick="copyText('cred-url')">Copy</button></div>
   <div class="credential"><span>Username</span><code id="cred-user">${esc(d.admin_user||'Pending')}</code><button type="button" onclick="copyText('cred-user')">Copy</button></div>
   <div class="credential"><span>Password</span><code id="cred-pass">${esc(d.admin_password||'Pending')}</code><button type="button" onclick="copyText('cred-pass')">Copy</button></div>
 </div>
 <div class="actions" style="margin-top:16px">
  <a id="open-site" class="btn secondary" target="_blank" rel="noopener" href="${esc(d.url||'#')}">Open Site</a>
  <a id="open-admin" class="btn" target="_blank" rel="noopener" href="${esc(oneClick||'#')}">One-click Admin</a>
 </div>
</div>

<div class="card">
 <div class="kpirow"><div><div class="label">Provisioning</div><h2 style="margin:5px 0 0">Live event stream</h2></div><span class="live-dot"><i></i><span id="live-label">${active?'Updating live':'Provisioning complete'}</span></span></div>
 <div class="tablewrap"><table><thead><tr><th>Time</th><th>Stage</th><th>Level</th><th>Event</th></tr></thead><tbody id="events">${rows||'<tr><td colspan="4">Waiting for first event…</td></tr>'}</tbody></table></div>
</div>

<div class="grid logs-grid">
 <div class="card"><div class="kpirow"><div><div class="label">WordPress container</div><h2 style="margin:5px 0">Live logs</h2></div><button class="btn mini secondary" type="button" onclick="copyLog('wp-logs')">Copy</button></div><pre id="wp-logs" class="terminal">${esc(x.wpLogs||'(no WordPress logs yet)')}</pre></div>
 <div class="card"><div class="kpirow"><div><div class="label">MariaDB container</div><h2 style="margin:5px 0">Live logs</h2></div><button class="btn mini secondary" type="button" onclick="copyLog('db-logs')">Copy</button></div><pre id="db-logs" class="terminal">${esc(x.dbLogs||'(no MariaDB logs yet)')}</pre></div>
</div>

<div class="actions">
 <button class="btn secondary" type="button" onclick="refreshLive()">Refresh now</button>
 <a class="btn secondary" href="/manage/demos/${esc(d.id)}/diagnostic" target="_blank">Open diagnostic</a>
 <form method="post" action="/manage/demos/${esc(d.id)}/destroy" onsubmit="return confirm('Delete this demo?')"><button class="btn secondary">Delete demo</button></form>
</div>

<script>
const demoId=${JSON.stringify(d.id)};
function e(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function copyText(id){navigator.clipboard.writeText(document.getElementById(id).textContent||'');}
function copyLog(id){navigator.clipboard.writeText(document.getElementById(id).textContent||'');}
function renderEvents(events){const b=document.getElementById('events');b.innerHTML=events.length?events.map(x=>'<tr><td>'+new Date(x.created_at_ms||x.created_at*1000).toLocaleTimeString()+'</td><td>'+e(x.stage)+'</td><td>'+e(x.level)+'</td><td>'+e(x.message)+'</td></tr>').join(''):'<tr><td colspan="4">Waiting for first event…</td></tr>';}
async function refreshLive(){
 try{
  const r=await fetch('/manage/demos/'+encodeURIComponent(demoId)+'/live.json',{cache:'no-store'});if(!r.ok)return;
  const x=await r.json();
  document.getElementById('status').textContent=x.status;document.getElementById('stage').textContent=x.stage||'queued';document.getElementById('message').textContent=x.message||'';
  document.getElementById('health').textContent='Health '+x.health;document.getElementById('route').textContent='Route '+x.route;
  document.getElementById('cred-url').textContent=x.url||'Pending';document.getElementById('cred-user').textContent=x.username||'Pending';document.getElementById('cred-pass').textContent=x.password||'Pending';
  document.getElementById('open-site').href=x.url||'#';document.getElementById('open-admin').href=x.oneClick||'#';
  document.getElementById('wp-logs').textContent=x.wpLogs||'(no WordPress logs yet)';document.getElementById('db-logs').textContent=x.dbLogs||'(no MariaDB logs yet)';renderEvents(x.events||[]);
  if(x.expiresAt)document.getElementById('expires').textContent=new Date(x.expiresAt*1000).toLocaleString();
  const done=['running','failed','deleted'].includes(x.status);document.getElementById('live-label').textContent=done?'Provisioning complete':'Updating live';
 }catch(_){}
}
${active?"setInterval(refreshLive,2500);":""}
</script>
`,"demos"));
});

module.exports=r;
