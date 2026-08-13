const fs=require("fs"),path=require("path"),config=require("./config");
function safe(name){return /^[a-z0-9_-]+$/i.test(name)?name:"default"}
function load(){let name=safe(config.theme);let dir=path.join(config.themeRoot,name);if(!fs.existsSync(path.join(dir,"theme.json"))){name="default";dir=path.join(config.themeRoot,name)}const themeCss=fs.existsSync(path.join(dir,"theme.css"))?fs.readFileSync(path.join(dir,"theme.css"),"utf8"):"",accessibilityPath=path.join(config.themeRoot,"default","accessibility.css"),accessibilityCss=fs.existsSync(accessibilityPath)?fs.readFileSync(accessibilityPath,"utf8"):"";return{name,config:JSON.parse(fs.readFileSync(path.join(dir,"theme.json"),"utf8")),css:`${themeCss}\n${accessibilityCss}`}}
module.exports={load};
