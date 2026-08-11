const fs=require("fs");
const path=require("path");
const config=require("./config");

const persistentFile="/data/profile.json";
const bundledFile=path.join(config.profileRoot,`${config.profile}.json`);

function bundled(){
  if(!fs.existsSync(bundledFile))throw new Error(`DemoPress profile not found: ${config.profile}`);
  return JSON.parse(fs.readFileSync(bundledFile,"utf8"));
}

function load(){
  if(fs.existsSync(persistentFile)){
    try{return {...bundled(),...JSON.parse(fs.readFileSync(persistentFile,"utf8"))};}
    catch(e){console.error("Unable to read persistent DemoPress profile:",e.message);}
  }
  return bundled();
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
  const value={...bundled(),...next};
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
