const path=require("path");
function n(k,d){const v=Number(process.env[k]);return Number.isFinite(v)?v:d}
const domain=(process.env.DOMAIN||"demo.example.test").toLowerCase().replace(/^https?:\/\//,"").replace(/\/$/,"");
module.exports={
  platformVersion:"1.0.0",
  port:3000,domain,
  templateDomain:(process.env.TEMPLATE_DOMAIN||`template.${domain}`).replace(/^https?:\/\//,"").replace(/\/$/,""),
  instanceId:domain,
  theme:process.env.DEMOPRESS_THEME||"default",
  profile:process.env.DEMOPRESS_PROFILE||"default",
  lifetime:n("DEFAULT_DEMO_LIFETIME",7200),maxLifetime:n("MAX_DEMO_LIFETIME",43200),failedRetention:n("FAILED_RETENTION",1800),
  maxDemos:n("MAX_ACTIVE_DEMOS",10),maxPerIp:n("MAX_ACTIVE_DEMOS_PER_IP",2),maxPerHour:n("MAX_LAUNCHES_PER_IP_PER_HOUR",5),minFreeMemoryMb:n("MIN_FREE_MEMORY_MB",1024),
  database:process.env.SQLITE_PATH||"/data/database.sqlite",dockerSocket:process.env.DOCKER_SOCKET||"/var/run/docker.sock",network:process.env.DOCKER_NETWORK||process.env.COOLIFY_NETWORK||"coolify",
  entrypoints:(process.env.TRAEFIK_ENTRYPOINTS||"http,https").split(",").map(x=>x.trim()).filter(Boolean),certResolver:process.env.TRAEFIK_CERTRESOLVER||"letsencrypt",
  adminPassword:process.env.ADMIN_PASSWORD||"",templateToken:process.env.INTERNAL_TEMPLATE_TOKEN||"",demoImage:process.env.DEMO_IMAGE||"demopress-wordpress:1.0",
  snapshotRoot:process.env.SNAPSHOT_ROOT||"/data/snapshots",maxSnapshots:n("MAX_SNAPSHOTS",5),autoBuildImage:(process.env.AUTO_BUILD_DEMO_IMAGE||"1")!=="0",
  themeRoot:"/app/themes",profileRoot:"/app/profiles",demoBuildRoot:"/opt/demopress/demo-build"
};
