const profile=require("./profile");const path=require("path");const docker=require("./docker");const db=require("./database");const config=require("./config");const settings=require("./settings");const snapshots=require("./snapshots");const actions=require("./docker-actions");const {v4:uuid}=require("uuid");const {sleep}=require("./helpers");
function event(id,stageName,message,level="info"){
 const nowMs=Date.now();
 db.prepare("INSERT INTO provisioning_events(demo_id,created_at,created_at_ms,stage,level,message) VALUES(?,?,?,?,?,?)").run(id,Math.floor(nowMs/1000),nowMs,stageName,level,message);
 console.log(`[${new Date(nowMs).toISOString()}] [${id}] [${stageName}] ${message}`);
}
function stage(id,s,m,status="provisioning"){
 db.prepare("UPDATE demos SET provision_stage=?,status_message=?,status=? WHERE id=?").run(s,m,status,id);
 event(id,s,m,"info");
}


function fetchDetail(err){
  const cause=err&&err.cause;
  const bits=[err&&err.message,cause&&cause.code,cause&&cause.hostname,cause&&cause.message].filter(Boolean);
  return [...new Set(bits)].join(" | ")||"fetch failed";
}

async function internalWordPressCheck(id,wp,url){
  const host=new URL(url).hostname;
  const result=await actions.exec(wp,[
    "/bin/bash","-lc",
    `cd /var/www/html &&
     wp db check --allow-root >/dev/null &&
     code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 -H "Host: ${host}" http://127.0.0.1/ || true) &&
     echo "$code" &&
     case "$code" in 200|301|302) exit 0;; *) exit 12;; esac`
  ]);

  if(result.code!==0){
    const logs=await actions.logs(wp,250);
    db.prepare("UPDATE demos SET degraded_logs=? WHERE id=?").run(logs,id);
    throw new Error(`Internal WordPress health check failed: ${result.out.slice(-400)}`);
  }

  return String(result.out||"").trim().split(/\r?\n/).pop()||"ok";
}

async function verifyPublicRoute(id,url){
  let status=0,lastError="";
  const attempts=Math.max(1,config.publicRouteAttempts||5);

  for(let i=0;i<attempts;i++){
    try{
      const rr=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(3000)});
      status=rr.status;
      event(id,"routing",`Public HTTPS check ${i+1}/${attempts}: HTTP ${status}`,"debug");
      if(status>=200&&status<500){
        db.prepare("UPDATE demos SET public_route_status='verified',public_route_last_error=NULL WHERE id=?").run(id);
        return {verified:true,status,error:""};
      }
      lastError=`HTTP ${status}`;
    }catch(err){
      lastError=fetchDetail(err);
      event(id,"routing",`Public HTTPS check ${i+1}/${attempts}: ${lastError}`,"debug");
    }
    await sleep(1000);
  }

  db.prepare("UPDATE demos SET public_route_status='unverified',public_route_last_error=? WHERE id=?")
    .run(lastError||"No successful public route response",id);

  return {verified:false,status,error:lastError||"No successful public route response"};
}

function startPostReadyMonitor(id,url,wp,publicRouteVerified){
  let checks=0;
  const maxChecks=12;

  const run=async()=>{
    checks++;

    try{
      const code=await internalWordPressCheck(id,wp,url);
      db.prepare("UPDATE demos SET health_status='healthy',last_health_at=? WHERE id=?")
        .run(Math.floor(Date.now()/1000),id);
      event(id,"health",`Internal health ${checks}/${maxChecks}: HTTP ${code}`,"debug");
    }catch(err){
      const logs=await actions.logs(wp,300);
      db.prepare("UPDATE demos SET health_status='degraded',last_health_at=?,health_failures=health_failures+1,degraded_logs=? WHERE id=?")
        .run(Math.floor(Date.now()/1000),logs,id);
      event(id,"health",`Internal post-ready health failure: ${err.message}`,"error");
      if(checks<maxChecks)setTimeout(run,10000);
      return;
    }

    if(publicRouteVerified){
      try{
        const r=await fetch(url,{redirect:"manual",signal:AbortSignal.timeout(5000)});
        if(r.status>=500){
          db.prepare("UPDATE demos SET public_route_status='failed',public_route_last_error=? WHERE id=?")
            .run(`HTTP ${r.status}`,id);
          event(id,"health",`Public route health returned HTTP ${r.status}`,"error");
        }else{
          db.prepare("UPDATE demos SET public_route_status='verified',public_route_last_error=NULL WHERE id=?").run(id);
          event(id,"health",`Public route health ${checks}/${maxChecks}: HTTP ${r.status}`,"debug");
        }
      }catch(err){
        const detail=fetchDetail(err);
        db.prepare("UPDATE demos SET public_route_status='unverified',public_route_last_error=? WHERE id=?")
          .run(detail,id);
        event(id,"health",`Public route became unverifiable from launcher: ${detail}`,"warn");
        publicRouteVerified=false;
      }
    }

    if(checks<maxChecks)setTimeout(run,10000);
  };

  setTimeout(run,10000);
}

async function provision(id,{reset=false}={}){
 const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);if(!d)return;
 const snap=snapshots.current();if(!snap)throw new Error("No published golden snapshot");
 const compact=id.replace(/-/g,""),dbName=`wp_${compact}`,dbUser=`user_${compact}`,dbPass=uuid(),root=uuid();
 let dbc,wp;const start=Date.now();
 try{
  if(reset){stage(id,"resetting","Restoring golden template","resetting");if(d.container_id)try{await docker.getContainer(d.container_id).remove({force:true})}catch(_){}if(d.db_container_id)try{await docker.getContainer(d.db_container_id).remove({force:true})}catch(_){}}
  let t=Date.now();stage(id,"database","Starting isolated database",reset?"resetting":"provisioning");
  dbc=await docker.createContainer({name:`${id}-db`,Image:"mariadb:11",Env:[`MYSQL_DATABASE=${dbName}`,`MYSQL_USER=${dbUser}`,`MYSQL_PASSWORD=${dbPass}`,`MYSQL_ROOT_PASSWORD=${root}`],Labels:{"com.demopress.demo":"true","com.demopress.demo.id":id},HostConfig:{NetworkMode:config.network,Memory:402653184,NanoCpus:300000000,RestartPolicy:{Name:"no"}}});
  await dbc.start();db.prepare("UPDATE demos SET db_container_id=? WHERE id=?").run(dbc.id,id);event(id,"database",`MariaDB container started: ${dbc.id.substring(0,12)}`);event(id,"database","Waiting for MariaDB port 3306");
  const dbReady=await actions.waitDb(dbc,root,180000,async(ms)=>event(id,"database",`Still waiting for MariaDB (${(ms/1000).toFixed(1)}s)`,"debug"));
  event(id,"database",`MariaDB ready after ${(dbReady.elapsedMs/1000).toFixed(2)}s on ${dbReady.host}:3306`);event(id,"database","MariaDB reported ready on port 3306");db.prepare("UPDATE demos SET database_ms=? WHERE id=?").run(Date.now()-t,id);
  t=Date.now();stage(id,"template","Importing published snapshot",reset?"resetting":"provisioning");event(id,"template",`Snapshot ${snap.version} selected`);const importResult=await actions.importSql(dbc,root,dbName,path.join(snap.path,"database.sql"),async(sent,total,ms)=>{
    const pct=total?Math.floor(sent/total*100):0;
    event(id,"template",`SQL import ${pct}% (${(sent/1048576).toFixed(1)}/${(total/1048576).toFixed(1)} MB, ${(ms/1000).toFixed(1)}s)`,"debug");
  });
  event(id,"template",`Snapshot database imported in ${(importResult.elapsedMs/1000).toFixed(2)}s`);event(id,"template","Snapshot database import completed");db.prepare("UPDATE demos SET import_ms=?,template_version=? WHERE id=?").run(Date.now()-t,snap.version,id);
  t=Date.now();stage(id,"wordpress","Starting WordPress clone",reset?"resetting":"provisioning");
  event(id,"wordpress","Creating WordPress container");const wpCreateStart=Date.now();const imageInfo=await docker.getImage(config.demoImage).inspect();event(id,"wordpress",`Using demo image ${imageInfo.Id.substring(0,19)}`);wp=await docker.createContainer({name:id,Image:config.demoImage,Env:[`WORDPRESS_DB_HOST=${id}-db:3306`,`WORDPRESS_DB_NAME=${dbName}`,`WORDPRESS_DB_USER=${dbUser}`,`WORDPRESS_DB_PASSWORD=${dbPass}`,`WORDPRESS_URL=${d.url}`,`TEMPLATE_URL=https://${config.templateDomain}`,`DEMO_ADMIN_USER=${d.admin_user}`,`DEMO_ADMIN_PASSWORD=${d.admin_password}`,`SNAPSHOT_UPLOADS=${path.join(snap.path,"uploads.tar.gz")}`,
`DEMOPRESS_LAUNCHER_URL=https://${config.domain}`,
`DEMOPRESS_PRODUCT_NAME=${profile.productName}`,
`DEMOPRESS_REQUIRED_PLUGINS=${JSON.stringify(profile.requiredPlugins||[])}`,
`DEMOPRESS_ALLOWED_PLUGINS=${JSON.stringify(profile.allowedPlugins||profile.requiredPlugins||[])}`,
`DEMOPRESS_REQUIRED_THEME=${profile.requiredTheme||""}`,
`DEMOPRESS_ALLOWED_THEMES=${JSON.stringify(profile.allowedThemes||[])}`,
`DEMOPRESS_DEMO_ROLE_NAME=${profile.demoRoleName||"DemoPress Demo Admin"}`],Labels:{"com.demopress.demo":"true","com.demopress.demo.id":id,"traefik.enable":"true","traefik.docker.network":config.network,[`traefik.http.routers.${id}.rule`]:`Host(\`${id}.${config.domain}\`)`,[`traefik.http.routers.${id}.entrypoints`]:config.entrypoints,[`traefik.http.routers.${id}.tls`]:"true",[`traefik.http.routers.${id}.tls.certresolver`]:config.resolver,[`traefik.http.services.${id}.loadbalancer.server.port`]:"80"},HostConfig:{NetworkMode:config.network,Memory:536870912,NanoCpus:500000000,RestartPolicy:{Name:"no"},Binds:[`${snap.path}:/snapshot:ro`]}});
  event(id,"wordpress",`WordPress container created in ${((Date.now()-wpCreateStart)/1000).toFixed(2)}s`);const wpStart=Date.now();await wp.start();event(id,"wordpress",`WordPress container started in ${((Date.now()-wpStart)/1000).toFixed(2)}s`);db.prepare("UPDATE demos SET container_id=?,wordpress_ms=?,demo_image_id=? WHERE id=?").run(wp.id,Date.now()-t,imageInfo.Id,id);event(id,"wordpress",`WordPress container started: ${wp.id.substring(0,12)}`);
  t=Date.now();stage(id,"finalising","Personalising your demo",reset?"resetting":"provisioning");
  event(id,"finalising","Running clone finaliser");
  const finaliserStart=Date.now();
  const r=await actions.execStreaming(wp,["/bin/bash","/setup/finalise-clone.sh"],{
    timeoutMs:420000,
    onLine:async(line)=>{
      const level=(line.includes("[DIAG] ERROR")||line.includes("[DIAG] TIMEOUT"))?"error":(line.includes("[DIAG] START")||line.includes("[DIAG] END"))?"info":"debug";
      event(id,"finalising",line,level);
    }
  });
  event(id,"finalising",`Finaliser completed in ${((Date.now()-finaliserStart)/1000).toFixed(2)}s with exit code ${r.code}`);
  if(r.code!==0)throw new Error("Clone finalisation failed: "+r.out.slice(-800));
  event(id,"finalising","Post-finalisation WordPress health check");
  const verify=await actions.exec(wp,[
    "/bin/bash","-lc",
    "cd /var/www/html && wp core is-installed --allow-root && wp option get siteurl --allow-root"
  ]);
  if(verify.code!==0){
    event(id,"finalising","Post-finalisation WordPress verification failed","error");
    throw new Error("WordPress verification failed: "+verify.out.slice(-800));
  }
  event(id,"finalising","WordPress verification passed");
db.prepare("UPDATE demos SET finalise_ms=? WHERE id=?").run(Date.now()-t,id);
  t=Date.now();
  stage(id,"routing","Preparing secure URL",reset?"resetting":"provisioning");

  event(id,"routing","Checking WordPress internally");
  const internalCode=await internalWordPressCheck(id,wp,d.url);
  event(id,"routing",`Internal WordPress check passed with HTTP ${internalCode}`);

  event(id,"routing","Checking public HTTPS route");
  const publicCheck=await verifyPublicRoute(id,d.url);

  if(publicCheck.verified){
    event(id,"routing",`Public HTTPS route verified with HTTP ${publicCheck.status}`);
  }else{
    event(id,"routing",`Public route could not be verified from launcher: ${publicCheck.error}`,"warn");
    if(config.requirePublicRoute){
      throw new Error(`Public route verification failed: ${publicCheck.error}`);
    }
    event(id,"routing","Internal WordPress health is good; continuing with route marked unverified","warn");
  }

  db.prepare("UPDATE demos SET routing_ms=?,provision_finished_at=?,status='running',provision_stage='ready',status_message=?,error_message=NULL,health_status='healthy',last_health_at=? WHERE id=?")
    .run(
      Date.now()-t,
      Math.floor(Date.now()/1000),
      publicCheck.verified?"Your demo is ready":"Your demo is ready; public route verification is pending",
      Math.floor(Date.now()/1000),
      id
    );

  event(id,"ready",publicCheck.verified?"Demo provisioning completed successfully":"Demo provisioning completed; public route unverified from launcher");
  startPostReadyMonitor(id,d.url,wp,publicCheck.verified);
 }catch(e){
  event(id,"failed",e.message,"error");const l=(await actions.logs(wp))+"\\n--- DATABASE ---\\n"+(await actions.logs(dbc));db.prepare("UPDATE demos SET status='failed',provision_stage='failed',status_message='Provisioning failed',error_message=?,failure_logs=?,provision_finished_at=? WHERE id=?").run(e.message,l,Math.floor(Date.now()/1000),id);
 }
}
function create(ip,{adminTest=false}={}){
 if(!adminTest && settings.get("maintenance_mode","0")==="1")throw new Error("Demo maintenance is active.");
 if(!snapshots.current())throw new Error("No golden template has been published yet.");
 const active=db.prepare("SELECT COUNT(*) c FROM demos WHERE status IN ('queued','provisioning','running','resetting')").get().c;
 if(active>=settings.number("max_active_demos",config.maxDemos))throw new Error("All demo slots are currently in use.");
 const id="demo-"+uuid().slice(0,8),now=Math.floor(Date.now()/1000),idle=settings.number("idle_lifetime",config.lifetime),hard=settings.number("max_lifetime",config.maxLifetime),user=`demo_${id.replace(/-/g,"")}`,pass=uuid(),url=`https://${id}.${config.domain}`,snap=snapshots.current();
 db.prepare(`INSERT INTO demos(id,container_id,db_container_id,url,created_at,last_activity,expires_at,hard_expires_at,status,provision_stage,status_message,error_message,failure_logs,admin_user,admin_password,ip_address,template_version,provision_started_at,demo_type,platform_version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,"","",url,now,now,now+idle,now+hard,"queued","queued",adminTest?"Preparing administrator test demo":"Preparing your demo",null,null,user,pass,adminTest?"admin-test":ip,snap.version,now,adminTest?"admin_test":"public",config.platformVersion);
 event(id,"queued",adminTest?"Administrator test launch requested":"Public demo launch requested");
 setImmediate(()=>provision(id));return{id};
}
function reset(id){setImmediate(()=>provision(id,{reset:true}));}

async function retryFinalisation(id){
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);
  if(!d)throw new Error("Demo not found.");
  if(!d.container_id)throw new Error("WordPress container is unavailable.");

  const wp=docker.getContainer(d.container_id);

  stage(id,"finalising","Retrying demo finalisation","provisioning");
  event(id,"finalising","Manual finalisation retry requested");

  const started=Date.now();

  const r=await actions.execStreaming(
    wp,
    ["/bin/bash","/setup/finalise-clone.sh"],
    {
      timeoutMs:420000,
      onLine:async(line)=>{
        const level=(line.includes("[DIAG] ERROR")||line.includes("[DIAG] TIMEOUT"))
          ?"error"
          :(line.includes("[DIAG] START")||line.includes("[DIAG] END"))
            ?"info"
            :"debug";
        event(id,"finalising",line,level);
      }
    }
  );

  if(r.code!==0){
    event(id,"failed",`Finalisation retry failed with exit code ${r.code}`,"error");
    db.prepare(`
      UPDATE demos
      SET status='failed',
          provision_stage='failed',
          status_message='Finalisation retry failed',
          error_message=?,
          provision_finished_at=?
      WHERE id=?
    `).run(r.out.slice(-1200),Math.floor(Date.now()/1000),id);

    throw new Error("Finalisation retry failed.");
  }

  const verify=await actions.exec(wp,[
    "/bin/bash","-lc",
    "cd /var/www/html && wp core is-installed --allow-root && wp option get siteurl --allow-root"
  ]);

  if(verify.code!==0){
    throw new Error("WordPress verification failed after finalisation retry.");
  }

  db.prepare(`
    UPDATE demos
    SET status='running',
        provision_stage='ready',
        status_message='Your demo is ready',
        error_message=NULL,
        failure_logs=NULL,
        finalise_ms=?,
        provision_finished_at=?
    WHERE id=?
  `).run(Date.now()-started,Math.floor(Date.now()/1000),id);

  event(id,"ready","Manual finalisation retry completed successfully");
  return true;
}

module.exports={create,reset,provision,retryFinalisation};
