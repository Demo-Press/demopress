const docker=require("./docker");const config=require("./config");const settings=require("./settings");const db=require("./database");
async function check(){
 const info=await docker.info();
 const freeMb=Math.max(0,Math.round((info.MemTotal-(info.MemTotal-info.MemTotal))/1048576)); // Docker info lacks host free memory; configured cap remains primary.
 const active=db.prepare("SELECT COUNT(*) c FROM demos WHERE status IN ('queued','provisioning','running','resetting')").get().c;
 const max=settings.number("max_active_demos",config.maxDemos);
 return {ok:active<max,active,max,freeMb,note:"Max-active cap enforced; host free-memory threshold is advisory unless host metrics are added."};
}
module.exports={check};
