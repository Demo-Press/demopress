const fs=require("fs");
const {PassThrough}=require("stream");

async function logs(c,n=300){
  try{return String(await c.logs({stdout:true,stderr:true,tail:n,timestamps:false}))}
  catch(_){return ""}
}

async function exec(c,cmd,env=[]){
  const e=await c.exec({Cmd:["sh","-lc",cmd],AttachStdout:true,AttachStderr:true,Env:env});
  const s=await e.start({hijack:true,stdin:false});
  let out="";
  await new Promise((res,rej)=>{
    const p=new PassThrough();
    p.on("data",d=>out+=d.toString());
    p.on("end",res);
    p.on("error",rej);
    c.modem.demuxStream(s,p,p);
  });
  const i=await e.inspect();
  return{code:i.ExitCode,out};
}

async function startDetached(c,cmd,env=[]){
  const e=await c.exec({Cmd:["sh","-lc",cmd],AttachStdout:false,AttachStderr:false,Env:env});
  await e.start({Detach:true,Tty:false});
  return e;
}

async function importSql(c,root,dbName,file,progress){
  if(!fs.existsSync(file))throw new Error(`Snapshot database file missing: ${file}`);
  const total=fs.statSync(file).size;
  const e=await c.exec({Cmd:["sh","-lc",`mariadb -uroot -p'${root.replace(/'/g,"'\''")}' ${dbName}`],AttachStdin:true,AttachStdout:true,AttachStderr:true});
  const s=await e.start({hijack:true,stdin:true});
  let sent=0,start=Date.now();
  await new Promise((res,rej)=>{
    const r=fs.createReadStream(file);
    r.on("data",d=>{sent+=d.length;if(progress)progress(sent,total,Date.now()-start)});
    r.on("error",rej);
    s.on("error",rej);
    s.on("end",res);
    r.pipe(s);
  });
  const i=await e.inspect();
  if(i.ExitCode!==0)throw new Error("Snapshot database import failed");
  return{elapsedMs:Date.now()-start};
}

module.exports={logs,exec,startDetached,importSql};
