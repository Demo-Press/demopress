const crypto=require("crypto");
const config=require("./config");
module.exports=(req,res,next)=>{
  res.set("Cache-Control","no-store, max-age=0");
  const h=req.headers.authorization;
  if(!h||!h.startsWith("Basic ")){
    res.set("WWW-Authenticate",'Basic realm="DemoPress Manager", charset="UTF-8"');
    return res.status(401).send("Authentication required");
  }
  let decoded="";
  try{decoded=Buffer.from(h.slice(6),"base64").toString("utf8")}catch(_){}
  const split=decoded.indexOf(":");
  if(split<0){
    res.set("WWW-Authenticate",'Basic realm="DemoPress Manager", charset="UTF-8"');
    return res.status(401).send("Authentication required");
  }
  const supplied=decoded.slice(split+1);
  const expected=String(config.adminPassword||"");
  if(!expected||expected==="change-me-now"||expected==="REPLACE_WITH_A_LONG_RANDOM_PASSWORD"){
    return res.status(503).send("DemoPress Manager password is not configured securely.");
  }
  const a=Buffer.from(supplied),b=Buffer.from(expected);
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b)){
    res.set("WWW-Authenticate",'Basic realm="DemoPress Manager", charset="UTF-8"');
    return res.status(401).send("Authentication required");
  }
  next();
};
