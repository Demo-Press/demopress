const profile=require("./profile");const fs=require("fs");const path=require("path");const config=require("./config");const db=require("./database");const {token}=require("./helpers");
fs.mkdirSync(config.snapshotRoot,{recursive:true});
function current(){return db.prepare("SELECT * FROM snapshots WHERE is_current=1 ORDER BY created_at DESC LIMIT 1").get();}
function list(){return db.prepare("SELECT * FROM snapshots ORDER BY created_at DESC").all();}
function setCurrent(version){db.prepare("UPDATE snapshots SET is_current=0").run();db.prepare("UPDATE snapshots SET is_current=1 WHERE version=?").run(version);}
function remove(version){
 const s=db.prepare("SELECT * FROM snapshots WHERE version=?").get(version);if(!s||s.is_current)return false;
 fs.rmSync(s.path,{recursive:true,force:true});db.prepare("DELETE FROM snapshots WHERE version=?").run(version);return true;
}
async function fetchTemplate(endpoint,method="GET",body=null){
 const url=`https://${config.templateDomain}/wp-json/demopress-agent/v1/${endpoint}`;
 const opts={method,headers:{"X-DemoPress-Template-Token":config.templateToken}};
 if(body){opts.headers["Content-Type"]="application/json";opts.body=JSON.stringify(body);}
 const r=await fetch(url,opts);if(!r.ok)throw new Error(`Template API ${endpoint} failed (${r.status})`);
 return r;
}
async function validate(){
 const inventory=await (await fetchTemplate("status")).json();
 const active=new Set((inventory.plugins||[]).filter(p=>p.active).map(p=>p.file));
 const checks={
   template_mode:inventory.mode==="template",
   wordpress:Boolean(inventory.wordpress),
   required_plugins:(profile.requiredPlugins||[]).every(p=>active.has(p)),
   required_theme:!profile.requiredTheme||inventory.activeTheme===profile.requiredTheme,
   db:Boolean(inventory.db)
 };
 return {ok:!Object.values(checks).includes(false),checks,inventory,profile:{productName:profile.productName,requiredPlugins:profile.requiredPlugins,requiredTheme:profile.requiredTheme}};
}
async function status(){return (await fetchTemplate("status")).json();}
async function publish(){
 const validation=await validate();if(!validation.ok)throw new Error("Template validation failed");
 const stamp=new Date().toISOString().replace(/[-:]/g,"").replace(/\..+/,"").replace("T",".");
 const version=`${stamp}`;
 const dest=path.join(config.snapshotRoot,version);fs.mkdirSync(dest,{recursive:true});
 const r=await fetchTemplate("export","POST",{version});
 const payload=await r.json();
 if(!payload.ok||!payload.database_b64)throw new Error("Template export returned no database");
 fs.writeFileSync(path.join(dest,"database.sql"),Buffer.from(payload.database_b64,"base64"));
 if(payload.uploads_b64)fs.writeFileSync(path.join(dest,"uploads.tar.gz"),Buffer.from(payload.uploads_b64,"base64"));if(payload.content_b64)fs.writeFileSync(path.join(dest,"content.tar.gz"),Buffer.from(payload.content_b64,"base64"));
 const manifest={version,createdAt:Date.now(),template:payload.manifest||{},validation};
 fs.writeFileSync(path.join(dest,"manifest.json"),JSON.stringify(manifest,null,2));
 const size=["database.sql","uploads.tar.gz","content.tar.gz"].reduce((n,f)=>{try{return n+fs.statSync(path.join(dest,f)).size}catch(_){return n}},0);
 db.prepare("INSERT INTO snapshots(version,created_at,path,size_bytes,is_current,manifest_json) VALUES(?,?,?,?,0,?)").run(version,Math.floor(Date.now()/1000),dest,size,JSON.stringify(manifest));
 setCurrent(version);
 const rows=list();for(const s of rows.slice(config.maxSnapshots)){if(!s.is_current)remove(s.version);}
 return db.prepare("SELECT * FROM snapshots WHERE version=?").get(version);
}
module.exports={current,list,setCurrent,remove,validate,status,publish};
