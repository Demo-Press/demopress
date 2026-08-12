const path=require("path");
function n(k,d){const v=Number(process.env[k]);return Number.isFinite(v)?v:d}
function b(k,d=false){const v=process.env[k];if(v==null||v==='')return d;return ['1','true','yes','on'].includes(String(v).toLowerCase())}
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

  captureEmail:b("DEMO_CAPTURE_EMAIL",false)||b("DEMO_REQUIRE_EMAIL",false)||b("RESEND_SEND_DEMO_INFO",false),
  requireEmail:b("DEMO_REQUIRE_EMAIL",false),
  captureName:b("DEMO_CAPTURE_NAME",false)||b("DEMO_REQUIRE_NAME",false),
  requireName:b("DEMO_REQUIRE_NAME",false),
  captureCompany:b("DEMO_CAPTURE_COMPANY",false)||b("DEMO_REQUIRE_COMPANY",false),
  requireCompany:b("DEMO_REQUIRE_COMPANY",false),
  captureWebsite:b("DEMO_CAPTURE_WEBSITE",false)||b("DEMO_REQUIRE_WEBSITE",false),
  requireWebsite:b("DEMO_REQUIRE_WEBSITE",false),
  captureNotice:process.env.DEMO_CAPTURE_NOTICE||"Your details are used to provide and manage this temporary demo.",

  resendEnabled:b("RESEND_SEND_DEMO_INFO",false),
  resendApiKey:process.env.RESEND_API_KEY||"",
  resendFromEmail:process.env.RESEND_FROM_EMAIL||"",
  resendFromName:process.env.RESEND_FROM_NAME||"DemoPress",
  resendReplyTo:process.env.RESEND_REPLY_TO||"",

  themeRoot:"/app/themes",profileRoot:"/app/profiles",demoBuildRoot:"/opt/demopress/demo-build"
};
