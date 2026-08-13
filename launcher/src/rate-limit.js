const db=require("./database");
const config=require("./config");

function ip(req){
  return String(req.headers["cf-connecting-ip"]||req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim();
}

function check(req){
  const address=ip(req),now=Math.floor(Date.now()/1000),hour=now-3600;
  const launches=db.prepare("SELECT COUNT(*) c FROM launches WHERE ip_address=? AND created_at>?").get(address,hour).c;
  const active=db.prepare("SELECT COUNT(*) c FROM demos WHERE ip_address=? AND status IN ('queued','provisioning','running','resetting')").get(address).c;
  if(launches>=config.maxPerHour)throw new Error("Hourly launch limit reached. Please try again later.");
  if(active>=config.maxPerIp)throw new Error("You already have the maximum number of active demos.");
  db.prepare("DELETE FROM launches WHERE created_at<?").run(now-86400);
  db.prepare("INSERT INTO launches(ip_address,created_at) VALUES(?,?)").run(address,now);
  return address;
}

module.exports={check,ip};
