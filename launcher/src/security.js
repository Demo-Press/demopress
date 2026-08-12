const crypto=require("crypto");
const config=require("./config");

function csrfToken(){
  const secret=String(config.adminPassword||"");
  if(!secret)return "";
  return crypto.createHmac("sha256",secret).update("demopress-manager-csrf-v2").digest("hex");
}
function validCsrf(value){
  const expected=Buffer.from(csrfToken());
  const actual=Buffer.from(String(value||""));
  return expected.length>0&&actual.length===expected.length&&crypto.timingSafeEqual(expected,actual);
}
function sameOrigin(req){
  const origin=String(req.get("origin")||"").trim();
  if(!origin)return true;
  try{
    const u=new URL(origin),host=String(req.get("host")||"").toLowerCase();
    return u.host.toLowerCase()===host;
  }catch(_){return false;}
}
function managerCsrf(req,res,next){
  if(["GET","HEAD","OPTIONS"].includes(req.method))return next();
  if(!sameOrigin(req))return res.status(403).send("Request origin validation failed");
  const value=(req.body&&req.body._csrf)||req.get("x-demopress-csrf");
  if(!validCsrf(value))return res.status(403).send("CSRF validation failed");
  next();
}
module.exports={csrfToken,validCsrf,managerCsrf};
