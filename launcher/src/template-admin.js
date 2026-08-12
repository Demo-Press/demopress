const express=require("express");
const snapshots=require("./snapshots");
const provisioner=require("./provisioner");
const {adminPage}=require("./ui");
const {esc}=require("./helpers");
const r=express.Router();

function accessSummary(status){
  const a=status&&status.demoAccess;
  if(!a)return `<div class="card"><div class="label">Demo user access</div><div class="value warn">Not reported</div><p class="muted">Update DemoPress Agent on the golden template, then validate again.</p></div>`;
  const allowed=Array.isArray(a.allowedMenus)?a.allowedMenus:[];
  return `<div class="card"><div class="label">Demo user access</div><div class="value">${esc(a.baseRoleName||a.baseRole||"Administrator")}</div><p class="muted">${a.restrictMenus?`${allowed.length} top-level admin area${allowed.length===1?"":"s"} allowed`:`All areas permitted by the baseline role are visible`}</p></div>`;
}

r.get("/",async(req,res)=>{
  let status={},validation={};
  try{status=await snapshots.status()}catch(e){status={ok:false,error:e.message}}
  try{validation=await snapshots.validate()}catch(e){validation={ok:false,error:e.message}}
  const list=snapshots.list(),cur=snapshots.current(),access=status.demoAccess||null;
  res.send(adminPage("Template",`
<div class="crumb">Manager / Template</div>
<h1>Golden Template</h1>
<div class="sub">Validate, publish, test and roll back the source used for new demos.</div>
<div class="grid">
 <div class="card"><div class="label">Connection</div><div class="stat ${status.ok?"success":"danger"}">${status.ok?"Connected":"Unavailable"}</div></div>
 <div class="card"><div class="label">Validation</div><div class="stat ${validation.ok?"success":"danger"}">${validation.ok?"Passed":"Failed"}</div></div>
 <div class="card"><div class="label">Current</div><div class="value">${esc((cur||{}).version||"None")}</div><p class="muted">${cur?(cur.size_bytes/1048576).toFixed(1)+" MB total":"No published snapshot"}</p></div>
 ${accessSummary(status)}
</div>
<div class="card">
 <div class="kpirow"><div><div class="label">WordPress Agent policy</div><h2 style="margin:5px 0">Disposable demo user</h2></div>${access?'<span class="badge success">Policy detected</span>':'<span class="badge warn">Policy unavailable</span>'}</div>
 ${access?`<div class="grid" style="margin-top:14px"><div><div class="label">Baseline role</div><div class="value">${esc(access.baseRoleName||access.baseRole)}</div></div><div><div class="label">Menu policy</div><div class="value">${access.restrictMenus?'Whitelist enabled':'Baseline permissions'}</div></div><div><div class="label">Allowed areas</div><div class="value">${access.restrictMenus?esc((access.allowedMenus||[]).join(', ')||'None selected'):'All areas permitted by role'}</div></div></div>`:`<p class="muted">The installed Agent did not report a demo-user access policy. Open WordPress → Settings → DemoPress Agent, configure Demo user access, save it and validate again.</p>`}
 <p class="muted" style="margin-bottom:0">The policy is stored in the golden WordPress database and travels with the snapshot. During provisioning DemoPress creates a dedicated restricted role from this baseline; visitors are not assigned a normal WordPress Administrator role.</p>
</div>
<div class="actions"><form method="post" action="/manage/template/publish"><button class="btn">Validate & Publish Snapshot</button></form>${cur?'<form method="post" action="/manage/template/test"><button class="btn secondary">Launch Test From Snapshot</button></form>':""}</div>
<h2>Validation checks</h2><div class="codeblock">${esc(JSON.stringify(validation,null,2))}</div>
<h2>Snapshots</h2><div class="tablewrap"><table><tr><th>Version</th><th>Created</th><th>Size</th><th>State</th><th>Actions</th></tr>${list.map(s=>`<tr><td>${esc(s.version)}</td><td>${new Date(s.created_at*1000).toLocaleString()}</td><td>${(s.size_bytes/1048576).toFixed(1)} MB</td><td>${s.is_current?"CURRENT":""}</td><td><div class="actions" style="margin:0">${!s.is_current?`<form method="post" action="/manage/template/${esc(s.version)}/restore"><button class="btn mini secondary">Restore</button></form><form method="post" action="/manage/template/${esc(s.version)}/delete"><button class="btn mini red">Delete</button></form>`:""}</div></td></tr>`).join("")}</table></div>
`,"template"));
});

r.post("/publish",async(req,res)=>{try{await snapshots.publish();res.redirect("/manage/template?saved="+encodeURIComponent("Golden snapshot published"))}catch(e){res.status(500).send(adminPage("Publish failed",`<h1>Snapshot failed</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/test",(req,res)=>{try{const d=provisioner.create("admin-template-test",{adminTest:true});res.redirect(`/manage/demos/${d.id}`)}catch(e){res.status(500).send(adminPage("Test failed",`<h1>Snapshot test failed</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/:version/restore",(req,res)=>{snapshots.setCurrent(req.params.version);res.redirect("/manage/template?saved="+encodeURIComponent("Snapshot restored"))});
r.post("/:version/delete",(req,res)=>{snapshots.remove(req.params.version);res.redirect("/manage/template?saved="+encodeURIComponent("Snapshot deleted"))});
module.exports=r;
