const db=require("./database");

function get(k,d=""){
  const r=db.prepare("SELECT value FROM settings WHERE key=?").get(k);
  return r?r.value:d;
}

function set(k,v){
  db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .run(k,String(v));
}

function number(k,d){
  const v=Number(get(k,""));
  return Number.isFinite(v)&&v>0?v:d;
}

function all(){
  const out={};
  for(const row of db.prepare("SELECT key,value FROM settings ORDER BY key").all())out[row.key]=row.value;
  return out;
}

module.exports={get,set,number,all};
