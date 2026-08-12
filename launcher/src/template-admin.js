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
function validationBadge(s){const st=s.validation_status||"untested";if(st==="passed")return '<span class="badge success">Validated</span>';if(st==="failed")return '<span class="badge danger">Failed</span>';if(st==="testing")return '<span class="badge warn">Testing</span>';return '<span class="badge">Untested</span>'}

r.get("/",async(req,res)=>{
  let status={},validation={};
  try{status=await snapshots.status()}catch(e){status={ok:false,error:e.message}}
  try{validation=await snapshots.validate()}catch(e){validation={ok:false,error:e.message}}
  const list=snapshots.list(),cur=snapshots.current(),access=status.demoAccess||null;
  res.send(adminPage("Template",`
<div class="crumb">Manager / Template</div>
<h1>Golden Template</h1>
<div class="sub">Export a candidate snapshot, validate it in an isolated demo, then promote it to active. Rollback only uses previously validated snapshots.</div>
<div class="grid">
 <div class="card"><div class="label">Connection</div><div class="stat ${status.ok?"success":"danger"}">${status.ok?"Connected":"Unavailable"}</div></div>
 <div class="card"><div class="label">Source validation</div><div class="stat ${validation.ok?"success":"danger"}">${validation.ok?"Passed":"Failed"}</div></div>
 <div class="card"><div class="label">Active snapshot</div><div class="value">${esc((cur||{}).version||"None")}</div><p class="muted">${cur?(cur.size_bytes/1048576).toFixed(1)+" MB total":"No validated snapshot active"}</p></div>
 ${accessSummary(status)}
</div>
<div class="card">
 <div class="kpirow"><div><div class="label">Safe release workflow</div><h2 style="margin:5px 0">Export → Validate → Activate</h2></div></div>
 <p class="muted">Publishing now creates an untested candidate. Launch its validation demo and confirm DemoPress reaches the strict readiness signal. Only snapshots marked Validated can be activated or restored.</p>
</div>
<div class="card">
 <div class="kpirow"><div><div class="label">WordPress Agent policy</div><h2 style="margin:5px 0">Disposable demo user</h2></div>${access?'<span class="badge success">Policy detected</span>':'<span class="badge warn">Policy unavailable</span>'}</div>
 ${access?`<div class="grid" style="margin-top:14px"><div><div class="label">Baseline role</div><div class="value">${esc(access.baseRoleName||access.baseRole)}</div></div><div><div class="label">Menu policy</div><div class="value">${access.restrictMenus?'Whitelist enabled':'Baseline permissions'}</div></div><div><div class="label">Allowed areas</div><div class="value">${access.restrictMenus?esc((access.allowedMenus||[]).join(', ')||'None selected'):'All areas permitted by role'}</div></div></div>`:`<p class="muted">The installed Agent did not report a demo-user access policy. Open WordPress → Settings → DemoPress Agent, configure Demo user access, save it and validate again.</p>`}
 <p class="muted" style="margin-bottom:0">The policy is stored in the golden WordPress database and travels with the snapshot.</p>
</div>
<div class="actions"><form method="post" action="/manage/template/publish"><button class="btn">Export Candidate Snapshot</button></form>${cur?'<form method="post" action="/manage/template/test"><button class="btn secondary">Launch Active Snapshot Test</button></form>':""}</div>
<h2>Source validation checks</h2><div class="codeblock">${esc(JSON.stringify(validation,null,2))}</div>
<h2>Snapshots</h2><div class="tablewrap"><table><tr><th>Version</th><th>Created</th><th>Size</th><th>Validation</th><th>State</th><th>Actions</th></tr>${list.map(s=>`<tr><td>${esc(s.version)}</td><td>${new Date(s.created_at*1000).toLocaleString()}</td><td>${(s.size_bytes/1048576).toFixed(1)} MB</td><td>${validationBadge(s)}${s.validation_error?`<div class="muted" style="max-width:360px">${esc(s.validation_error)}</div>`:""}</td><td>${s.is_current?'<span class="badge success">ACTIVE</span>':''}</td><td><div class="actions" style="margin:0">${s.validation_status!=="testing"?`<form method="post" action="/manage/template/${esc(s.version)}/validate"><button class="btn mini secondary">${s.validation_status==="passed"?'Re-test':'Validate'}</button></form>`:""}${!s.is_current&&s.validation_status==="passed"?`<form method="post" action="/manage/template/${esc(s.version)}/restore"><button class="btn mini">Make Active</button></form>`:""}${!s.is_current?`<form method="post" action="/manage/template/${esc(s.version)}/delete"><button class="btn mini red">Delete</button></form>`:""}${s.validation_demo_id?`<a class="btn mini secondary" href="/manage/demos/${esc(s.validation_demo_id)}">Test details</a>`:""}</div></td></tr>`).join("")}</table></div>
`,"template"));
});

r.post("/publish",async(req,res)=>{try{const s=await snapshots.publish();res.redirect("/manage/template?saved="+encodeURIComponent(`Candidate ${s.version} exported. Run Validate before activation.`))}catch(e){res.status(500).send(adminPage("Publish failed",`<h1>Snapshot failed</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/test",(req,res)=>{try{const cur=snapshots.current();if(!cur)throw new Error("No active snapshot");const d=provisioner.create("admin-template-test",{adminTest:true,snapshotVersion:cur.version});res.redirect(`/manage/demos/${d.id}`)}catch(e){res.status(500).send(adminPage("Test failed",`<h1>Snapshot test failed</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/:version/validate",(req,res)=>{try{const s=snapshots.get(req.params.version);if(!s)throw new Error("Snapshot not found");const d=provisioner.create("admin-snapshot-validation",{adminTest:true,snapshotValidation:true,snapshotVersion:s.version});res.redirect(`/manage/demos/${d.id}`)}catch(e){res.status(500).send(adminPage("Validation failed",`<h1>Unable to launch validation</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/:version/restore",(req,res)=>{try{snapshots.setCurrent(req.params.version);res.redirect("/manage/template?saved="+encodeURIComponent("Validated snapshot activated"))}catch(e){res.status(400).send(adminPage("Activation refused",`<h1>Snapshot not activated</h1><div class="notice">${esc(e.message)}</div>`,"template"))}});
r.post("/:version/delete",(req,res)=>{snapshots.remove(req.params.version);res.redirect("/manage/template?saved="+encodeURIComponent("Snapshot deleted"))});
module.exports=r;
