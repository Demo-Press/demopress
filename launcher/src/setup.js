const express=require("express");
const dns=require("dns").promises;
const profile=require("./profile");
const config=require("./config");
const snapshots=require("./snapshots");
const {adminPage}=require("./ui");
const {esc}=require("./helpers");
const r=express.Router();

function cleanHost(value){
 return String(value||"").trim().replace("https://","").replace("http://","").split("/")[0];
}
async function resolveHost(host){
 try{
  const rows=await dns.lookup(host,{all:true});
  return {ok:rows.length>0,addresses:[...new Set(rows.map(x=>x.address))]};
 }catch(e){return {ok:false,addresses:[],error:e.code||e.message}}
}
async function readiness(){
 const p=profile.load();
 const launcher=await resolveHost(p.launcherDomain);
 const template=await resolveHost(p.templateDomain);
 const wildcard=await resolveHost(`demopress-check-${Date.now()}.${p.launcherDomain}`);
 let templateApi={ok:false,error:"not checked"};
 try{const x=await snapshots.status();templateApi={ok:Boolean(x&&x.ok),data:x}}
 catch(e){templateApi={ok:false,error:e.message}}
 return {profile:p,launcher,template,wildcard,templateApi};
}
function checksHtml(x){
 const row=(name,v,detail)=>`<tr><td><strong>${esc(name)}</strong></td><td class="${v.ok?"success":"danger"}">${v.ok?"Ready":"Needs attention"}</td><td>${esc(detail||v.error||"")}</td></tr>`;
 return `<div class="tablewrap"><table><tr><th>Check</th><th>Status</th><th>Details</th></tr>
 ${row("Launcher DNS",x.launcher,(x.launcher.addresses||[]).join(", "))}
 ${row("Wildcard DNS",x.wildcard,(x.wildcard.addresses||[]).join(", "))}
 ${row("Template DNS",x.template,(x.template.addresses||[]).join(", "))}
 ${row("DemoPress Agent",x.templateApi,x.templateApi.ok?"Connected":x.templateApi.error)}
 </table></div>`;
}
function go(res,n){res.redirect(`/manage/setup?step=${n}`)}

r.get("/",async(req,res)=>{
 const p=profile.load();
 const step=Math.max(1,Math.min(6,Number(req.query.step||1)));

 if(step===1)return res.send(adminPage("Setup",`
  <div class="eyebrow">DemoPress ${esc(config.buildVersion)}</div>
  <h1>Welcome to DemoPress.</h1><div class="sub">Configure your demo platform in six steps.</div>
  <div class="progress"><div style="width:16%"></div></div>
  <form method="post" action="/manage/setup/product" class="card">
   <h2 style="margin-top:0">1. Product</h2>
   <div class="formgrid">
    <label>Product name<input name="productName" required value="${esc(p.productName)}"></label>
    <label>Company name<input name="companyName" value="${esc(p.companyName)}"></label>
    <label>Website<input name="homepageUrl" value="${esc(p.homepageUrl)}"></label>
    <label>Platform name<input name="platformName" value="${esc(p.platformName||"DemoPress")}"></label>
   </div>
   <label>Tagline<textarea name="tagline">${esc(p.tagline||"")}</textarea></label>
   <div class="actions"><button class="btn">Save & Continue</button></div>
  </form>`,"setup"));

 if(step===2)return res.send(adminPage("Setup",`
  <h1>Domains</h1><div class="sub">Configure launcher/wildcard and golden-template hosts.</div>
  <div class="progress"><div style="width:33%"></div></div>
  <form method="post" action="/manage/setup/domains" class="card">
   <div class="formgrid">
    <label>Launcher / wildcard base<input name="launcherDomain" required value="${esc(p.launcherDomain)}" placeholder="demo.example.com"><span class="muted">Disposable hosts: demo-xxxxxxxx.${esc(p.launcherDomain)}</span></label>
    <label>Golden template<input name="templateDomain" required value="${esc(p.templateDomain)}" placeholder="template.demo.example.com"></label>
   </div>
   <div class="notice">Create records for the launcher, <strong>*.${esc(p.launcherDomain)}</strong>, and the template host.</div>
   <div class="actions"><button class="btn">Save & Continue</button><a class="btn secondary" href="/manage/setup?step=1">Back</a></div>
  </form>`,"setup"));

 if(step===3)return res.send(adminPage("Setup",`
  <h1>Branding</h1><div class="sub">White-label the visitor-facing demo experience.</div>
  <div class="progress"><div style="width:50%"></div></div>
  <form method="post" action="/manage/setup/branding" class="card">
   <div class="formgrid">
    <label>Logo URL<input name="logoUrl" value="${esc((p.branding||{}).logoUrl||"")}"></label>
    <label>Favicon URL<input name="faviconUrl" value="${esc((p.branding||{}).faviconUrl||"")}"></label>
    <label>Accent<input type="color" name="accent" value="${esc((p.branding||{}).accent||"#ffffff")}"></label>
    <label>Footer text<input name="footerText" value="${esc((p.branding||{}).footerText||"Powered by DemoPress")}"></label>
   </div>
   <label>Launch heading<input name="launchHeading" value="${esc(p.launchHeading||"")}"></label>
   <label>Launch description<textarea name="launchDescription">${esc(p.launchDescription||"")}</textarea></label>
   <label>Ready heading<input name="readyHeading" value="${esc(p.readyHeading||"")}"></label>
   <div class="actions"><button class="btn">Save & Continue</button><a class="btn secondary" href="/manage/setup?step=2">Back</a></div>
  </form>`,"setup"));

 if(step===4){
  let inventory=null,error="";
  try{inventory=await snapshots.status()}catch(e){error=e.message}
  const plugins=(inventory&&inventory.plugins)||[];
  const themes=(inventory&&inventory.themes)||[];
  const activeTheme=inventory&&inventory.activeTheme;
  return res.send(adminPage("Setup",`
   <h1>Product stack</h1><div class="sub">Select required plugins and the active theme from your golden template.</div>
   <div class="progress"><div style="width:66%"></div></div>
   ${error?`<div class="notice">Template inventory unavailable: ${esc(error)}</div>`:""}
   <form method="post" action="/manage/setup/components">
    <div class="card"><h2 style="margin-top:0">Plugins</h2>
     ${plugins.length?plugins.map(pl=>`<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0"><input type="checkbox" name="requiredPlugins" value="${esc(pl.file)}" ${(p.requiredPlugins||[]).includes(pl.file)||(!(p.requiredPlugins||[]).length&&pl.active)?"checked":""} style="width:auto"><span><strong>${esc(pl.name||pl.file)}</strong><br><span class="muted">${esc(pl.file)} · ${pl.active?"active":"inactive"} · ${esc(pl.version||"")}</span></span></label>`).join(""):'<p class="muted">No inventory loaded. Configure DemoPress Agent/token and refresh.</p>'}
    </div>
    <div class="card" style="margin-top:15px"><h2 style="margin-top:0">Theme</h2><label>Required active theme<select name="requiredTheme"><option value="">No required theme</option>${themes.map(t=>`<option value="${esc(t.stylesheet)}" ${(p.requiredTheme||activeTheme)===t.stylesheet?"selected":""}>${esc(t.name||t.stylesheet)} ${t.active?"(active)":""}</option>`).join("")}</select></label></div>
    <div class="actions"><button class="btn">Save & Continue</button><a class="btn secondary" href="/manage/setup?step=3">Back</a></div>
   </form>`,"setup"));
 }

 if(step===5){
  const x=await readiness();
  return res.send(adminPage("Setup",`
   <h1>Readiness</h1><div class="sub">Verify DNS and the golden-template Agent connection.</div>
   <div class="progress"><div style="width:83%"></div></div>${checksHtml(x)}
   <div class="actions"><a class="btn" href="/manage/setup?step=5">Run Checks Again</a><a class="btn secondary" href="/manage/setup?step=4">Back</a><a class="btn secondary" href="/manage/setup?step=6">Continue</a></div>`,"setup"));
 }

 return res.send(adminPage("Setup",`
  <h1>Test & go live</h1><div class="sub">Publish, test and then expose the public launcher.</div>
  <div class="progress"><div style="width:100%"></div></div>
  <div class="grid"><div class="card"><div class="label">Product</div><div class="value">${esc(p.productName)}</div></div><div class="card"><div class="label">Launcher</div><div class="value">${esc(p.launcherDomain)}</div></div><div class="card"><div class="label">Template</div><div class="value">${esc(p.templateDomain)}</div></div></div>
  <div class="actions"><a class="btn" href="/manage/template">Validate / Publish Template</a><form method="post" action="/manage/test-launch"><button class="btn secondary">Launch Administrator Test</button></form><a class="btn secondary" href="/">Open Public Launcher</a></div>
  <div class="notice">For RC testing, leave the administrator demo running throughout the post-ready health-monitor period.</div>`,"setup"));
});

r.post("/product",(req,res)=>{
 const p=profile.load();profile.save({...p,productName:String(req.body.productName||"").trim(),companyName:String(req.body.companyName||"").trim(),homepageUrl:String(req.body.homepageUrl||"").trim(),platformName:String(req.body.platformName||"DemoPress").trim(),tagline:String(req.body.tagline||"").trim()});go(res,2);
});
r.post("/domains",(req,res)=>{
 const p=profile.load();profile.save({...p,launcherDomain:cleanHost(req.body.launcherDomain),templateDomain:cleanHost(req.body.templateDomain)});go(res,3);
});
r.post("/branding",(req,res)=>{
 const p=profile.load();profile.save({...p,launchHeading:String(req.body.launchHeading||"").trim(),launchDescription:String(req.body.launchDescription||"").trim(),readyHeading:String(req.body.readyHeading||"").trim(),branding:{...(p.branding||{}),logoUrl:String(req.body.logoUrl||"").trim(),faviconUrl:String(req.body.faviconUrl||"").trim(),accent:String(req.body.accent||"#ffffff").trim(),footerText:String(req.body.footerText||"Powered by DemoPress").trim()}});go(res,4);
});
r.post("/components",(req,res)=>{
 const p=profile.load();const plugins=Array.isArray(req.body.requiredPlugins)?req.body.requiredPlugins:(req.body.requiredPlugins?[req.body.requiredPlugins]:[]);const theme=String(req.body.requiredTheme||"").trim();profile.save({...p,requiredPlugins:plugins,allowedPlugins:plugins,requiredTheme:theme,allowedThemes:theme?[theme]:[]});go(res,5);
});
r.get("/readiness.json",async(req,res)=>{res.set("Cache-Control","no-store");res.json(await readiness())});
module.exports=r;
