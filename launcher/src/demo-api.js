const express=require("express");const db=require("./database");const settings=require("./settings");const provisioner=require("./provisioner");const {token}=require("./helpers");
const r=express.Router();
const buckets=new Map();
function limited(req,key,limit=30,windowMs=60000){
 const ip=String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"").split(",")[0].trim();
 const k=key+":"+ip,now=Date.now(),row=buckets.get(k)||{start:now,count:0};
 if(now-row.start>windowMs){row.start=now;row.count=0}
 row.count++;buckets.set(k,row);
 return row.count>limit;
}
function getDemo(req){const host=String(req.body.demo||req.query.demo||req.headers.host||""),id=host.split(".")[0];return /^demo-[a-f0-9]{8}$/.test(id)?db.prepare("SELECT * FROM demos WHERE id=?").get(id):null;}
r.post("/heartbeat",(req,res)=>{const d=getDemo(req);if(!d||d.status!=="running")return res.status(404).json({success:false});const now=Math.floor(Date.now()/1000),next=Math.min(now+settings.number("idle_lifetime",7200),d.hard_expires_at);db.prepare("UPDATE demos SET last_activity=?,expires_at=? WHERE id=?").run(now,next,d.id);res.json({success:true,expiresAt:next,hardExpiresAt:d.hard_expires_at});});
r.get("/session",(req,res)=>{const d=getDemo(req);if(!d)return res.status(404).json({success:false});res.json({success:true,status:d.status,expiresAt:d.expires_at,hardExpiresAt:d.hard_expires_at,templateVersion:d.template_version});});
r.post("/reset",(req,res)=>{if(limited(req,"reset",10,60000))return res.status(429).json({success:false,error:"rate_limited"});const d=getDemo(req);if(!d)return res.status(404).json({success:false});db.prepare("UPDATE demos SET status='resetting',provision_stage='resetting',status_message='Resetting demo' WHERE id=?").run(d.id);provisioner.reset(d.id);res.json({success:true});});
r.post("/login-token",(req,res)=>{if(limited(req,"login-token",20,60000))return res.status(429).json({success:false,error:"rate_limited"});const d=getDemo(req);if(!d||d.status!=="running")return res.status(404).json({success:false});const t=token(),now=Math.floor(Date.now()/1000);db.prepare("INSERT INTO login_tokens(token,demo_id,created_at,expires_at,used) VALUES(?,?,?,?,0)").run(t,d.id,now,now+60);res.json({success:true,url:`${d.url}/?demopress_demo_login=${t}`});});
r.post("/consume-login",(req,res)=>{if(limited(req,"consume-login",30,60000))return res.status(429).json({success:false,error:"rate_limited"});const d=getDemo(req),t=String(req.body.token||"");if(!d)return res.status(404).json({success:false});const now=Math.floor(Date.now()/1000),row=db.prepare("SELECT * FROM login_tokens WHERE token=? AND demo_id=? AND used=0 AND expires_at>?").get(t,d.id,now);if(!row)return res.status(403).json({success:false});db.prepare("UPDATE login_tokens SET used=1 WHERE token=?").run(t);res.json({success:true,user:d.admin_user});});
module.exports=r;
