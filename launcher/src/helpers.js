const crypto=require("crypto");
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function token(){return crypto.randomBytes(32).toString("hex");}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function fmtSec(s){s=Math.max(0,Number(s)||0);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);return h?`${h}h ${m}m`:m?`${m}m ${sec}s`:`${sec}s`;}
module.exports={sleep,token,esc,fmtSec};
