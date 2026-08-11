const express=require("express");
const config=require("./config");
const db=require("./database");
const snapshots=require("./snapshots");
const provisioner=require("./provisioner");
const docker=require("./docker");
const profile=require("./profile");
const admin=require("./admin");
const {publicPage,esc}=require("./ui");

const app=express();
app.use(express.urlencoded({extended:false}));
app.use(express.json());

function ip(req){
  return (req.headers["x-forwarded-for"]||req.socket.remoteAddress||"")
    .split(",")[0].trim();
}

function auth(req,res,next){
  if(!config.adminPassword)return res.status(503).send("ADMIN_PASSWORD is not configured");
  const h=req.headers.authorization||"";
  if(h.startsWith("Basic ")){
    try{
      const decoded=Buffer.from(h.slice(6),"base64").toString();
      const idx=decoded.indexOf(":");
      const p=idx>=0?decoded.slice(idx+1):"";
      if(p===config.adminPassword)return next();
    }catch(_){}
  }
  res.set("WWW-Authenticate",'Basic realm="DemoPress Manager"')
    .status(401).send("Authentication required");
}

app.get("/",(req,res)=>res.send(publicPage("Live demo",`
<section class="hero">
  <div class="eyebrow">PRIVATE DISPOSABLE WORDPRESS DEMO</div>
  <h1>${esc(profile.launchHeading||`Try ${profile.productName}`)}</h1>
  <p>${esc(profile.launchDescription||"Launch a private disposable clone of our configured WordPress demonstration site.")}</p>
  <div class="actions"><form method="post" action="/launch"><button class="btn">Launch private demo</button></form></div>
</section>
<div class="card"><div class="label">How it works</div><p class="muted">A fresh isolated WordPress site and database are created from the current golden template. Your session expires automatically.</p></div>
`)));

app.post("/launch",(req,res)=>{
  try{
    const d=provisioner.create(ip(req));
    res.redirect(`/demo/${d.id}`);
  }catch(e){
    res.status(503).send(publicPage("Unavailable",`<section class="hero"><h1>Demo unavailable.</h1><p>${esc(e.message)}</p></section>`));
  }
});

app.get("/demo/:id",(req,res)=>{
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(req.params.id);
  if(!d)return res.status(404).send(publicPage("Not found","<section class=hero><h1>Demo not found.</h1></section>"));
  const ready=d.status==="running";
  res.send(publicPage(ready?"Demo ready":"Preparing demo",`
<section class="hero">
  <div class="eyebrow">${esc(d.status)}</div>
  <h1>${ready?"Your demo is ready.":"Building your private demo…"}</h1>
  <p>${esc(d.status_message||"")}</p>
  <div class="actions">${ready?`<a class="btn" href="${esc(d.url)}/?demopress_demo_login=${esc(d.admin_password)}">Open WordPress</a>`:`<a class="btn secondary" href="/demo/${esc(d.id)}">Refresh status</a>`}</div>
</section>
`));
});

app.get("/status",async(req,res)=>{
  let dockerOk=true,imageOk=true;
  try{await docker.ping()}catch(_){dockerOk=false}
  try{await docker.getImage(config.demoImage).inspect()}catch(_){imageOk=false}
  const current=snapshots.current();
  res.send(publicPage("Status",`
<section class="hero"><div class="eyebrow">SYSTEM STATUS</div><h1>${dockerOk&&imageOk&&current?"Operational":"Attention required"}</h1></section>
<div class="grid">
  <div class="card"><div class="label">Docker</div><div class="stat">${dockerOk?"Connected":"Unavailable"}</div></div>
  <div class="card"><div class="label">Runtime image</div><div class="stat">${imageOk?"Available":"Self-build on next launch"}</div></div>
  <div class="card"><div class="label">Template</div><div class="stat">${current?esc(current.version):"Not published"}</div></div>
</div>
`));
});

// One authoritative Manager implementation. All Manager pages, actions,
// diagnostics, analytics, profile/setup and settings live in admin.js.
app.use("/manage",auth,admin);

app.get("/health",(req,res)=>res.json({
  ok:true,
  platform:config.platformVersion,
  instance:config.instanceId,
  snapshot:snapshots.current()?.version||null
}));

app.listen(config.port,()=>{
  console.log(`DemoPress ${config.platformVersion} listening on :${config.port} instance=${config.instanceId}`);
});
