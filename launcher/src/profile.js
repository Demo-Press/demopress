const fs=require("fs");
const path=require("path");

const fallback={
 platformName:"DemoPress",
 productName:"My WordPress Product",
 companyName:"My Company",
 homepageUrl:"https://demopress.co.uk",
 launcherDomain:process.env.DOMAIN||"demo.example.com",
 templateDomain:process.env.TEMPLATE_DOMAIN||"template.demo.example.com",
 tagline:"Try our WordPress product in a private disposable sandbox.",
 launchHeading:"Try the live demo",
 launchDescription:"Launch a private clone of our configured WordPress demonstration site.",
 readyHeading:"Your demo is ready.",
 requiredPlugins:[],
 allowedPlugins:[],
 requiredTheme:"",
 allowedThemes:[],
 dashboardTips:[
  "Explore the configured site from the frontend.",
  "Open WordPress Admin and try the product settings.",
  "Reset the demo whenever you want to return to the golden template."
 ],
 demoRoleName:"DemoPress Demo Admin",
 hidePluginThemeMenus:true,
 disableWpCron:true,
 disableXmlRpc:true,
 branding:{logoUrl:"",faviconUrl:"",accent:"#ffffff",footerText:"Powered by DemoPress"}
};

function files(){
 return [
  process.env.PROFILE_PATH,
  "/data/profile.json",
  path.join(process.cwd(),"config/profile.json"),
  path.join(process.cwd(),"config/profile.example.json")
 ].filter(Boolean);
}
function writablePath(){return process.env.PROFILE_PATH||"/data/profile.json"}
function load(){
 for(const file of files()){
  try{
   if(fs.existsSync(file)){
    const parsed=JSON.parse(fs.readFileSync(file,"utf8"));
    return {...fallback,...parsed,branding:{...fallback.branding,...(parsed.branding||{})}};
   }
  }catch(e){console.error(`DemoPress profile error in ${file}: ${e.message}`)}
 }
 return JSON.parse(JSON.stringify(fallback));
}
function save(next){
 const target=writablePath();
 const merged={...fallback,...next,branding:{...fallback.branding,...(next.branding||{})}};
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,JSON.stringify(merged,null,2)+"\n");
 return merged;
}
function configured(){
 const p=load();
 return Boolean(p.productName&&p.launcherDomain&&p.templateDomain&&!p.launcherDomain.includes("example.com")&&!p.templateDomain.includes("example.com"));
}
const api={load,save,writablePath,configured,fallback};
module.exports=new Proxy(api,{get(target,prop){if(prop in target)return target[prop];return load()[prop]}});
