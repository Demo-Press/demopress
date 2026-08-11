const express=require("express");
const config=require("./config");
const db=require("./database");
const snapshots=require("./snapshots");
const provisioner=require("./provisioner");
const docker=require("./docker");
const profile=require("./profile");
const adminDemo=require("./admin-demo");
const admin=require("./admin");
const {publicPage,esc}=require("./ui");

const app=express();
app.use(express.urlencoded({extended:false}));
app.use(express.json());

function ip(req){return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();}
function auth(req,res,next){
  if(!config.adminPassword)return res.status(503).send("ADMIN_PASSWORD is not configured");
  const h=req.headers.authorization||"";
  if(h.startsWith("Basic "))try{const decoded=Buffer.from(h.slice(6),"base64").toString(),idx=decoded.indexOf(":"),p=idx>=0?decoded.slice(idx+1):"";if(p===config.adminPassword)return next();}catch(_){}
  res.set("WWW-Authenticate",'Basic realm="DemoPress Manager"').status(401).send("Authentication required");
}
function publicEvents(id){
  try{return db.prepare("SELECT created_at_ms,stage,level,message FROM provisioning_events WHERE demo_id=? ORDER BY id DESC LIMIT 8").all(id).reverse();}
  catch(_){return db.prepare("SELECT created_at_ms,stage,level,message FROM events WHERE demo_id=? ORDER BY id DESC LIMIT 8").all(id).reverse();}
}
function stageIndex(stage){const stages=["database","template","wordpress","finalising","routing","ready"];const s=String(stage||"").toLowerCase();const i=stages.findIndex(x=>s.includes(x));return i<0?0:i;}

app.get("/",(req,res)=>res.send(publicPage("Live demo",`
<section class="hero"><div class="eyebrow">PRIVATE DISPOSABLE WORDPRESS DEMO</div><h1>${esc(profile.launchHeading||`Try ${profile.productName}`)}</h1><p>${esc(profile.launchDescription||"Launch a private disposable clone of our configured WordPress demonstration site.")}</p><div class="actions"><form method="post" action="/launch"><button class="btn">Launch private demo →</button></form></div></section>
<div class="grid"><div class="card"><div class="label">01 · Isolated</div><h2>Private environment</h2><p class="muted">A separate WordPress site and database are created just for your session.</p></div><div class="card"><div class="label">02 · Ready-made</div><h2>Real product setup</h2><p class="muted">Your demo starts from the current configured golden template, not an empty WordPress install.</p></div><div class="card"><div class="label">03 · Disposable</div><h2>Safe to explore</h2><p class="muted">Make changes freely. DemoPress automatically removes the environment when its session expires.</p></div></div>
`)));

app.post("/launch",(req,res)=>{try{const d=provisioner.create(ip(req));res.redirect(`/demo/${d.id}`);}catch(e){res.status(503).send(publicPage("Unavailable",`<section class="hero"><h1>Demo unavailable.</h1><p>${esc(e.message)}</p></section>`));}});

app.get("/demo/:id/status.json",(req,res)=>{
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);if(!d)return res.status(404).json({error:"Demo not found"});
  res.json({id:d.id,status:d.status,stage:d.provision_stage||"queued",message:d.status_message||"",url:d.url||"",username:d.admin_user||"",password:d.admin_password||"",oneClick:d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"",expiresAt:d.expires_at||0,error:d.error_message||"",events:publicEvents(d.id),progress:Math.min(100,Math.max(8,(stageIndex(d.provision_stage)+1)*17))});
});

app.get("/demo/:id",(req,res)=>{
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);if(!d)return res.status(404).send(publicPage("Not found","<section class=hero><h1>Demo not found.</h1></section>"));
  const ready=d.status==="running",failed=d.status==="failed",idx=stageIndex(d.provision_stage),oneClick=d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"";
  const stages=["Database","Snapshot","WordPress","Personalise","Secure URL"];
  res.send(publicPage(ready?"Demo ready":failed?"Demo failed":"Preparing demo",`
<section class="hero" style="padding-bottom:24px"><div class="eyebrow" id="status-label">${ready?'DEMO READY':failed?'PROVISIONING FAILED':'BUILDING YOUR PRIVATE DEMO'}</div><h1 id="headline">${ready?'Your demo is ready.':failed?'We could not build this demo.':'Creating your workspace…'}</h1><p id="message">${esc(d.status_message||'Preparing an isolated WordPress environment. This page updates automatically.')}</p></section>
<div id="progress-card" class="card" ${ready||failed?'style="display:none"':''}><div class="kpirow"><div><div class="label">Provisioning progress</div><h2 id="stage-title" style="margin:6px 0">${esc(d.provision_stage||'Queued')}</h2></div><span class="live-dot"><i></i> Live</span></div><div class="progress-shell"><div id="progress" class="progress-fill" style="width:${Math.min(100,Math.max(8,(idx+1)*17))}%"></div></div><div class="steps">${stages.map((s,i)=>`<div id="step-${i}" class="step ${i<idx?'done':i===idx?'active':''}">${s}</div>`).join('')}</div><div id="event-summary" class="muted">Watching the provisioning service for updates…</div></div>
<div id="ready-card" class="card" ${ready?'':'style="display:none"'}><div class="kpirow"><div><div class="label">Access details</div><h2 style="margin:6px 0">Your private WordPress demo</h2></div><span class="live-dot"><i></i> Ready</span></div><div class="credential-grid"><div class="credential"><span>Demo URL</span><code id="url">${esc(d.url||'')}</code><button onclick="copyField('url')">Copy URL</button></div><div class="credential"><span>Username</span><code id="username">${esc(d.admin_user||'')}</code><button onclick="copyField('username')">Copy</button></div><div class="credential"><span>Password</span><code id="password">${esc(d.admin_password||'')}</code><button onclick="copyField('password')">Copy</button></div></div><div class="actions" style="margin-top:18px"><a id="admin-link" class="btn" target="_blank" rel="noopener" href="${esc(oneClick||'#')}">Open WordPress Admin →</a><a id="site-link" class="btn secondary" target="_blank" rel="noopener" href="${esc(d.url||'#')}">View Demo Site</a></div><p class="muted" style="margin-bottom:0">This environment is temporary. <span id="expiry">${d.expires_at?`It currently expires ${new Date(d.expires_at*1000).toLocaleString()}.`:''}</span></p></div>
<div id="failed-card" class="card" ${failed?'':'style="display:none"'}><div class="label">Something went wrong</div><h2>Provisioning stopped</h2><p id="error" class="muted">${esc(d.error_message||'Please try launching another demo.')}</p><div class="actions"><a class="btn" href="/">Try again</a></div></div>
<script>
const id=${JSON.stringify(d.id)},stages=['database','template','wordpress','finalising','routing'];
function copyField(x){navigator.clipboard.writeText(document.getElementById(x).textContent||'');}
function render(x){
 const ready=x.status==='running',failed=x.status==='failed';document.getElementById('message').textContent=x.message||'';
 document.getElementById('progress-card').style.display=ready||failed?'none':'';document.getElementById('ready-card').style.display=ready?'':'none';document.getElementById('failed-card').style.display=failed?'':'none';
 if(ready){document.getElementById('status-label').textContent='DEMO READY';document.getElementById('headline').textContent='Your demo is ready.';document.getElementById('url').textContent=x.url;document.getElementById('username').textContent=x.username;document.getElementById('password').textContent=x.password;document.getElementById('admin-link').href=x.oneClick;document.getElementById('site-link').href=x.url;if(x.expiresAt)document.getElementById('expiry').textContent='It currently expires '+new Date(x.expiresAt*1000).toLocaleString()+'.';}
 else if(failed){document.getElementById('status-label').textContent='PROVISIONING FAILED';document.getElementById('headline').textContent='We could not build this demo.';document.getElementById('error').textContent=x.error||x.message||'Please try again.';}
 else{document.getElementById('stage-title').textContent=x.stage||'Queued';document.getElementById('progress').style.width=x.progress+'%';const s=String(x.stage||'').toLowerCase(),idx=Math.max(0,stages.findIndex(v=>s.includes(v)));for(let i=0;i<5;i++){document.getElementById('step-'+i).className='step '+(i<idx?'done':i===idx?'active':'');}const last=(x.events||[]).slice(-1)[0];document.getElementById('event-summary').textContent=last?last.message:'Waiting for provisioning updates…';}
 return ready||failed;
}
async function poll(){try{const r=await fetch('/demo/'+encodeURIComponent(id)+'/status.json',{cache:'no-store'});if(r.ok){const done=render(await r.json());if(done)return;}}catch(_){}setTimeout(poll,2000);}poll();
</script>
`));
});

app.get("/status",async(req,res)=>{let dockerOk=true,imageOk=true;try{await docker.ping()}catch(_){dockerOk=false}try{await docker.getImage(config.demoImage).inspect()}catch(_){imageOk=false}const current=snapshots.current();res.send(publicPage("Status",`<section class="hero"><div class="eyebrow">SYSTEM STATUS</div><h1>${dockerOk&&imageOk&&current?"Operational":"Attention required"}</h1></section><div class="grid"><div class="card"><div class="label">Docker</div><div class="stat">${dockerOk?"Connected":"Unavailable"}</div></div><div class="card"><div class="label">Runtime image</div><div class="stat">${imageOk?"Available":"Unavailable"}</div></div><div class="card"><div class="label">Template</div><div class="stat">${current?esc(current.version):"Not published"}</div></div></div>`));});

// Focused demo detail router is mounted first so its richer live detail route wins.
app.use("/manage",auth,adminDemo);
app.use("/manage",auth,admin);
app.get("/health",(req,res)=>res.json({ok:true,platform:config.platformVersion,instance:config.instanceId,snapshot:snapshots.current()?.version||null}));
app.listen(config.port,()=>console.log(`DemoPress ${config.platformVersion} listening on :${config.port} instance=${config.instanceId}`));
