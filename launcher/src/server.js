const profile=require("./profile");const express=require("express");
const db=require("./database");
const docker=require("./docker");
const config=require("./config");
const auth=require("./auth");
const admin=require("./admin");
const demoApi=require("./demo-api");
const provisioner=require("./provisioner");
const rate=require("./rate-limit");
const settings=require("./settings");
const snapshots=require("./snapshots");
const {publicPage}=require("./ui");
const {esc}=require("./helpers");
require("./lifecycle");

const app=express();
app.disable("x-powered-by");
app.use(express.json({limit:"32kb"}));
app.use(express.urlencoded({extended:false}));

app.use((req,res,next)=>{
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("X-Frame-Options","SAMEORIGIN");
  res.setHeader("Cross-Origin-Opener-Policy","same-origin");
  res.setHeader("Cross-Origin-Resource-Policy","same-origin");
  res.setHeader("Content-Security-Policy","default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");
  if(req.secure||String(req.headers["x-forwarded-proto"]||"").split(",")[0].trim()==="https"){
    res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");
  }
  if(req.path.startsWith("/manage")||req.path.startsWith("/demo/")||req.path.startsWith("/api/demo-tools")){
    res.setHeader("Cache-Control","no-store, max-age=0");
    res.setHeader("Pragma","no-cache");
  }
  next();
});


async function healthState(){
  let dockerOk=true;
  let imageOk=true;
  try{await docker.ping();}catch(_){dockerOk=false;}
  try{await docker.getImage(config.demoImage).inspect();}catch(_){imageOk=false;}

  const snapshot=snapshots.current();
  const active=db.prepare(
    "SELECT COUNT(*) c FROM demos WHERE status IN ('queued','provisioning','running','resetting')"
  ).get().c;
  const failed=db.prepare(
    "SELECT COUNT(*) c FROM demos WHERE status='failed'"
  ).get().c;

  return {
    ok:dockerOk && imageOk && !!snapshot,
    dockerOk,
    imageOk,
    snapshot,
    active,
    failed,
    max:settings.number("max_active_demos",config.maxDemos),
    maintenance:settings.get("maintenance_mode","0")==="1"
  };
}

app.get("/api/health",async(req,res)=>{
  const h=await healthState();
  res.status(h.ok?200:503).json({
    status:h.ok?"operational":"degraded",
    docker:h.dockerOk?"connected":"unavailable",
    demoImage:h.imageOk?"ready":"missing",
    snapshot:h.snapshot?h.snapshot.version:null,
    activeDemos:h.active,
    capacity:h.max,
    failedDemos:h.failed,
    maintenance:h.maintenance,
    time:new Date().toISOString()
  });
});

app.get("/health",async(req,res)=>{
  const h=await healthState();
  const title=h.maintenance?"Maintenance":h.ok?"All systems operational":"Service attention required";
  res.status(h.ok||h.maintenance?200:503).send(publicPage(
    "DemoPress Demo Status",
    `<section class="hero">
       <div class="eyebrow">Platform status</div>
       <h1>${title}.</h1>
       <p>Live status for the DemoPress disposable demo platform.</p>
       <div class="actions"><a class="btn secondary" href="/">← Back to Demo</a></div>
     </section>
     <div class="grid">
       <div class="card"><div class="label">Launcher</div><div class="stat success">Online</div><p class="muted">The public demo service is responding.</p></div>
       <div class="card"><div class="label">Docker</div><div class="stat ${h.dockerOk?"success":"danger"}">${h.dockerOk?"Connected":"Unavailable"}</div><p class="muted">Disposable container provisioning.</p></div>
       <div class="card"><div class="label">Demo image</div><div class="stat ${h.imageOk?"success":"danger"}">${h.imageOk?"Ready":"Missing"}</div><p class="muted">${esc(config.demoImage)}</p></div>
     </div>
     <div class="grid" style="margin-top:15px">
       <div class="card"><div class="label">Golden template</div><div class="stat ${h.snapshot?"success":"danger"}">${h.snapshot?"Published":"Missing"}</div><p class="muted">${h.snapshot?esc(h.snapshot.version):"No current snapshot"}</p></div>
       <div class="card"><div class="label">Demo capacity</div><div class="stat">${h.active} / ${h.max}</div><p class="muted">${Math.max(0,h.max-h.active)} slots currently available.</p></div>
       <div class="card"><div class="label">Launch mode</div><div class="stat ${h.maintenance?"warn":"success"}">${h.maintenance?"Maintenance":"Available"}</div><p class="muted">${h.failed} failed demo record${h.failed===1?"":"s"} retained.</p></div>
     </div>
     <div class="notice" style="margin-top:18px">Status last checked ${new Date().toLocaleString()}. Machine-readable health is available at <code>/api/health</code>.</div>`
  ));
});

app.use("/api/demo-tools",demoApi);

app.get("/",async(req,res)=>{
  if(!profile.configured()){
    return res.status(503).send(publicPage("DemoPress setup required",`<section class="hero"><div class="eyebrow">DemoPress ${esc(config.buildVersion)}</div><h1>DemoPress needs to be configured.</h1><p>The platform is installed, but the product profile and real domains have not been configured yet.</p><div class="actions"><a class="btn" href="/manage/setup">Open Setup Wizard</a><a class="btn secondary" href="https://demopress.co.uk">DemoPress</a></div></section>`));
  }

  const maintenance=settings.get("maintenance_mode","0")==="1";
  const snap=snapshots.current();
  const active=db.prepare("SELECT COUNT(*) c FROM demos WHERE status IN ('queued','provisioning','running','resetting')").get().c;
  const max=settings.number("max_active_demos",config.maxDemos);
  const available=Math.max(0,max-active);
  res.send(publicPage(
    "Live Demo",
    `<section class="hero">
       <div class="eyebrow">${esc(profile.productName)} · live demo</div>
       <h1>${esc(profile.launchHeading||"Try the live demo")}</h1>
       <p>${esc(profile.launchDescription||profile.tagline)}</p>
       ${maintenance
         ? '<div class="notice">Demo maintenance is currently active.</div>'
         : !snap
           ? '<div class="notice">The demo template has not been published yet.</div>'
           : '<form method="post" action="/launch"><div class="actions"><button class="btn">Launch Live Demo →</button><a class="btn secondary" href="/health">Platform Status</a></div></form>'}
     </section>
     <div class="grid">
       <div class="card"><h3>Preconfigured</h3><p class="muted">Start with a complete copy of the vendor-configured WordPress template instead of an empty install.</p></div>
       <div class="card"><h3>Controlled sandbox</h3><p class="muted">The demo user can explore the configured product without changing the platform itself.</p></div>
       <div class="card"><h3>Disposable</h3><p class="muted">Reset at any time or let the environment expire automatically.</p></div><div class="card"><h3>Live capacity</h3><p class="muted"><strong>${available}</strong> of ${max} demo slots currently available.</p></div>
     </div>`
  ));
});

app.post("/launch",(req,res)=>{
  try{
    const ip=rate.check(req);
    const d=provisioner.create(ip);
    res.redirect(`/demo/${d.id}`);
  }catch(e){
    res.status(429).send(publicPage(
      "Unable to launch",
      `<section class="hero"><h1>Demo unavailable.</h1><p>We couldn\'t start a demo right now. Please try again shortly.</p><div class="actions"><a class="btn" href="/">Back</a><a class="btn secondary" href="/health">Platform Status</a></div></section>`
    ));
  }
});

app.get("/demo/:id",(req,res)=>{
 const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);if(!d)return res.status(404).send(publicPage("Demo not found",`<section class="hero"><h1>Demo not found.</h1><p>This temporary demo does not exist or has already expired.</p><div class="actions"><a class="btn" href="/">Launch a Demo</a></div></section>`));
 if(d.status==="running")return res.send(publicPage("Your Demo",`<section class="hero"><div class="eyebrow">Demo ready</div><h1>${esc(profile.readyHeading||'Your demo is ready.')}</h1><p>Your private WordPress environment is ready to explore. Changes are temporary and will be removed automatically.</p><div class="actions"><a class="btn" href="${esc(d.url)}" target="_blank" rel="noopener">Open Demo</a><button class="btn secondary" onclick="login()">Open WordPress Admin</button><button class="btn secondary" onclick="copyDemoUrl()">Copy Demo URL</button></div></section><div class="grid"><div class="card"><div class="label">Username</div><div class="value">${esc(d.admin_user)}</div></div><div class="card"><div class="label">Password</div><div class="value" id="demo-password">••••••••••••••••</div><div class="actions"><button class="btn mini secondary" onclick="revealPassword()">Reveal</button><button class="btn mini secondary" onclick="copyPassword()">Copy</button></div></div><div class="card"><div class="label">Time remaining</div><div class="stat" id="countdown">—</div><p class="muted">Health: ${esc(d.health_status||"healthy")}</p><p class="muted">Expires ${new Date(d.expires_at*1000).toLocaleString()}</p></div></div><h2>Try these next</h2><div class="grid">${(profile.dashboardTips||[]).slice(0,3).map((tip,i)=>`<div class="card"><h3>${i+1}. Explore</h3><p class="muted">${esc(tip)}</p></div>`).join("")}</div><div class="notice" id="expiry-note" style="margin-top:16px">This is an isolated temporary WordPress installation. Anything you change will be automatically deleted when the demo expires.</div><script>const demoPassword=${JSON.stringify(d.admin_password)},expiresAt=${d.expires_at*1000};async function login(){const r=await fetch('/api/demo-tools/login-token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({demo:'${esc(d.id)}'})});const x=await r.json();if(x.url)location.href=x.url;else alert('One-click login is unavailable. Use the credentials shown here.')}function revealPassword(){document.getElementById('demo-password').textContent=demoPassword}async function copyPassword(){try{await navigator.clipboard.writeText(demoPassword)}catch(e){revealPassword()}}async function copyDemoUrl(){try{await navigator.clipboard.writeText(${JSON.stringify(d.url)})}catch(e){}}function tick(){const left=Math.max(0,expiresAt-Date.now()),m=Math.floor(left/60000),h=Math.floor(m/60),mm=m%60;document.getElementById('countdown').textContent=h?(h+'h '+mm+'m'):(mm+'m');if(left<=600000)document.getElementById('expiry-note').textContent='Your demo expires in under 10 minutes. Finish anything you would like to test before it is automatically removed.'}tick();setInterval(tick,30000)</script>`));
 if(d.status==="failed")return res.status(500).send(publicPage("Demo setup issue",`<section class="hero"><div class="eyebrow">Setup issue</div><h1>We couldn't finish preparing your demo.</h1><p>Something went wrong while setting up the temporary WordPress environment. You can safely try again.</p><div class="actions"><a class="btn" href="/">Try Again</a><a class="btn secondary" href="/health">Platform Status</a></div></section><div class="notice">Support reference: <strong>${esc(d.id)}</strong><br><span class="muted">No technical details are exposed on the public page; diagnostics remain available to the demo manager.</span></div>`));
 const stages=["queued","database","template","wordpress","finalising","routing"],labels={queued:"Demo reserved",database:"Preparing database",template:"Loading golden template",wordpress:"Starting WordPress",finalising:"Personalising your site",routing:"Connecting secure demo URL"},current=Math.max(0,stages.indexOf(d.provision_stage)),pct=Math.max(5,Math.round(((current+1)/stages.length)*100));
 return res.send(publicPage("Preparing your demo",`<section class="hero"><div class="eyebrow">Private demo provisioning</div><h1>Preparing your demo.</h1><p id="m">${esc(d.status_message)}</p><div class="progress"><div id="progress" style="width:${pct}%"></div></div><div class="kpirow"><span class="muted">Elapsed <strong id="elapsed">00:00</strong></span><span class="badge">Usually ready in 1–2 minutes</span></div></section><div class="steps">${stages.map((st,i)=>`<div class="step ${i<current?"done":i===current?"active":""}"><span class="stepdot">${i<current?"✓":i+1}</span><span>${labels[st]}</span></div>`).join("")}</div><div class="notice tips" id="tip">This page will continue automatically when your private demo is ready.</div><script>const started=${(d.provision_started_at||d.created_at)*1000},stages=${JSON.stringify(stages)},labels=${JSON.stringify(labels)},tips=['Your configured WordPress template and required components are being prepared.','Your demo is isolated from other visitors and automatically expires.','When ready, you can open either the storefront or WordPress Admin.','The template is cloned fresh for every launch, so you can safely experiment.'];let tip=0;function timer(){const sec=Math.floor((Date.now()-started)/1000);document.getElementById('elapsed').textContent=String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}function render(stage,msg){const ix=Math.max(0,stages.indexOf(stage));document.getElementById('m').textContent=msg||labels[stage]||'Preparing';document.getElementById('progress').style.width=Math.max(5,Math.round(((ix+1)/stages.length)*100))+'%';document.querySelectorAll('.step').forEach((el,i)=>{el.className='step '+(i<ix?'done':i===ix?'active':'');el.querySelector('.stepdot').textContent=i<ix?'✓':i+1})}async function poll(){try{const r=await fetch('/api/demo/${esc(d.id)}/status',{cache:'no-store'}),x=await r.json();if(x.status==='running'||x.status==='failed')return location.reload();render(x.provision_stage,x.status_message);setTimeout(poll,1500)}catch(e){setTimeout(poll,3000)}}timer();setInterval(timer,1000);setInterval(()=>{tip=(tip+1)%tips.length;document.getElementById('tip').textContent=tips[tip]},8000);setTimeout(poll,800)</script>`));
});

app.get("/api/demo/:id/status",(req,res)=>{res.set("Cache-Control","no-store");
  const d=db.prepare("SELECT status,status_message,provision_stage,provision_started_at,database_ms,import_ms,wordpress_ms,finalise_ms,routing_ms FROM demos WHERE id=?").get(req.params.id);
  d?res.json(d):res.status(404).json({error:"not found"});
});

app.use("/manage",auth,admin);
app.use((req,res)=>res.status(404).send(publicPage("Not found",`<section class="hero"><div class="eyebrow">DemoPress</div><h1>Page not found.</h1><p>The page you requested does not exist.</p><div class="actions"><a class="btn" href="/">Demo Launcher</a><a class="btn secondary" href="/health">Platform Status</a></div></section>`)));
app.listen(3000,()=>console.log(`DemoPress ${config.buildVersion || config.platformVersion} listening on :3000`));
