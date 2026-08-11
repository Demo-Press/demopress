const config=require("./config");
const db=require("./database");
const profile=require("./profile");

function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function event(id,message,level="info"){
  try{db.prepare("INSERT INTO events(demo_id,created_at_ms,stage,level,message) VALUES(?,?,?,?,?)").run(id,Date.now(),"email",level,message)}catch(_){}
}
function configured(){return Boolean(config.resendEnabled&&config.resendApiKey&&config.resendFromEmail)}

async function sendDemoReady(id){
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);
  if(!d||d.status!=="running")return {sent:false,reason:"not_ready"};
  if(!d.visitor_email)return {sent:false,reason:"no_recipient"};
  if(!configured()){
    if(config.resendEnabled){
      const msg="Resend delivery enabled but RESEND_API_KEY or RESEND_FROM_EMAIL is missing";
      db.prepare("UPDATE demos SET email_error=? WHERE id=?").run(msg,id);event(id,msg,"warn");
    }
    return {sent:false,reason:"not_configured"};
  }
  if(d.email_sent_at)return {sent:false,reason:"already_sent"};

  const product=profile.productName||"DemoPress";
  const oneClick=`${d.url}/?demopress_demo_login=${encodeURIComponent(d.admin_password)}`;
  const greeting=d.visitor_name?`Hi ${esc(d.visitor_name)},`:`Hello,`;
  const expiry=d.expires_at?new Date(d.expires_at*1000).toLocaleString("en-GB",{timeZone:process.env.TZ||"Europe/London"}):"";
  const html=`<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#151515"><div style="max-width:620px;margin:0 auto;padding:32px 18px"><div style="background:#fff;border:1px solid #e5e5e5;border-radius:18px;padding:28px"><div style="font-size:12px;font-weight:700;letter-spacing:.12em;color:#707070">${esc(product.toUpperCase())} DEMO</div><h1 style="font-size:28px;line-height:1.15;margin:12px 0 16px">Your private demo is ready</h1><p>${greeting}</p><p>Your temporary ${esc(product)} WordPress demo has finished provisioning.</p><div style="background:#f7f7f7;border-radius:12px;padding:16px;margin:20px 0"><p style="margin:0 0 8px"><strong>Demo URL</strong><br><a href="${esc(d.url)}">${esc(d.url)}</a></p><p style="margin:0 0 8px"><strong>Username</strong><br>${esc(d.admin_user)}</p><p style="margin:0"><strong>Password</strong><br>${esc(d.admin_password)}</p></div><p><a href="${esc(oneClick)}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;font-weight:700;padding:13px 18px;border-radius:10px">Open WordPress Admin</a></p>${expiry?`<p style="color:#666;font-size:13px">This disposable environment is currently scheduled to expire ${esc(expiry)}.</p>`:""}<p style="color:#777;font-size:12px;margin-top:28px">This email contains temporary demo credentials. Please do not forward it.</p></div></div></body></html>`;
  const text=`${d.visitor_name?`Hi ${d.visitor_name}`:"Hello"},\n\nYour ${product} demo is ready.\n\nDemo URL: ${d.url}\nUsername: ${d.admin_user}\nPassword: ${d.admin_password}\nWordPress Admin: ${oneClick}${expiry?`\nExpires: ${expiry}`:""}\n`;
  const payload={
    from:`${config.resendFromName} <${config.resendFromEmail}>`,
    to:[d.visitor_email],
    subject:`Your ${product} demo is ready`,
    html,text
  };
  if(config.resendReplyTo)payload.reply_to=config.resendReplyTo;

  try{
    const response=await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{Authorization:`Bearer ${config.resendApiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(10000)
    });
    const body=await response.text();
    if(!response.ok)throw new Error(`Resend HTTP ${response.status}: ${body.slice(0,500)}`);
    const now=Math.floor(Date.now()/1000);
    db.prepare("UPDATE demos SET email_sent_at=?,email_error=NULL WHERE id=?").run(now,id);
    event(id,`Demo details emailed to ${d.visitor_email}`);
    return {sent:true};
  }catch(e){
    const msg=String(e.message||e).slice(0,1000);
    db.prepare("UPDATE demos SET email_error=? WHERE id=?").run(msg,id);
    event(id,`Demo email delivery failed: ${msg}`,"warn");
    console.error(`[${id}] Resend delivery failed:`,e);
    return {sent:false,reason:"error",error:msg};
  }
}

module.exports={configured,sendDemoReady};
