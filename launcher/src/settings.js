const db=require("./database");const config=require("./config");
const defaults={maintenance_mode:"0",idle_lifetime:String(config.lifetime),max_lifetime:String(config.maxLifetime),max_active_demos:String(config.maxDemos),failed_retention:String(config.failedRetention)};
for(const [k,v] of Object.entries(defaults))db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(k,v);
function get(k,f=null){const r=db.prepare("SELECT value FROM settings WHERE key=?").get(k);return r?r.value:f;}
function set(k,v){db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k,String(v));}
function number(k,f){const n=Number(get(k,f));return Number.isFinite(n)?n:f;}
function all(){return Object.fromEntries(db.prepare("SELECT key,value FROM settings").all().map(r=>[r.key,r.value]));}
module.exports={get,set,number,all};
