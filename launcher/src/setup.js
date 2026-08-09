const express=require("express");
const dns=require("dns").promises;
const profile=require("./profile");
const config=require("./config");
const snapshots=require("./snapshots");
const {adminPage}=require("./ui");
const {esc}=require("./helpers");
const r=express.Router();

function cleanHost(value){
 return String(value||"").trim().replace(/^https?:\/\//i,"").split("/")[0].toLowerCase();
}
function validHost(v){
 const h=cleanHost(v);
 return h.length>3 && /^[a-z0-9.-]+$/i.test(h) && h.includes(".") && !h.startsWith(".") && !h.endsWith(".");
}
function validHttpUrl(v,optional=false){
 const s=String(v||"").trim();
 if(optional&&!s)return true;
 try{const u=new URL(s);return ["http:","https:"].includes(u.protocol)&&Boolean(u.hostname)}catch(_){return false}
}
function colorOk(v){return /^#[0-9a-f]{6}$/i.test(String(v||""))}
function text(v){return String(v||"").trim()}
function go(res,n,msg="Changes saved"){res.redirect(`/manage/setup?step=${n}&saved=${encodeURIComponent(msg)}`)}
function fail(res,n,msg){res.redirect(`/manage/setup?step=${n}&error=${encodeURIComponent(msg)}`)}

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
function profileChecks(p,inventory){
 const activePlugins=new Set(((inventory&&inventory.plugins)||[]).filter(x=>x.active).map(x=>x.file));
 const activeTheme=inventory&&inventory.activeTheme;
 return [
  ["Product name",Boolean(text(p.productName)),p.productName||"Missing"],
  ["Company name",Boolean(text(p.companyName)),p.companyName||"Missing"],
  ["Homepage URL",validHttpUrl(p.homepageUrl),p.homepageUrl||"Missing"],
  ["Launcher domain",validHost(p.launcherDomain),p.launcherDomain||"Missing"],
  ["Template domain",validHost(p.templateDomain),p.templateDomain||"Missing"],
  ["Launch heading",Boolean(text(p.launchHeading)),p.launchHeading||"Missing"],
  ["Launch description",Boolean(text(p.launchDescription)),p.launchDescription||"Missing"],
  ["Ready heading",Boolean(text(p.readyHeading)),p.readyHeading||"Missing"],
  ["Accent colour",colorOk((p.branding||{}).accent||""),(p.branding||{}).accent||"Missing"],
  ["Required plugins", (p.requiredPlugins||[]).every(x=>activePlugins.has(x)), (p.requiredPlugins||[]).length?`${(p.requiredPlugins||[]).length} selected`:"None required"],
  ["Required theme", !p.requiredTheme || p.requiredTheme===activeTheme, p.requiredTheme?`${p.requiredTheme}${activeTheme&&p.requiredTheme!==activeTheme?` (active: ${activeTheme})`:""}`:"None required"]
 ];
}
function summaryHtml(checks){
 const good=checks.filter(x=>x[1]).length;
 return `<div class="card"><div class="kpirow"><div><h2 style="margin:0">Configuration completeness</h2><div class="sub">${good}/${checks.length} checks ready</div></div><span class="badge ${good===checks.length?"success":"warn"}">${good===checks.length?"Ready":"Review required"}</span></div>
 ${checks.map(([name,ok,detail])=>`<div class="setupcheck"><span class="setupdot ${ok?"ok":"bad"}"></span><div><strong>${esc(name)}</strong><div class="muted">${esc(detail)}</div></div></div>`).join("")}</div>`;
}

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
    <label>Product name<input name="productName" required minlength="2" maxlength="80" value="${esc(p.productName)}"><span class="fieldhint">Shown on the launcher and demo experience.</span></label>
    <label>Company name<input name="companyName" required minlength="2" maxlength="80" value="${esc(p.companyName)}"></label>
    <label>Website<input type="url" name="homepageUrl" required value="${esc(p.homepageUrl)}" placeholder="https://example.com"></label>
    <label>Platform name<input name="platformName" required minlength="2" maxlength="50" value="${esc(p.platformName||"DemoPress")}"></label>
   </div>
   <label>Tagline<textarea name="tagline" required minlength="8" maxlength="220">${esc(p.tagline||"")}</textarea><span class="fieldhint">Short description used around the public demo experience.</span></label>
   <div class="actions"><button type="submit" class="btn">Save & Continue</button></div>
  </form>`,"setup"));

 if(step===2)return res.send(adminPage("Setup",`
  <h1>Domains</h1><div class="sub">Configure launcher/wildcard and golden-template hosts.</div>
  <div class="progress"><div style="width:33%"></div></div>
  <form method="post" action="/manage/setup/domains" class="card">
   <div class="formgrid">
    <label>Launcher / wildcard base<input name="launcherDomain" required pattern="[A-Za-z0-9.-]+\.[A-Za-z]{2,}" value="${esc(p.launcherDomain)}" placeholder="demo.example.com"><span class="fieldhint">Hostname only — do not include https:// or a path.</span></label>
    <label>Golden template<input name="templateDomain" required pattern="[A-Za-z0-9.-]+\.[A-Za-z]{2,}" value="${esc(p.templateDomain)}" placeholder="template.demo.example.com"><span class="fieldhint">Hostname only. Must be different from the launcher domain.</span></label>
   </div>
   <div class="notice">Create DNS records for <strong>${esc(p.launcherDomain)}</strong>, <strong>*.${esc(p.launcherDomain)}</strong>, and <strong>${esc(p.templateDomain)}</strong>.</div>
   <div class="actions"><button type="submit" class="btn">Save & Continue</button><a class="btn secondary" href="/manage/setup?step=1">Back</a></div>
  </form>`,"setup"));

 if(step===3)return res.send(adminPage("Setup",`
  <h1>Branding</h1><div class="sub">White-label the visitor-facing demo experience.</div>
  <div class="progress"><div style="width:50%"></div></div>
  <form method="post" action="/manage/setup/branding" class="card">
   <div class="formgrid">
    <label>Logo URL<input type="url" name="logoUrl" value="${esc((p.branding||{}).logoUrl||"")}" placeholder="https://.../logo.svg"><span class="fieldhint">Optional. Leave blank to use the DemoPress wordmark.</span></label>
    <label>Favicon URL<input type="url" name="faviconUrl" value="${esc((p.branding||{}).faviconUrl||"")}" placeholder="https://.../favicon.png"><span class="fieldhint">Optional.</span></label>
    <label>Accent<input type="color" name="accent" value="${esc((p.branding||{}).accent||"#ffffff")}"></label>
    <label>Footer text<input name="footerText" required maxlength="100" value="${esc((p.branding||{}).footerText||"Powered by DemoPress")}"></label>
   </div>
   <label>Launch heading<input name="launchHeading" required minlength="4" maxlength="100" value="${esc(p.launchHeading||"")}"></label>
   <label>Launch description<textarea name="launchDescription" required minlength="12" maxlength="320">${esc(p.launchDescription||"")}</textarea></label>
   <label>Ready heading<input name="readyHeading" required minlength="4" maxlength="100" value="${esc(p.readyHeading||"")}"></label>
   <div class="actions"><button type="submit" class="btn">Save & Continue</button><a class="btn secondary" href="/manage/setup?step=2">Back</a></div>
  </form>`,"setup"));

 if(step===4){
  let inventory=null,error="";
  try{inventory=await snapshots.status()}catch(e){error=e.message}
  const plugins=(inventory&&inventory.plugins)||[];
  const themes=(inventory&&inventory.themes)||[];
  const activeTheme=inventory&&inventory.activeTheme;
  return res.send(adminPage("Setup",`
   <h1>Product stack</h1><div class="sub">Select only components that must be active for a valid golden template.</div>
   <div class="progress"><div style="width:66%"></div></div>
   ${error?`<div class="notice danger">Template inventory unavailable: ${esc(error)}</div>`:""}
   <form method="post" action="/manage/setup/components">
    <div class="card"><h2 style="margin-top:0">Required plugins</h2>
     <p class="muted">Only active plugins should be selected. DemoPress Agent itself normally does not need to be a required product plugin.</p>
     ${plugins.length?plugins.map(pl=>`<label style="display:flex;gap:10px;align-items:flex-start;margin:12px 0;opacity:${pl.active?1:.55}"><input type="checkbox" name="requiredPlugins" value="${esc(pl.file)}" ${(p.requiredPlugins||[]).includes(pl.file)?"checked":""} ${pl.active?"":"disabled"} style="width:auto"><span><strong>${esc(pl.name||pl.file)}</strong><br><span class="muted">${esc(pl.file)} · ${pl.active?"active":"inactive"} · ${esc(pl.version||"")}</span></span></label>`).join(""):'<p class="muted">No inventory loaded. Configure DemoPress Agent/token and refresh.</p>'}
    </div>
    <div class="card" style="margin-top:15px"><h2 style="margin-top:0">Required theme</h2>
      <label>Theme<select name="requiredTheme"><option value="">No required theme</option>${themes.map(t=>`<option value="${esc(t.stylesheet)}" ${p.requiredTheme===t.stylesheet?"selected":""} ${t.active?"":"disabled"}>${esc(t.name||t.stylesheet)} ${t.active?"(active)":"(inactive)"}</option>`).join("")}</select><span class="fieldhint">Only the currently active template theme can be selected as required.</span></label>
      ${p.requiredTheme&&activeTheme&&p.requiredTheme!==activeTheme?`<div class="notice danger"><strong>Mismatch:</strong> configured theme <code>${esc(p.requiredTheme)}</code> is not active. Active theme is <code>${esc(activeTheme)}</code>.</div>`:""}
    </div>
    <div class="actions"><button type="submit" class="btn" ${error?"disabled":""}>Save & Continue</button><a class="btn secondary" href="/manage/setup?step=3">Back</a></div>
   </form>`,"setup"));
 }

 if(step===5){
  const x=await readiness();
  const checks=profileChecks(p,x.templateApi&&x.templateApi.data);
  return res.send(adminPage("Setup",`
   <h1>Readiness</h1><div class="sub">Verify DNS, template connection and configuration completeness.</div>
   <div class="progress"><div style="width:83%"></div></div>
   ${checksHtml(x)}
   <div style="margin-top:15px">${summaryHtml(checks)}</div>
   <div class="actions"><a class="btn" href="/manage/setup?step=5">Run Checks Again</a><a class="btn secondary" href="/manage/setup?step=4">Back</a><a class="btn secondary" href="/manage/setup?step=6">Continue</a></div>`,"setup"));
 }

 let inv=null;try{inv=await snapshots.status()}catch(_){}
 const checks=profileChecks(p,inv);
 const complete=checks.every(x=>x[1]);
 return res.send(adminPage("Setup",`
  <h1>Test & go live</h1><div class="sub">Final configuration review before publishing and testing.</div>
  <div class="progress"><div style="width:100%"></div></div>
  ${summaryHtml(checks)}
  <div class="grid" style="margin-top:15px"><div class="card"><div class="label">Product</div><div class="value">${esc(p.productName)}</div></div><div class="card"><div class="label">Launcher</div><div class="value">${esc(p.launcherDomain)}</div></div><div class="card"><div class="label">Template</div><div class="value">${esc(p.templateDomain)}</div></div></div>
  <div class="actions"><a class="btn ${complete?"":"secondary"}" href="/manage/template">Validate / Publish Template</a><form method="post" action="/manage/test-launch"><button class="btn secondary" ${complete?"":"disabled"}>Launch Administrator Test</button></form><a class="btn secondary" href="/">Open Public Launcher</a></div>
  ${complete?`<div class="notice success"><strong>Configuration ready.</strong> Required profile fields and selected template components are consistent.</div>`:`<div class="notice danger"><strong>Configuration needs attention.</strong> Resolve the failed checks above before the final test.</div>`}`,"setup"));
});

r.post("/product",(req,res)=>{
 const p=profile.load(),productName=text(req.body.productName),companyName=text(req.body.companyName),homepageUrl=text(req.body.homepageUrl),platformName=text(req.body.platformName),tagline=text(req.body.tagline);
 if(productName.length<2||companyName.length<2||platformName.length<2||tagline.length<8||!validHttpUrl(homepageUrl))return fail(res,1,"Please complete all product fields with valid values.");
 profile.save({...p,productName,companyName,homepageUrl,platformName,tagline});go(res,2,"Product settings saved");
});
r.post("/domains",(req,res)=>{
 const p=profile.load(),launcherDomain=cleanHost(req.body.launcherDomain),templateDomain=cleanHost(req.body.templateDomain);
 if(!validHost(launcherDomain)||!validHost(templateDomain))return fail(res,2,"Enter valid hostnames without https:// or paths.");
 if(launcherDomain===templateDomain)return fail(res,2,"Launcher and template domains must be different.");
 profile.save({...p,launcherDomain,templateDomain});go(res,3,"Domains saved");
});
r.post("/branding",(req,res)=>{
 const p=profile.load(),logoUrl=text(req.body.logoUrl),faviconUrl=text(req.body.faviconUrl),accent=text(req.body.accent),footerText=text(req.body.footerText),launchHeading=text(req.body.launchHeading),launchDescription=text(req.body.launchDescription),readyHeading=text(req.body.readyHeading);
 if(!validHttpUrl(logoUrl,true)||!validHttpUrl(faviconUrl,true))return fail(res,3,"Logo and favicon must be valid http/https URLs or left blank.");
 if(!colorOk(accent)||footerText.length<2||launchHeading.length<4||launchDescription.length<12||readyHeading.length<4)return fail(res,3,"Complete all branding and public copy fields.");
 profile.save({...p,launchHeading,launchDescription,readyHeading,branding:{...(p.branding||{}),logoUrl,faviconUrl,accent,footerText}});go(res,4,"Branding saved");
});
r.post("/components",async(req,res)=>{
 const p=profile.load();let inventory;
 try{inventory=await snapshots.status()}catch(e){return fail(res,4,"Template inventory is unavailable. Check the DemoPress Agent connection.")}
 const activePlugins=new Set((inventory.plugins||[]).filter(x=>x.active).map(x=>x.file));
 const selected=Array.isArray(req.body.requiredPlugins)?req.body.requiredPlugins:(req.body.requiredPlugins?[req.body.requiredPlugins]:[]);
 const plugins=selected.filter(x=>activePlugins.has(x));
 const theme=text(req.body.requiredTheme);
 if(theme&&theme!==inventory.activeTheme)return fail(res,4,`Required theme must be the active template theme (${inventory.activeTheme||"unknown"}).`);
 profile.save({...p,requiredPlugins:plugins,allowedPlugins:plugins,requiredTheme:theme,allowedThemes:theme?[theme]:[]});go(res,5,"Product stack saved");
});
r.get("/readiness.json",async(req,res)=>{res.set("Cache-Control","no-store");res.json(await readiness())});
module.exports=r;
