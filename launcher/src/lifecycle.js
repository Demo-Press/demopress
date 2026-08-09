const db=require("./database");
const docker=require("./docker");
const settings=require("./settings");
const config=require("./config");

async function removeContainer(id){
  if(!id)return;
  try{
    const c=docker.getContainer(id);
    try{await c.stop({t:5});}catch(_){}
    try{await c.remove({force:true,v:true});}catch(_){}
  }catch(_){}
}

async function removeVolumesForDemo(demoId){
  try{
    const volumes=await docker.listVolumes({
      filters:{label:[`com.demopress.demo.id=${demoId}`]}
    });
    for(const v of volumes.Volumes||[]){
      try{await docker.getVolume(v.Name).remove({force:true});}catch(_){}
    }
  }catch(_){}
}

async function destroy(id){
  const d=db.prepare("SELECT * FROM demos WHERE id=?").get(id);
  if(!d)return false;

  await removeContainer(d.container_id);
  await removeContainer(d.db_container_id);
  await removeVolumesForDemo(d.id);

  db.prepare(`
    UPDATE demos
    SET status='deleted',
        provision_stage='deleted',
        status_message='Demo removed'
    WHERE id=?
  `).run(id);

  return true;
}

async function cleanup(){
  const now=Math.floor(Date.now()/1000);

  const expired=db.prepare(`
    SELECT * FROM demos
    WHERE status='running'
      AND (expires_at<? OR hard_expires_at<?)
  `).all(now,now);

  for(const d of expired){
    await destroy(d.id);
  }

  const failedCutoff=now-settings.number("failed_retention",config.failedRetention);
  const failed=db.prepare(`
    SELECT * FROM demos
    WHERE status='failed'
      AND COALESCE(provision_finished_at,created_at)<?
  `).all(failedCutoff);

  for(const d of failed){
    await destroy(d.id);
  }
}

async function orphanReport(){
  const containers=await docker.listContainers({
    all:true,
    filters:{label:["com.demopress.demo=true"]}
  });

  const knownRows=db.prepare(`
    SELECT container_id AS id FROM demos WHERE container_id!=''
    UNION
    SELECT db_container_id AS id FROM demos WHERE db_container_id!=''
  `).all();

  const known=new Set(knownRows.map(x=>x.id));

  const orphanContainers=containers
    .filter(c=>!known.has(c.Id))
    .map(c=>({
      id:c.Id,
      name:(c.Names&&c.Names[0]?c.Names[0].replace(/^\//,""):"unknown"),
      image:c.Image,
      state:c.State,
      labels:c.Labels||{}
    }));

  const orphanDatabases=orphanContainers.filter(c=>c.name.endsWith("-db"));

  return {
    orphanContainers,
    orphanDatabases,
    total:orphanContainers.length,
    databaseTotal:orphanDatabases.length
  };
}

async function reconcile(){
  const report=await orphanReport();

  for(const c of report.orphanContainers){
    await removeContainer(c.id);
  }

  const active=db.prepare(`
    SELECT * FROM demos
    WHERE status IN ('running','provisioning','resetting')
  `).all();

  const containers=await docker.listContainers({
    all:true,
    filters:{label:["com.demopress.demo=true"]}
  });

  const ids=new Set(containers.map(c=>c.Id));

  for(const d of active){
    if(d.container_id && !ids.has(d.container_id) && d.status==="running"){
      db.prepare(`
        UPDATE demos
        SET status='failed',
            provision_stage='failed',
            error_message='WordPress container disappeared'
        WHERE id=?
      `).run(d.id);
    }

    if(d.db_container_id && !ids.has(d.db_container_id) && d.status==="running"){
      db.prepare(`
        UPDATE demos
        SET status='failed',
            provision_stage='failed',
            error_message='Database container disappeared'
        WHERE id=?
      `).run(d.id);
    }
  }

  return report;
}

cleanup().catch(console.error);
reconcile().catch(console.error);

setInterval(()=>cleanup().catch(console.error),300000);
setInterval(()=>reconcile().catch(console.error),600000);

module.exports={
  destroy,
  reconcile,
  orphanReport,
  removeContainer,
  removeVolumesForDemo
};
