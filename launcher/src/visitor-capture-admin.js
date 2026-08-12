const express=require("express");
const config=require("./config");
const settings=require("./settings");
const {managerCsrf}=require("./security");
const {adminPage}=require("./ui");
const {esc}=require("./helpers");

const r=express.Router();
r.use(managerCsrf);

function envMode(capture,required){return required?"required":capture?"optional":"off";}
function fallback(field){
  if(field==="name")return envMode(config.captureName,config.requireName);
  if(field==="email")return envMode(config.captureEmail,config.requireEmail);
  if(field==="company")return envMode(config.captureCompany,config.requireCompany);
  return envMode(config.captureWebsite,config.requireWebsite);
}
function mode(field){const v=settings.get(`visitor_${field}_mode`,"");return ["off","optional","required"].includes(v)?v:fallback(field);}
function options(current){return ["off","optional","required"].map(v=>`<option value="${v}" ${current===v?"selected":""}>${v[0].toUpperCase()+v.slice(1)}</option>`).join("");}

r.get("/settings/visitor-capture",(req,res)=>{
  const resendReady=Boolean(config.resendEnabled&&config.resendApiKey&&config.resendFromEmail);
  res.send(adminPage("Visitor Capture",`
<div class="crumb"><a href="/manage/settings">← Settings</a> / Visitor Capture</div>
<div class="kpirow"><div><h1>Visitor Capture</h1><div class="sub">Choose which details visitors provide before a public demo is created.</div></div><span class="badge ${resendReady?'success':''}">Resend ${resendReady?'configured':'not configured'}</span></div>
<div class="card"><div class="label">How it works</div><h2>Capture and email delivery are independent.</h2><p class="muted">Name, email, company and website can be collected for demo analytics whether or not Resend is configured. Resend only sends ready-demo details when it is enabled, configured and the visitor supplied an email address.</p></div>
<form method="post" action="/manage/settings/visitor-capture">
 <div class="card"><div class="label">Launch form</div><h2>Visitor fields</h2><div class="formgrid">
  <label>Name<select name="name_mode">${options(mode("name"))}</select><span class="fieldhint">Off hides the field; Optional records it when supplied; Required blocks launch until completed.</span></label>
  <label>Email address<select name="email_mode">${options(mode("email"))}</select><span class="fieldhint">Email capture does not require Resend. Set Required when every lead must include an email address.</span></label>
  <label>Company<select name="company_mode">${options(mode("company"))}</select><span class="fieldhint">Useful for B2B lead context and analytics.</span></label>
  <label>Website<select name="website_mode">${options(mode("website"))}</select><span class="fieldhint">Stored as a validated HTTP/HTTPS URL with the demo record.</span></label>
 </div>
 <label>Privacy / capture notice<textarea name="notice" maxlength="500">${esc(settings.get("visitor_capture_notice",config.captureNotice))}</textarea><span class="fieldhint">Shown beneath the visitor fields on the public launcher.</span></label>
 <div class="actions"><button class="btn" type="submit">Save visitor capture</button><a class="btn secondary" href="/">Preview launcher</a></div></div>
</form>
<div class="card"><div class="label">Email delivery</div><h2>Resend status</h2><p class="muted">${resendReady?'Demo-ready emails can be sent when a visitor provides an email address.':'Visitor data will still be captured and shown in Manager analytics. To send demo-ready emails, configure RESEND_SEND_DEMO_INFO, RESEND_API_KEY and RESEND_FROM_EMAIL.'}</p></div>
`,"settings"));
});

r.post("/settings/visitor-capture",(req,res)=>{
  try{
    for(const field of ["name","email","company","website"]){
      const v=String(req.body[`${field}_mode`]||"");
      if(!["off","optional","required"].includes(v))throw new Error(`Invalid ${field} setting`);
      settings.set(`visitor_${field}_mode`,v);
    }
    const notice=String(req.body.notice||"").trim().slice(0,500)||config.captureNotice;
    settings.set("visitor_capture_notice",notice);
    res.redirect("/manage/settings/visitor-capture?saved="+encodeURIComponent("Visitor capture settings updated"));
  }catch(e){res.redirect("/manage/settings/visitor-capture?error="+encodeURIComponent(e.message||"Could not save visitor capture settings"));}
});

module.exports=r;
