const profile=require("./profile");const {managerCsrf}=require("./security");const setup=require("./setup");const express=require("express");const os=require("os");const fs=require("fs");const db=require("./database");const config=require("./config");const settings=require("./settings");const lifecycle=require("./lifecycle");const docker=require("./docker");const snapshots=require("./snapshots");const templateAdmin=require("./template-admin");const provisioner=require("./provisioner");const actions=require("./docker-actions");const {adminPage}=require("./ui");const {esc,fmtSec}=require("./helpers");const r=express.Router();r.use(managerCsrf);
function secs(d){return d.provision_finished_at&&d.provision_started_at?d.provision_finished_at-d.provision_started_at:0}function cls(s){return s==="running"?"success":s==="failed"?"danger":["queued","provisioning","resetting"].includes(s)?"warn":""}function stats(rows){return [["Database","database_ms"],["Snapshot","import_ms"],["WordPress","wordpress_ms"],["Finalisation","finalise_ms"],["Routing","routing_ms"]].map(([label,key])=>{const v=rows.map(x=>+x[key]||0).filter(Boolean);return{label,ms:v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0}})}

function audit(action,demoId,message){
 try{
   db.prepare("INSERT INTO admin_actions(created_at,action,demo_id,message) VALUES(?,?,?,?)")
     .run(Math.floor(Date.now()/1000),action,demoId||null,message||action);
 }catch(_){}
}
async function live(id){const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);if(!d)return null;const events=db.prepare("SELECT created_at,created_at_ms,stage,level,message FROM provisioning_events WHERE demo_id=? ORDER BY id").all(id);let wpLogs="",dbLogs="";if(d.container_id)try{wpLogs=await actions.logs(docker.getContainer(d.container_id),250)}catch(_){}if(d.db_container_id)try{dbLogs=await actions.logs(docker.getContainer(d.db_container_id),250)}catch(_){}return{demo:d,events,wpLogs,dbLogs}}
function diag(x){const d=x.demo,start=(d.provision_started_at||d.created_at)*1000,end=d.provision_finished_at?d.provision_finished_at*1000:Date.now(),l=["DEMOPRESS DEMO DIAGNOSTIC","=========================",`Platform: ${d.platform_version||config.platformVersion}`,`Generated: ${new Date().toISOString()}`,`Demo: ${d.id}`,`Type: ${d.demo_type||"public"}`,`Status: ${d.status}`,`Stage: ${d.provision_stage}`,`Message: ${d.status_message||""}`,`Template: ${d.template_version}`,`Elapsed: ${((end-start)/1000).toFixed(3)}s`,"","STAGE TIMINGS",`database_ms=${d.database_ms||0}`,`import_ms=${d.import_ms||0}`,`wordpress_ms=${d.wordpress_ms||0}`,`finalise_ms=${d.finalise_ms||0}`,`routing_ms=${d.routing_ms||0}`,"","EVENT TIMELINE"];for(const e of x.events){const ms=e.created_at_ms||e.created_at*1000;l.push(`${new Date(ms).toISOString()} +${((ms-start)/1000).toFixed(3)}s [${e.level}] [${e.stage}] ${e.message}`)}l.push("","WORDPRESS LOGS",x.wpLogs||"(none)","","MARIADB LOGS",x.dbLogs||"(none)");return l.join("\n")}
async function sys(){let dockerOk=true,imageOk=true,imageInfo=null;try{await docker.ping()}catch(_){dockerOk=false}try{imageInfo=await docker.getImage(config.demoImage).inspect()}catch(_){imageOk=false}const report=await lifecycle.orphanReport().catch(()=>({total:0,databaseTotal:0,orphanContainers:[]})),snap=snapshots.current(),active=db.prepare("SELECT COUNT(*) c FROM demos WHERE status IN ('queued','provisioning','running','resetting')").get().c;let disk="unknown";try{const st=fs.statfsSync("/data");disk=((st.bavail*st.bsize)/1073741824).toFixed(1)+" GB free"}catch(_){}return{dockerOk,imageOk,imageInfo,report,snap,active,disk,mt:os.totalmem(),mf:os.freemem()}}
r.use("/setup",setup);
r.get("/",async(req,res)=>{const all=db.prepare("SELECT * FROM demos ORDER BY created_at DESC").all(),active=all.filter(x=>["queued","provisioning","running","resetting"].includes(x.status)).length,launching=all.filter(x=>["queued","provisioning","resetting"].includes(x.status)).length,failed=all.filter(x=>x.status==="failed").length,today=all.filter(x=>x.created_at>Date.now()/1000-86400).length,times=all.map(secs).filter(Boolean),avg=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):0,success=all.filter(x=>["running","deleted"].includes(x.status)).length,rate=all.length?(success/all.length*100).toFixed(1):"—",snap=snapshots.current();res.send(adminPage("Dashboard",`<div class="kpirow"><div><h1>DemoPress Manager</h1><div class="sub">Platform ${esc(config.platformVersion)} · generic disposable WordPress demo control plane.</div></div><span class="badge ${settings.get("maintenance_mode","0")==="1"?"warn":"success"}">${settings.get("maintenance_mode","0")==="1"?"Maintenance":"Operational"}</span></div><div class="grid"><div class="card"><div class="label">Active</div><div class="stat">${active}</div><p class="muted">${launching} launching</p></div><div class="card"><div class="label">Launches today</div><div class="stat">${today}</div><p class="muted">${all.length} all time</p></div><div class="card"><div class="label">Success rate</div><div class="stat">${rate}${rate==="—"?"":"%"}</div><p class="muted">${failed} failed retained</p></div></div><div class="grid" style="margin-top:15px"><div class="card"><div class="label">Average launch</div><div class="stat">${fmtSec(avg)}</div></div><div class="card"><div class="label">Current template</div><div class="value">${esc((snap||{}).version||"None")}</div><p class="muted">${snap?(snap.size_bytes/1048576).toFixed(1)+" MB snapshot":"No snapshot"}</p></div><div class="card"><div class="label">Capacity</div><div class="stat">${active}/${settings.number("max_active_demos",config.maxDemos)}</div></div></div><div class="actions"><form method="post" action="/manage/test-launch"><button class="btn">Launch Test Demo</button></form><a class="btn secondary" href="/manage/setup">Setup Wizard</a><a class="btn secondary" href="/manage/profile">Profile</a><a class="btn secondary" href="/manage/template">Template Manager</a><a class="btn secondary" href="/manage/diagnostics">Diagnostics</a></div>`,"overview"))});
r.post("/test-launch",(req,res)=>{try{const d=provisioner.create("admin-test",{adminTest:true});audit("test_launch",d.id,"Administrator test demo launched");res.redirect(`/manage/demos/${d.id}`)}catch(e){res.status(500).send(adminPage("Test launch failed",`<h1>Test launch failed</h1><div class="notice">${esc(e.message)}</div>`,"overview"))}});
r.get("/demos",(req,res)=>{
 const status=(req.query.status||"").trim();
 const type=(req.query.type||"").trim();
 const q=(req.query.q||"").trim().toLowerCase();

 let rows=db.prepare("SELECT * FROM demos ORDER BY created_at DESC LIMIT 500").all();

 if(status)rows=rows.filter(d=>d.status===status);
 if(type)rows=rows.filter(d=>d.demo_type===type);
 if(q)rows=rows.filter(d=>
   d.id.toLowerCase().includes(q) ||
   (d.template_version||"").toLowerCase().includes(q) ||
   (d.admin_user||"").toLowerCase().includes(q)
 );

 const total=rows.length;
 const running=rows.filter(d=>d.status==="running").length;
 const failed=rows.filter(d=>d.status==="failed").length;
 const degraded=rows.filter(d=>d.health_status==="degraded").length;

 res.send(adminPage("Demos",`
 <div class="kpirow">
   <div>
     <h1>Demos</h1>
     <div class="sub">Search, filter and manage disposable environments.</div>
   </div>
   <form method="post" action="/manage/test-launch"><button class="btn">Launch Test Demo</button></form>
 </div>

 <div class="grid">
   <div class="card"><div class="label">Matching</div><div class="stat">${total}</div></div>
   <div class="card"><div class="label">Running</div><div class="stat success">${running}</div></div>
   <div class="card"><div class="label">Failed / degraded</div><div class="stat ${failed||degraded?"warn":"success"}">${failed} / ${degraded}</div></div>
 </div>

 <form method="get" action="/manage/demos" class="card" style="margin-top:15px">
   <div class="formgrid">
     <label>Search
       <input name="q" value="${esc(req.query.q||"")}" placeholder="Demo ID, user or template">
     </label>
     <label>Status
       <select name="status">
         <option value="">All statuses</option>
         ${["running","queued","provisioning","resetting","failed","deleted"].map(v=>`<option value="${v}" ${status===v?"selected":""}>${v}</option>`).join("")}
       </select>
     </label>
     <label>Type
       <select name="type">
         <option value="">All types</option>
         <option value="public" ${type==="public"?"selected":""}>Public</option>
         <option value="admin_test" ${type==="admin_test"?"selected":""}>Admin test</option>
       </select>
     </label>
   </div>
   <div class="actions">
     <button class="btn">Apply filters</button>
     <a class="btn secondary" href="/manage/demos">Clear</a>
   </div>
 </form>

 <div class="tablewrap" style="margin-top:15px">
 <table>
   <tr><th>Demo</th><th>Type</th><th>Status</th><th>Health</th><th>Age</th><th>Expires</th><th>Launch</th><th>Actions</th></tr>
   ${rows.map(d=>`<tr>
     <td><a href="/manage/demos/${d.id}"><strong>${esc(d.id)}</strong></a></td>
     <td>${d.demo_type==="admin_test"?"Admin test":"Public"}</td>
     <td class="${cls(d.status)}">${esc(d.status)}</td>
     <td class="${d.health_status==="degraded"?"danger":d.health_status==="healthy"?"success":""}">${esc(d.health_status||"unknown")}</td>
     <td>${fmtSec(Math.max(0,Math.floor(Date.now()/1000)-d.created_at))}</td>
     <td>${d.status==="running"?fmtSec(Math.max(0,d.expires_at-Math.floor(Date.now()/1000))):"—"}</td>
     <td>${secs(d)?fmtSec(secs(d)):"—"}</td>
     <td>
       <a class="btn mini secondary" href="/manage/demos/${d.id}">Details</a>
       ${d.status==="running"?` <a class="btn mini secondary" target="_blank" href="${esc(d.url)}">Open</a>`:""}
     </td>
   </tr>`).join("")}
 </table>
 </div>

 <div class="actions" style="margin-top:18px">
   <form method="post" action="/manage/demos/purge-history" onsubmit="return confirm('Remove old deleted demo records and their provisioning events? Running demos are not affected.')">
     <button class="btn secondary">Purge Deleted History</button>
   </form>
 </div>
 `,"demos"));
});

r.get("/demos/:id",async(req,res)=>{const x=await live(req.params.id);if(!x)return res.status(404).send(adminPage("Demo not found",`<div class="crumb"><a href="/manage/demos">← Demos</a></div><h1>Demo not found.</h1><p class="muted">That demo record does not exist.</p><div class="actions"><a class="btn" href="/manage/demos">Back to Demos</a></div>`,"demos"));const d=x.demo,tm=stats([d]),mx=Math.max(1,...tm.map(v=>v.ms)),events=x.events.map(e=>`<tr><td>${new Date(e.created_at_ms||e.created_at*1000).toLocaleTimeString()}</td><td>${esc(e.stage)}</td><td>${esc(e.level)}</td><td>${esc(e.message)}</td></tr>`).join(""),auto=["queued","provisioning","resetting"].includes(d.status);res.send(adminPage("Demo Detail",`<div class="crumb"><a href="/manage/demos">← Back to Demos</a> / ${esc(d.id)}</div><div class="kpirow"><div><h1>${esc(d.id)}</h1><div class="sub"><span id="live-status" class="${cls(d.status)}">${esc(d.status)}</span> · <span id="live-stage">${esc(d.provision_stage)}</span> · ${d.demo_type==="admin_test"?"administrator test":"public launch"}</div></div><div class="actions"><span class="badge ${d.health_status==="degraded"?"danger":d.health_status==="healthy"?"success":""}">Health ${esc(d.health_status||"unknown")}</span><span class="badge ${d.public_route_status==="verified"?"success":d.public_route_status==="failed"?"danger":"warn"}">Route ${esc(d.public_route_status||"unknown")}</span><span class="badge">Platform ${esc(d.platform_version||"unknown")}</span></div></div><div class="grid"><div class="card"><div class="label">Current message</div><strong id="live-message">${esc(d.status_message)}</strong></div><div class="card"><div class="label">Template</div><div class="value">${esc(d.template_version)}</div></div><div class="card"><div class="label">Provision time</div><div class="stat">${secs(d)?fmtSec(secs(d)):"Running…"}</div></div><div class="card"><div class="label">Last successful stage</div><div class="value">${esc((x.events.filter(e=>e.level!=="error").slice(-1)[0]||{}).stage||"queued")}</div></div></div><div class="actions">${d.status==="running"?`<a class="btn" target="_blank" href="${esc(d.url)}">Open Site</a><button class="btn secondary" onclick="openAdmin()">One-click Admin</button><form method="post" action="/manage/demos/${d.id}/reset" onsubmit="return confirm('Reset this demo back to the current golden snapshot? All changes in the demo will be lost.')"><button class="btn secondary">Reset Demo</button></form><form method="post" action="/manage/demos/${d.id}/extend"><button class="btn secondary">Extend +30m</button></form>`:""}<button class="btn secondary" onclick="refreshLive()">Refresh Logs</button><button class="btn secondary" onclick="copyDiagnostic()">Copy Diagnostic Log</button><a class="btn secondary" href="/manage/demos/${esc(d.id)}/diagnostic" target="_blank">Open Diagnostic .txt</a>${d.status==="failed"&&d.container_id?`<form method="post" action="/manage/demos/${d.id}/retry-finalisation"><button class="btn secondary">Retry Finalisation</button></form>`:""}<form method="post" action="/manage/demos/${d.id}/destroy" onsubmit="return confirm('Destroy this demo and its database? This cannot be undone.')"><button class="btn red">Destroy</button></form></div><h2>Provisioning performance</h2><div class="card">${tm.map(v=>`<div class="barrow"><span>${v.label}</span><div class="bar"><i style="width:${Math.round(v.ms/mx*100)}%"></i></div><strong>${(v.ms/1000).toFixed(2)}s</strong></div>`).join("")}</div><h2>Live Provisioning Timeline</h2><div class="tablewrap"><table><thead><tr><th>Time</th><th>Stage</th><th>Level</th><th>Message</th></tr></thead><tbody id="events">${events||'<tr><td colspan="4">No events recorded yet.</td></tr>'}</tbody></table></div><h2>MariaDB Live Logs</h2><div class="log" id="db-logs">${esc(x.dbLogs||"No database logs available yet.")}</div><h2>WordPress Live Logs</h2><div class="log" id="wp-logs">${esc(x.wpLogs||"WordPress container has not started yet.")}</div>${d.error_message?`<h2>Failure</h2><div class="notice"><strong>Stage:</strong> ${esc(d.provision_stage)}<br><strong>Reason:</strong> ${esc(d.error_message)}<br><strong>Duration:</strong> ${secs(d)?fmtSec(secs(d)):"in progress"}</div>`:""}${d.public_route_last_error?`<h2>Public Route Diagnostic</h2><div class="notice"><strong>Status:</strong> ${esc(d.public_route_status||"unknown")}<br><strong>Launcher result:</strong> ${esc(d.public_route_last_error)}<br><span class="muted">This can be a Docker DNS/hairpin limitation even when the demo works externally.</span></div>`:""}${d.degraded_logs?`<h2>Captured Degradation Logs</h2><div class="notice">A post-ready health check failed and the WordPress log tail was captured automatically.</div><div class="log">${esc(d.degraded_logs)}</div>`:""}<script>
async function openAdmin(){
 try{
   const r=await fetch('/api/demo-tools/login-token',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({demo:'${esc(d.id)}'})
   });
   const x=await r.json();
   if(x.url)window.open(x.url,'_blank');
   else alert('Unable to create one-click login.');
 }catch(e){alert('Unable to create one-click login.');}
}
async function copyDiagnostic(){try{const r=await fetch('/manage/demos/${esc(d.id)}/diagnostic',{cache:'no-store'}),t=await r.text();await navigator.clipboard.writeText(t);alert('Diagnostic log copied.')}catch(e){window.open('/manage/demos/${esc(d.id)}/diagnostic','_blank')}}async function refreshLive(){try{const r=await fetch('/manage/demos/${esc(d.id)}/live',{cache:'no-store'}),q=await r.json();document.getElementById('live-status').textContent=q.status;document.getElementById('live-stage').textContent=q.stage;document.getElementById('live-message').textContent=q.message||'';document.getElementById('db-logs').textContent=q.dbLogs||'No database logs available yet.';document.getElementById('wp-logs').textContent=q.wpLogs||'WordPress container has not started yet.';document.getElementById('events').innerHTML=q.eventsHtml||'<tr><td colspan="4">No events recorded yet.</td></tr>';if(['queued','provisioning','resetting'].includes(q.status))setTimeout(refreshLive,2000)}catch(e){setTimeout(refreshLive,4000)}}${auto?"setTimeout(refreshLive,1200);":""}</script>`,"demos"))});
r.get("/demos/:id/live",async(req,res)=>{const x=await live(req.params.id);if(!x)return res.status(404).json({error:"not found"});const d=x.demo;res.set("Cache-Control","no-store");res.json({status:d.status,stage:d.provision_stage,message:d.status_message,error:d.error_message,eventsHtml:x.events.map(e=>`<tr><td>${new Date(e.created_at_ms||e.created_at*1000).toLocaleTimeString()}</td><td>${esc(e.stage)}</td><td>${esc(e.level)}</td><td>${esc(e.message)}</td></tr>`).join(""),wpLogs:x.wpLogs,dbLogs:x.dbLogs})});
r.get("/demos/:id/diagnostic",async(req,res)=>{const x=await live(req.params.id);if(!x)return res.status(404).send("Not found");res.type("text/plain; charset=utf-8").send(diag(x))});
r.post("/demos/:id/retry-finalisation",async(req,res)=>{
 try{
   audit("retry_finalisation",req.params.id,"Administrator retried finalisation");await provisioner.retryFinalisation(req.params.id);
   res.redirect(`/manage/demos/${req.params.id}`);
 }catch(e){
   res.status(500).send(adminPage(
     "Retry failed",
     `<div class="crumb"><a href="/manage/demos/${esc(req.params.id)}">← Back to Demo</a></div>
      <h1>Finalisation retry failed</h1>
      <div class="notice">${esc(e.message)}</div>
      <div class="actions"><a class="btn secondary" href="/manage/demos/${esc(req.params.id)}">View diagnostics</a></div>`,
     "demos"
   ));
 }
});


r.post("/demos/purge-history",(req,res)=>{
 const cutoff=Math.floor(Date.now()/1000)-(7*86400);
 const ids=db.prepare("SELECT id FROM demos WHERE status='deleted' AND created_at<?").all(cutoff).map(x=>x.id);

 const delEvents=db.prepare("DELETE FROM provisioning_events WHERE demo_id=?");
 const delDemo=db.prepare("DELETE FROM demos WHERE id=?");

 const tx=db.transaction(()=>{
   for(const id of ids){
     delEvents.run(id);
     delDemo.run(id);
   }
 });

 tx();
 audit("purge_history",null,`Purged ${ids.length} deleted demo records older than 7 days`);
 res.redirect("/manage/demos");
});

r.post("/demos/:id/reset",(req,res)=>{
 const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);
 if(!d)return res.status(404).send(adminPage("Demo not found",`<div class="crumb"><a href="/manage/demos">← Demos</a></div><h1>Demo not found.</h1><p class="muted">That demo record does not exist.</p>`,"demos"));
 if(d.status!=="running")return res.status(409).send(adminPage("Demo unavailable",`<div class="crumb"><a href="/manage/demos/${esc(d.id)}">← Demo</a></div><h1>Demo is not running.</h1><p class="muted">Reset is only available for running demos.</p><div class="actions"><a class="btn" href="/manage/demos/${esc(d.id)}">Back to Demo</a></div>`,"demos"));
 audit("reset",d.id,"Administrator reset demo to current snapshot");
 provisioner.reset(d.id);
 res.redirect(`/manage/demos/${d.id}`);
});

r.post("/demos/:id/extend",(req,res)=>{
 const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);
 if(!d)return res.status(404).send(adminPage("Demo not found",`<div class="crumb"><a href="/manage/demos">← Demos</a></div><h1>Demo not found.</h1><p class="muted">That demo record does not exist.</p>`,"demos"));
 if(d.status!=="running")return res.status(409).send(adminPage("Demo unavailable",`<div class="crumb"><a href="/manage/demos/${esc(d.id)}">← Demo</a></div><h1>Demo is not running.</h1><p class="muted">Expiry can only be extended for running demos.</p><div class="actions"><a class="btn" href="/manage/demos/${esc(d.id)}">Back to Demo</a></div>`,"demos"));

 const now=Math.floor(Date.now()/1000);
 const proposed=Math.max(d.expires_at,now)+(30*60);
 const newExpiry=Math.min(proposed,d.hard_expires_at);

 db.prepare("UPDATE demos SET expires_at=?,last_activity=? WHERE id=?").run(newExpiry,now,d.id);
 audit("extend",d.id,`Administrator extended demo expiry to ${new Date(newExpiry*1000).toISOString()}`);
 res.redirect(`/manage/demos/${d.id}`);
});

r.post("/demos/:id/destroy",async(req,res)=>{audit("destroy",req.params.id,"Administrator destroyed demo");await lifecycle.destroy(req.params.id);res.redirect("/manage/demos")});r.use("/template",templateAdmin);
r.get("/diagnostics",async(req,res)=>{const rows=db.prepare("SELECT * FROM demos WHERE provision_started_at IS NOT NULL ORDER BY created_at DESC LIMIT 20").all(),done=rows.filter(x=>x.provision_finished_at),times=done.map(secs).filter(Boolean),av=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):0,st=stats(done),mx=Math.max(1,...st.map(v=>v.ms));res.send(adminPage("Diagnostics",`<div class="kpirow"><div><h1>Diagnostics</h1><div class="sub">Provisioning health and recent launches.</div></div><a class="btn secondary" href="/manage/diagnostics/system">System Diagnostics</a><button class="btn secondary" onclick="copySystem()">Copy Diagnostic</button></div><div class="grid"><div class="card"><div class="label">Completed</div><div class="stat">${done.length}</div></div><div class="card"><div class="label">Successful / failed</div><div class="stat">${done.filter(x=>["running","deleted"].includes(x.status)).length} / ${done.filter(x=>x.status==="failed").length}</div></div><div class="card"><div class="label">Average launch</div><div class="stat">${fmtSec(av)}</div></div></div><h2>Average stage time</h2><div class="card">${st.map(v=>`<div class="barrow"><span>${v.label}</span><div class="bar"><i style="width:${Math.round(v.ms/mx*100)}%"></i></div><strong>${(v.ms/1000).toFixed(2)}s</strong></div>`).join("")}</div><h2>Recent manager actions</h2>
<div class="tablewrap"><table><tr><th>Time</th><th>Action</th><th>Demo</th><th>Message</th></tr>
${db.prepare("SELECT * FROM admin_actions ORDER BY created_at DESC LIMIT 20").all().map(x=>`<tr><td>${new Date(x.created_at*1000).toLocaleString()}</td><td>${esc(x.action)}</td><td>${esc(x.demo_id||"—")}</td><td>${esc(x.message)}</td></tr>`).join("")}
</table></div>
<h2>Recent launches</h2><div class="tablewrap"><table><tr><th>Demo</th><th>Status</th><th>Type</th><th>Total</th><th>Template</th></tr>${rows.map(d=>`<tr><td><a href="/manage/demos/${d.id}">${esc(d.id)}</a></td><td class="${cls(d.status)}">${esc(d.status)}</td><td>${d.demo_type==="admin_test"?"Admin test":"Public"}</td><td>${secs(d)?fmtSec(secs(d)):"—"}</td><td>${esc(d.template_version)}</td></tr>`).join("")}</table></div><script>async function copySystem(){const r=await fetch('/manage/diagnostics/system.txt'),t=await r.text();await navigator.clipboard.writeText(t);alert('System diagnostic copied.')}</script>`,"diagnostics"))});
r.get("/diagnostics/system",async(req,res)=>{
 const s=await sys();
 const recent=db.prepare("SELECT id,status,provision_stage,error_message,template_version,database_ms,import_ms,wordpress_ms,finalise_ms,routing_ms,platform_version,created_at FROM demos ORDER BY created_at DESC LIMIT 10").all();
 const completed=recent.filter(x=>x.status==="running"||x.status==="failed"||x.status==="deleted");
 const stage=stats(completed);
 const max=Math.max(1,...stage.map(x=>x.ms));
 const memUsed=s.mt-s.mf;
 const memPct=s.mt?Math.round((memUsed/s.mt)*100):0;
 const snapshotSize=s.snap?(s.snap.size_bytes/1048576).toFixed(2):"—";

 res.send(adminPage("System Diagnostics",`
 <div class="crumb"><a href="/manage/diagnostics">← Back to Diagnostics</a> / System Diagnostics</div>

 <div class="kpirow">
   <div>
     <h1>System Diagnostics</h1>
     <div class="sub">Platform, infrastructure and recent provisioning health in one view.</div>
   </div>
   <span class="badge ${s.dockerOk&&s.imageOk&&s.snap?"success":"warn"}">
     ${s.dockerOk&&s.imageOk&&s.snap?"Operational":"Attention required"}
   </span>
 </div>

 <div class="actions">
   <button class="btn" onclick="copySystemDiagnostic()">Copy System Diagnostic</button>
   <a class="btn secondary" href="/manage/diagnostics/system.txt" target="_blank">Open Plain Text</a>
   <a class="btn secondary" href="/manage/system">System Health</a>
 </div>

 <h2>Platform</h2>
 <div class="grid">
   <div class="card">
     <div class="label">Platform version</div>
     <div class="stat" style="font-size:22px">${esc(config.platformVersion)}</div>
     <p class="muted">Node ${esc(process.version)}</p>
   </div>
   <div class="card">
     <div class="label">Docker</div>
     <div class="stat ${s.dockerOk?"success":"danger"}">${s.dockerOk?"Connected":"Unavailable"}</div>
     <p class="muted">Host Docker daemon</p>
   </div>
   <div class="card">
     <div class="label">Demo image</div>
     <div class="stat ${s.imageOk?"success":"danger"}">${s.imageOk?"Available":"Missing"}</div>
     <p class="muted">${esc(config.demoImage)}</p>
   </div>
 </div>

 <div class="grid" style="margin-top:15px">
   <div class="card">
     <div class="label">Golden template</div>
     <div class="stat ${s.snap?"success":"danger"}">${s.snap?"Published":"Missing"}</div>
     <p class="muted">${s.snap?esc(s.snap.version):"No current snapshot"}</p>
   </div>
   <div class="card">
     <div class="label">Snapshot size</div>
     <div class="stat" style="font-size:22px">${snapshotSize}${s.snap?" MB":""}</div>
     <p class="muted">Current published snapshot</p>
   </div>
   <div class="card">
     <div class="label">Active demos</div>
     <div class="stat">${s.active}</div>
     <p class="muted">Provisioning + running environments</p>
   </div>
 </div>

 <h2>Host resources</h2>
 <div class="grid">
   <div class="card">
     <div class="label">Memory usage</div>
     <div class="stat" style="font-size:22px">${(memUsed/1073741824).toFixed(2)} / ${(s.mt/1073741824).toFixed(2)} GB</div>
     <div class="progress"><div style="width:${memPct}%"></div></div>
     <p class="muted">${memPct}% currently used</p>
   </div>
   <div class="card">
     <div class="label">Disk</div>
     <div class="stat" style="font-size:22px">${esc(s.disk)}</div>
     <p class="muted">Launcher data filesystem</p>
   </div>
   <div class="card">
     <div class="label">Cleanup health</div>
     <div class="stat ${(s.report.total||0)===0?"success":"warn"}">${(s.report.total||0)===0?"Clean":"Review"}</div>
     <p class="muted">${s.report.total||0} orphan containers · ${s.report.databaseTotal||0} orphan databases</p>
   </div>
 </div>

 <h2>Average provisioning stages</h2>
 <div class="card">
   ${stage.length?stage.map(x=>`
     <div class="barrow">
       <span>${x.label}</span>
       <div class="bar"><i style="width:${Math.round((x.ms/max)*100)}%"></i></div>
       <strong>${(x.ms/1000).toFixed(2)}s</strong>
     </div>`).join(""):'<p class="muted">No completed provisioning samples yet.</p>'}
 </div>

 <h2>Recent demo health</h2>
 <div class="tablewrap">
   <table>
     <thead>
       <tr>
         <th>Demo</th>
         <th>Status</th>
         <th>Stage</th>
         <th>Template</th>
         <th>Platform</th>
         <th>Details</th>
       </tr>
     </thead>
     <tbody>
       ${recent.length?recent.map(d=>`
         <tr>
           <td><strong>${esc(d.id)}</strong></td>
           <td class="${cls(d.status)}">${esc(d.status)}</td>
           <td>${esc(d.provision_stage||"—")}</td>
           <td>${esc(d.template_version||"—")}</td>
           <td>${esc(d.platform_version||"unknown")}</td>
           <td><a class="btn mini secondary" href="/manage/demos/${esc(d.id)}">View</a></td>
         </tr>`).join(""):'<tr><td colspan="6">No demo history yet.</td></tr>'}
     </tbody>
   </table>
 </div>

 <h2>Docker image identity</h2>
 <div class="card">
   <div class="label">Configured image</div>
   <div class="value">${esc(config.demoImage)}</div>
   <div class="label" style="margin-top:14px">Image ID</div>
   <div class="codeblock">${esc(s.imageInfo?s.imageInfo.Id:"Image unavailable")}</div>
 </div>

 <div class="notice" style="margin-top:18px">
   The styled page is intended for day-to-day management. The plain-text diagnostic remains available for copying into support/debugging conversations.
 </div>

 <script>
 async function copySystemDiagnostic(){
   try{
     const r=await fetch('/manage/diagnostics/system.txt',{cache:'no-store'});
     const text=await r.text();
     await navigator.clipboard.writeText(text);
     alert('System diagnostic copied to clipboard.');
   }catch(e){
     window.open('/manage/diagnostics/system.txt','_blank');
   }
 }
 </script>
 `,"diagnostics"));
});

r.get("/diagnostics/system.txt",async(req,res)=>{const s=await sys(),recent=db.prepare("SELECT id,status,provision_stage,error_message,template_version,database_ms,import_ms,wordpress_ms,finalise_ms,routing_ms,platform_version FROM demos ORDER BY created_at DESC LIMIT 10").all();res.type("text/plain").send(["DEMOPRESS SYSTEM DIAGNOSTIC","===========================",`Platform: ${config.platformVersion}`,`Generated: ${new Date().toISOString()}`,`Node: ${process.version}`,`Demo image: ${config.demoImage}`,`Image ID: ${s.imageInfo?s.imageInfo.Id:"missing"}`,`Docker: ${s.dockerOk?"connected":"unavailable"}`,`Template: ${s.snap?s.snap.version:"missing"}`,`Snapshot size: ${s.snap?(s.snap.size_bytes/1048576).toFixed(2)+" MB":"n/a"}`,`Active demos: ${s.active}`,`Memory: ${((s.mt-s.mf)/1073741824).toFixed(2)} / ${(s.mt/1073741824).toFixed(2)} GB`,`Disk: ${s.disk}`,`Orphan containers: ${s.report.total||0}`,`Orphan databases: ${s.report.databaseTotal||0}`,"","RECENT DEMOS",...recent.map(x=>JSON.stringify(x))].join("\n"))});
r.get("/system",async(req,res)=>{const s=await sys();res.send(adminPage("System",`<h1>System Health</h1><div class="sub">Infrastructure, capacity, cleanup and resource health.</div><div class="grid"><div class="card"><div class="label">Launcher</div><div class="stat success">Healthy</div><p class="muted">Platform ${esc(config.platformVersion)}</p></div><div class="card"><div class="label">Docker</div><div class="stat ${s.dockerOk?"success":"danger"}">${s.dockerOk?"Connected":"Down"}</div></div><div class="card"><div class="label">Demo image</div><div class="stat ${s.imageOk?"success":"danger"}">${s.imageOk?"Available":"Missing"}</div><p class="muted">${esc(config.demoImage)}</p></div></div><div class="grid" style="margin-top:15px"><div class="card"><div class="label">Template</div><div class="stat ${s.snap?"success":"danger"}">${s.snap?"Valid":"Missing"}</div><p class="muted">${s.snap?esc(s.snap.version):"No snapshot"}</p></div><div class="card"><div class="label">Memory</div><div class="stat" style="font-size:20px">${((s.mt-s.mf)/1073741824).toFixed(1)} / ${(s.mt/1073741824).toFixed(1)} GB</div></div><div class="card"><div class="label">Disk</div><div class="stat" style="font-size:20px">${s.disk}</div></div></div><div class="grid" style="margin-top:15px"><div class="card"><div class="label">Orphan containers</div><div class="stat ${s.report.total?"warn":"success"}">${s.report.total||0}</div></div><div class="card"><div class="label">Orphan databases</div><div class="stat ${s.report.databaseTotal?"warn":"success"}">${s.report.databaseTotal||0}</div></div><div class="card"><div class="label">Cleanup worker</div><div class="stat success" style="font-size:20px">Automatic</div></div></div><div class="actions"><form method="post" action="/manage/system/reconcile"><button class="btn secondary">Clean Orphans Now</button></form><a class="btn secondary" href="/health">Public Health</a><a class="btn secondary" href="/manage/diagnostics/system">System Diagnostics</a></div>`,"system"))});r.post("/system/reconcile",async(req,res)=>{await lifecycle.reconcile();res.redirect("/manage/system")});
r.get("/analytics",(req,res)=>{const rows=db.prepare("SELECT * FROM demos WHERE created_at>?").all(Math.floor(Date.now()/1000)-604800),times=rows.map(secs).filter(Boolean),avg=times.length?Math.round(times.reduce((a,b)=>a+b,0)/times.length):0,st=stats(rows),mx=Math.max(1,...st.map(v=>v.ms));res.send(adminPage("Analytics",`<h1>Analytics</h1><div class="sub">Usage and provisioning performance over the last 7 days.</div><div class="grid"><div class="card"><div class="label">Launches</div><div class="stat">${rows.length}</div></div><div class="card"><div class="label">Success / failed</div><div class="stat">${rows.filter(x=>["running","deleted"].includes(x.status)).length} / ${rows.filter(x=>x.status==="failed").length}</div></div><div class="card"><div class="label">Average</div><div class="stat">${fmtSec(avg)}</div><p class="muted">Fastest ${fmtSec(times.length?Math.min(...times):0)} · Slowest ${fmtSec(times.length?Math.max(...times):0)}</p></div></div><h2>Average stage time</h2><div class="card">${st.map(v=>`<div class="barrow"><span>${v.label}</span><div class="bar"><i style="width:${Math.round(v.ms/mx*100)}%"></i></div><strong>${(v.ms/1000).toFixed(2)}s</strong></div>`).join("")}</div>`,"analytics"))});

r.get("/profile",(req,res)=>{
 const p=profile.load();
 res.send(adminPage("Profile",`
 <div class="kpirow"><div><h1>Demo Profile</h1><div class="sub">Edit product-specific configuration without touching code.</div></div><a class="btn secondary" href="/manage/setup">Run Setup Wizard</a></div>
 <form method="post" action="/manage/profile">
 <div class="grid">
  <div class="card"><h2 style="margin-top:0">Identity</h2><label>Product name<input name="productName" value="${esc(p.productName)}"></label><label>Company name<input name="companyName" value="${esc(p.companyName)}"></label><label>Homepage URL<input name="homepageUrl" value="${esc(p.homepageUrl)}"></label></div>
  <div class="card"><h2 style="margin-top:0">Domains</h2><label>Launcher domain<input name="launcherDomain" value="${esc(p.launcherDomain)}"></label><label>Template domain<input name="templateDomain" value="${esc(p.templateDomain)}"></label></div>
  <div class="card"><h2 style="margin-top:0">Branding</h2><label>Logo URL<input name="logoUrl" value="${esc((p.branding||{}).logoUrl||"")}"></label><label>Favicon URL<input name="faviconUrl" value="${esc((p.branding||{}).faviconUrl||"")}"></label><label>Accent<input type="color" name="accent" value="${esc((p.branding||{}).accent||"#ffffff")}"></label></div>
 </div>
 <div class="card" style="margin-top:15px"><h2 style="margin-top:0">Public copy</h2><label>Tagline<textarea name="tagline">${esc(p.tagline||"")}</textarea></label><label>Launch heading<input name="launchHeading" value="${esc(p.launchHeading||"")}"></label><label>Launch description<textarea name="launchDescription">${esc(p.launchDescription||"")}</textarea></label><label>Ready heading<input name="readyHeading" value="${esc(p.readyHeading||"")}"></label></div>
 <div class="card" style="margin-top:15px"><h2 style="margin-top:0">Required components</h2><label>Required plugin files (one per line)<textarea name="requiredPlugins" rows="7">${esc((p.requiredPlugins||[]).join("\\n"))}</textarea></label><label>Required theme<input name="requiredTheme" value="${esc(p.requiredTheme||"")}"></label></div>
 <div class="actions"><button class="btn">Save Profile</button><a class="btn secondary" href="/manage/setup?step=5">Readiness Checks</a></div>
 </form>`,"profile"));
});
r.post("/profile",(req,res)=>{
 const p=profile.load();
 const clean=v=>String(v||"").trim().replace("https://","").replace("http://","").split("/")[0];
 const plugins=String(req.body.requiredPlugins||"").split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean);
 const theme=String(req.body.requiredTheme||"").trim();
 profile.save({...p,productName:String(req.body.productName||"").trim(),companyName:String(req.body.companyName||"").trim(),homepageUrl:String(req.body.homepageUrl||"").trim(),launcherDomain:clean(req.body.launcherDomain),templateDomain:clean(req.body.templateDomain),tagline:String(req.body.tagline||"").trim(),launchHeading:String(req.body.launchHeading||"").trim(),launchDescription:String(req.body.launchDescription||"").trim(),readyHeading:String(req.body.readyHeading||"").trim(),requiredPlugins:plugins,allowedPlugins:plugins,requiredTheme:theme,allowedThemes:theme?[theme]:[],branding:{...(p.branding||{}),logoUrl:String(req.body.logoUrl||"").trim(),faviconUrl:String(req.body.faviconUrl||"").trim(),accent:String(req.body.accent||"#ffffff").trim()}});
 audit("profile_update",null,"DemoPress product profile updated");
 res.redirect("/manage/profile");
});
r.get("/settings",(req,res)=>{const s=settings.all();res.send(adminPage("Settings",`<h1>Settings</h1><div class="sub">Operational settings; secrets stay in Coolify.</div><form method="post"><div class="formgrid"><label>Idle lifetime<input name="idle_lifetime" value="${esc(s.idle_lifetime)}"></label><label>Maximum lifetime<input name="max_lifetime" value="${esc(s.max_lifetime)}"></label><label>Maximum active demos<input name="max_active_demos" value="${esc(s.max_active_demos)}"></label><label>Failed retention<input name="failed_retention" value="${esc(s.failed_retention)}"></label><label>Maintenance<select name="maintenance_mode"><option value="0" ${s.maintenance_mode==="0"?"selected":""}>Launches enabled</option><option value="1" ${s.maintenance_mode==="1"?"selected":""}>Maintenance</option></select></label></div><div class="actions"><button class="btn">Save</button></div></form>`,"settings"))});r.post("/settings",(req,res)=>{for(const k of ["idle_lifetime","max_lifetime","max_active_demos","failed_retention","maintenance_mode"])if(req.body[k]!=null)settings.set(k,req.body[k]);res.redirect("/manage/settings")});r.use((req,res)=>res.status(404).send(adminPage("Not found",`<div class="crumb"><a href="/manage">← Dashboard</a></div><h1>Page not found.</h1><p class="muted">That DemoPress Manager page does not exist.</p><div class="actions"><a class="btn" href="/manage">Dashboard</a></div>`,"overview")));module.exports=r;
