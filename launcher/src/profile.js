const fs=require("fs");
const path=require("path");
const config=require("./config");

const persistentFile="/data/profile.json";
const bundledFile=path.join(config.profileRoot,`${config.profile}.json`);

function bundled(){
  if(!fs.existsSync(bundledFile))throw new Error(`DemoPress profile not found: ${config.profile}`);
  return JSON.parse(fs.readFileSync(bundledFile,"utf8"));
}

function cleanList(value){
  if(!Array.isArray(value))return [];
  return [...new Set(value.map(x=>String(x||"").trim()).filter(Boolean))];
}

function normaliseComponents(value){
  const out={...value};
  let requiredPlugins=cleanList(out.requiredPlugins);
  let allowedPlugins=cleanList(out.allowedPlugins);

  // Older DemoPress profiles sometimes persisted the selected product stack
  // only as allowedPlugins/allowedThemes. The runtime still worked because the
  // snapshot contained those components, but Manager pages that display the
  // required* fields appeared to show no required component. Keep both pieces
  // of metadata in sync when one side is populated, while preserving an
  // intentional "none required" state when both are empty.
  if(!requiredPlugins.length&&allowedPlugins.length)requiredPlugins=[...allowedPlugins];
  if(!allowedPlugins.length&&requiredPlugins.length)allowedPlugins=[...requiredPlugins];

  let requiredTheme=String(out.requiredTheme||"").trim();
  let allowedThemes=cleanList(out.allowedThemes);
  if(!requiredTheme&&allowedThemes.length)requiredTheme=allowedThemes[0];
  if(requiredTheme&&!allowedThemes.length)allowedThemes=[requiredTheme];

  out.requiredPlugins=requiredPlugins;
  out.allowedPlugins=allowedPlugins;
  out.requiredTheme=requiredTheme;
  out.allowedThemes=allowedThemes;
  return out;
}

function load(){
  const base=bundled();
  if(fs.existsSync(persistentFile)){
    try{return normaliseComponents({...base,...JSON.parse(fs.readFileSync(persistentFile,"utf8"))});}
    catch(e){console.error("Unable to read persistent DemoPress profile:",e.message);}
  }
  return normaliseComponents(base);
}

const api={};

function refresh(){
  const current=load();
  for(const k of Object.keys(api)){
    if(!["load","save","refresh"].includes(k))delete api[k];
  }
  Object.assign(api,current);
  return current;
}

function save(next){
  fs.mkdirSync(path.dirname(persistentFile),{recursive:true});
  const value=normaliseComponents({...bundled(),...next});
  fs.writeFileSync(persistentFile,JSON.stringify(value,null,2)+"\n","utf8");
  refresh();
  return value;
}

Object.defineProperties(api,{
  load:{value:load,enumerable:false},
  save:{value:save,enumerable:false},
  refresh:{value:refresh,enumerable:false}
});
refresh();

module.exports=api;
