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
function publicStage(stage){
  const s=String(stage||"").toLowerCase();
  if(s.includes("database"))return{title:"Starting secure database",detail:"Creating an isolated database for your private demo."};
  if(s.includes("template"))return{title:"Restoring demo content",detail:"Loading the latest configured demo snapshot."};
  if(s.includes("wordpress"))return{title:"Launching WordPress",detail:"Starting your private WordPress environment."};
  if(s.includes("final"))return{title:"Applying demo configuration",detail:"Personalising the site and preparing your access details."};
  if(s.includes("routing"))return{title:"Securing your access",detail:"Connecting your private demo to its secure URL."};
  if(s.includes("ready"))return{title:"Demo ready",detail:"Your private WordPress demo is ready to use."};
  return{title:"Preparing your demo",detail:"Setting up a private WordPress environment for you."};
}
function publicMessage(d){
  if(d.status==="running")return"Your private WordPress demo is ready to use.";
  if(d.status==="failed")return"We were unable to complete your demo. Please try again.";
  return publicStage(d.provision_stage).detail;
}
function publicEventSummary(events,stage){
  const last=(events||[]).slice(-1)[0];
  if(!last)return publicStage(stage).detail;
  const s=String(last.stage||stage||"").toLowerCase();
  if(s.includes("database"))return"Your isolated database is being prepared.";
  if(s.includes("template"))return"The latest demo content is being restored.";
  if(s.includes("wordpress"))return"WordPress is starting and connecting to your demo data.";
  if(s.includes("final"))return"Your demo settings and access details are being applied.";
  if(s.includes("routing"))return"Your secure demo address is being activated.";
  if(s.includes("ready"))return"Everything is ready.";
  return publicStage(stage).detail;
}
function launchForm(error="",values={}){
  const fields=[];
  if(config.captureName)fields.push(`<label class="capture-field"><span>Name${config.requireName?' *':''}</span><input type="text" name="name" autocomplete="name" maxlength="120" value="${esc(values.name||'')}" ${config.requireName?'required':''} placeholder="Your name"></label>`);
  if(config.captureEmail)fields.push(`<label class="capture-field"><span>Email address${config.requireEmail?' *':''}</span><input type="email" name="email" autocomplete="email" maxlength="254" value="${esc(values.email||'')}" ${config.requireEmail?'required':''} placeholder="you@example.com"></label>`);
  if(config.captureCompany)fields.push(`<label class="capture-field"><span>Company${config.requireCompany?' *':''}</span><input type="text" name="company" autocomplete="organization" maxlength="160" value="${esc(values.company||'')}" ${config.requireCompany?'required':''} placeholder="Company name"></label>`);
  return `<form class="capture-form" method="post" action="/launch">${error?`<div class="capture-error" role="alert">${esc(error)}</div>`:""}${fields.length?`<div class="capture-grid">${fields.join('')}</div><p class="capture-notice">${esc(config.captureNotice)}</p>`:""}<button class="btn" type="submit">Launch private demo →</button></form>`;
}
function launcherPage(error="",values={}){return publicPage("Live demo",`
<section class="hero"><div class="eyebrow">PRIVATE DISPOSABLE WORDPRESS DEMO</div><h1>${esc(profile.launchHeading||`Try ${profile.productName}`)}</h1><p>${esc(profile.launchDescription||"Launch a private disposable clone of our configured WordPress demonstration site.")}</p><div class="actions">${launchForm(error,values)}</div></section>
<div class="grid"><div class="card"><div class="label">01 · Isolated</div><h2>Private environment</h2><p class="muted">A separate WordPress site and database are created just for your session.</p></div><div class="card"><div class="label">02 · Ready-made</div><h2>Real product setup</h2><p class="muted">Your demo starts from the current configured golden template, not an empty WordPress install.</p></div><div class="card"><div class="label">03 · Disposable</div><h2>Safe to explore</h2><p class="muted">Make changes freely. DemoPress automatically removes the environment when its session expires.</p></div></div>
`);}

app.get("/",(req,res)=>res.send(launcherPage()));
app.post("/launch",(req,res)=>{
  const values={name:String(req.body.name||"").trim(),email:String(req.body.email||"").trim(),company:String(req.body.company||"").trim()};
  if(config.requireName&&!values.name)return res.status(400).send(launcherPage("Please enter your name.",values));
  if(config.requireEmail&&!values.email)return res.status(400).send(launcherPage("Please enter your email address.",values));
  if(config.captureEmail&&values.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))return res.status(400).send(launcherPage("Please enter a valid email address.",values));
  if(config.requireCompany&&!values.company)return res.status(400).send(launcherPage("Please enter your company name.",values));
  try{const d=provisioner.create(ip(req),{visitor:values});res.redirect(`/demo/${d.id}`);}catch(e){res.status(503).send(publicPage("Unavailable",`<section class="hero"><h1>Demo unavailable.</h1><p>${esc(e.message)}</p><div class="actions"><a class="btn secondary" href="/">Return to launcher</a></div></section>`));}
});

app.get("/demo/:id/status.json",(req,res)=>{
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);if(!d)return res.status(404).json({error:"Demo not found"});
  const events=publicEvents(d.id),stage=publicStage(d.provision_stage);
  res.json({id:d.id,status:d.status,stage:d.provision_stage||"queued",stageTitle:stage.title,message:publicMessage(d),eventSummary:publicEventSummary(events,d.provision_stage),url:d.url||"",username:d.admin_user||"",password:d.admin_password||"",oneClick:d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"",expiresAt:d.expires_at||0,error:d.error_message||"",events,progress:Math.min(100,Math.max(8,(stageIndex(d.provision_stage)+1)*17)),emailSent:Boolean(d.email_sent_at)});
});

app.get("/demo/:id",(req,res)=>{
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);if(!d)return res.status(404).send(publicPage("Not found","<section class=hero><h1>Demo not found.</h1></section>"));
  const ready=d.status==="running",failed=d.status==="failed",idx=stageIndex(d.provision_stage),oneClick=d.url&&d.admin_password?`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`:"",stage=publicStage(d.provision_stage),events=publicEvents(d.id);
  const stages=["Database","Content","WordPress","Configuration","Secure access"];
  res.send(publicPage(ready?"Demo ready":failed?"Demo failed":"Preparing demo",`
<section class="hero" style="padding-bottom:24px"><div class="eyebrow" id="status-label">${ready?'DEMO READY':failed?'PROVISIONING FAILED':'PREPARING YOUR PRIVATE DEMO'}</div><h1 id="headline">${ready?'Your demo is ready.':failed?'We could not complete this demo.':'Preparing your demo…'}</h1><p id="message">${esc(publicMessage(d))}</p></section>
<div id="progress-card" class="card" ${ready||failed?'style="display:none"':''}><div class="kpirow"><div><div class="label">Setup progress</div><h2 id="stage-title" style="margin:6px 0">${esc(stage.title)}</h2></div><span class="live-dot"><i></i> Live</span></div><div class="progress-shell"><div id="progress" class="progress-fill" style="width:${Math.min(100,Math.max(8,(idx+1)*17))}%"></div></div><div class="steps">${stages.map((s,i)=>`<div id="step-${i}" class="step ${i<idx?'done':i===idx?'active':''}">${s}</div>`).join('')}</div><div id="event-summary" class="muted">${esc(publicEventSummary(events,d.provision_stage))}</div></div>
<div id="ready-card" class="card" ${ready?'':'style="display:none"'}><div class="kpirow"><div><div class="label">Access details</div><h2 style="margin:6px 0">Your private WordPress demo</h2></div><span class="live-dot"><i></i> Ready</span></div><div class="credential-grid"><div class="credential"><span>Demo URL</span><code id="url">${esc(d.url||'')}</code><button onclick="copyField('url')">Copy URL</button></div><div class="credential"><span>Username</span><code id="username">${esc(d.admin_user||'')}</code><button onclick="copyField('username')">Copy</button></div><div class="credential"><span>Password</span><code id="password">${esc(d.admin_password||'')}</code><button onclick="copyField('password')">Copy</button></div></div><div class="actions" style="margin-top:18px"><a id="admin-link" class="btn" target="_blank" rel="noopener" href="${esc(oneClick||'#')}">Open WordPress Admin →</a><a id="site-link" class="btn secondary" target="_blank" rel="noopener" href="${esc(d.url||'#')}">View Demo Site</a></div>${d.visitor_email&&config.resendEnabled?`<p id="email-note" class="muted" style="margin-bottom:0">${d.email_sent_at?`A copy of these details has been emailed to ${esc(d.visitor_email)}.`:`We’ll also email these details to ${esc(d.visitor_email)}.`}</p>`:''}<p class="muted" style="margin-bottom:0">This is a temporary private environment. <span id="expiry">${d.expires_at?`It is scheduled to expire ${new Date(d.expires_at*1000).toLocaleString()}.`:''}</span></p></div>
<div id="failed-card" class="card" ${failed?'':'style="display:none"'}><div class="label">Setup issue</div><h2>We could not complete your demo</h2><p id="error" class="muted">${esc(d.error_message||'Please try launching another demo.')}</p><div class="actions"><a class="btn" href="/">Try again</a></div></div>
<script>
const id=${JSON.stringify(d.id)},stages=['database','template','wordpress','finalising','routing'];
function copyField(x){navigator.clipboard.writeText(document.getElementById(x).textContent||'');}
function render(x){
 const ready=x.status==='running',failed=x.status==='failed';document.getElementById('message').textContent=x.message||'';
 document.getElementById('progress-card').style.display=ready||failed?'none':'';document.getElementById('ready-card').style.display=ready?'':'none';document.getElementById('failed-card').style.display=failed?'':'none';
 if(ready){document.getElementById('status-label').textContent='DEMO READY';document.getElementById('headline').textContent='Your demo is ready.';document.getElementById('url').textContent=x.url;document.getElementById('username').textContent=x.username;document.getElementById('password').textContent=x.password;document.getElementById('admin-link').href=x.oneClick;document.getElementById('site-link').href=x.url;if(x.expiresAt)document.getElementById('expiry').textContent='It is scheduled to expire '+new Date(x.expiresAt*1000).toLocaleString()+'.';}
 else if(failed){document.getElementById('status-label').textContent='PROVISIONING FAILED';document.getElementById('headline').textContent='We could not complete this demo.';document.getElementById('error').textContent=x.error||'Please try again.';}
 else{document.getElementById('stage-title').textContent=x.stageTitle||'Preparing your demo';document.getElementById('progress').style.width=x.progress+'%';const s=String(x.stage||'').toLowerCase(),idx=Math.max(0,stages.findIndex(v=>s.includes(v)));for(let i=0;i<5;i++){document.getElementById('step-'+i).className='step '+(i<idx?'done':i===idx?'active':'');}document.getElementById('event-summary').textContent=x.eventSummary||'Preparing your private demo…';}
 return ready||failed;
}
async function poll(){try{const r=await fetch('/demo/'+encodeURIComponent(id)+'/status.json',{cache:'no-store'});if(r.ok){const done=render(await r.json());if(done)return;}}catch(_){}setTimeout(poll,2000);}poll();
</script>
`));
});

app.get("/status",async(req,res)=>{let dockerOk=true,imageOk=true;try{await docker.ping()}catch(_){dockerOk=false}try{await docker.getImage(config.demoImage).inspect()}catch(_){imageOk=false}const current=snapshots.current();res.send(publicPage("Status",`<section class="hero"><div class="eyebrow">SYSTEM STATUS</div><h1>${dockerOk&&imageOk&&current?"Operational":"Attention required"}</h1></section><div class="grid"><div class="card"><div class="label">Docker</div><div class="stat">${dockerOk?"Connected":"Unavailable"}</div></div><div class="card"><div class="label">Runtime image</div><div class="stat">${imageOk?"Available":"Unavailable"}</div></div><div class="card"><div class="label">Template</div><div class="stat">${current?esc(current.version):"Not published"}</div></div></div>`));});

app.use("/manage",auth,adminDemo);
app.use("/manage",auth,admin);
app.get("/health",(req,res)=>res.json({ok:true,platform:config.platformVersion,instance:config.instanceId,snapshot:snapshots.current()?.version||null}));
app.listen(config.port,()=>console.log(`DemoPress ${config.platformVersion} listening on :${config.port} instance=${config.instanceId}`));
