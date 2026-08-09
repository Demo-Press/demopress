const fs=require("fs");
const net=require("net");
const {sleep}=require("./helpers");

function decodeDockerBuffer(buffer){
  if(!buffer||!buffer.length)return "";
  let offset=0;const out=[];
  while(offset+8<=buffer.length){
    const type=buffer[offset],size=buffer.readUInt32BE(offset+4);
    if((type===1||type===2)&&offset+8+size<=buffer.length){
      out.push(buffer.subarray(offset+8,offset+8+size).toString("utf8"));
      offset+=8+size;
    }else{
      return buffer.toString("utf8").replace(/\u0000/g,"");
    }
  }
  if(offset<buffer.length)out.push(buffer.subarray(offset).toString("utf8"));
  return out.join("").replace(/\u0000/g,"");
}

async function exec(container,cmd){
  const e=await container.exec({AttachStdout:true,AttachStderr:true,Cmd:cmd});
  const stream=await e.start({hijack:true,stdin:false});
  const chunks=[];stream.on("data",d=>chunks.push(Buffer.from(d)));
  await new Promise(r=>{stream.on("end",r);stream.on("close",r);});
  const info=await e.inspect();
  return {code:info.ExitCode,out:decodeDockerBuffer(Buffer.concat(chunks))};
}

async function tcpOpen(host,port,timeoutMs=1200){
  return new Promise(resolve=>{
    let settled=false;
    const socket=net.createConnection({host,port});

    const done=(ok)=>{
      if(settled)return;
      settled=true;
      try{socket.destroy();}catch(_){}
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect",()=>done(true));
    socket.once("timeout",()=>done(false));
    socket.once("error",()=>done(false));
  });
}

async function waitDb(container,rootPass,timeout=180000,onProgress=null){
  const started=Date.now();
  let lastNotice=0;

  while(Date.now()-started<timeout){
    let inspect;

    try{
      inspect=await container.inspect();
    }catch(_){
      await sleep(500);
      continue;
    }

    if(inspect.State && inspect.State.Status==="exited"){
      throw new Error(
        `MariaDB container exited unexpectedly with code ${inspect.State.ExitCode}`
      );
    }

    const networks=(inspect.NetworkSettings && inspect.NetworkSettings.Networks)||{};
    const addresses=Object.values(networks)
      .map(n=>n && n.IPAddress)
      .filter(Boolean);

    for(const host of addresses){
      if(await tcpOpen(host,3306,1200)){
        return {
          elapsedMs:Date.now()-started,
          host
        };
      }
    }

    if(onProgress && Date.now()-lastNotice>=5000){
      lastNotice=Date.now();
      await onProgress(
        Date.now()-started,
        `Waiting for TCP 3306; addresses=${addresses.join(",")||"pending"}`
      );
    }

    await sleep(500);
  }

  throw new Error("MariaDB readiness timeout waiting for TCP port 3306");
}

async function importSql(container,rootPass,dbName,file,onProgress=null){
  if(!fs.existsSync(file))throw new Error(`Snapshot database file missing: ${file}`);
  const total=fs.statSync(file).size,started=Date.now();
  const e=await container.exec({AttachStdin:true,AttachStdout:true,AttachStderr:true,Cmd:["mariadb","-uroot",`-p${rootPass}`,dbName]});
  const stream=await e.start({hijack:true,stdin:true});
  const read=fs.createReadStream(file);const chunks=[];let sent=0,last=0;
  read.on("data",c=>{sent+=c.length;if(onProgress&&Date.now()-last>2000){last=Date.now();onProgress(sent,total,Date.now()-started).catch(()=>{});}});
  stream.on("data",d=>chunks.push(Buffer.from(d)));
  await new Promise((resolve,reject)=>{read.on("error",reject);stream.on("error",reject);stream.on("close",resolve);stream.on("end",resolve);read.pipe(stream);});
  const info=await e.inspect(),out=decodeDockerBuffer(Buffer.concat(chunks));
  if(info.ExitCode!==0)throw new Error(`SQL import failed${out?`: ${out.slice(-1200)}`:""}`);
  return {elapsedMs:Date.now()-started,bytes:total};
}

async function logs(container,tail=250){
  if(!container)return "";
  try{
    const raw=await container.logs({stdout:true,stderr:true,tail});
    return decodeDockerBuffer(Buffer.from(raw));
  }catch(_){return "";}
}


async function execStreaming(container,cmd,{onLine=null,timeoutMs=420000}={}){
 const execution=await container.exec({AttachStdout:true,AttachStderr:true,Cmd:cmd});
 const stream=await execution.start({hijack:true,stdin:false});
 const chunks=[];let pending="";let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;try{stream.destroy(new Error("Container exec timeout"))}catch(_){}},timeoutMs);
 stream.on("data",chunk=>{
   const b=Buffer.from(chunk);chunks.push(b);const text=decodeDockerBuffer(b);if(!text)return;
   pending+=text;const lines=pending.split(/\r?\n/);pending=lines.pop()||"";
   if(onLine)for(const line of lines)if(line.trim())Promise.resolve(onLine(line)).catch(()=>{});
 });
 try{await new Promise((resolve,reject)=>{stream.on("end",resolve);stream.on("close",resolve);stream.on("error",reject)})}finally{clearTimeout(timer)}
 if(pending.trim()&&onLine)await Promise.resolve(onLine(pending));
 if(timedOut)throw new Error(`Container exec exceeded ${Math.round(timeoutMs/1000)} seconds`);
 const info=await execution.inspect();
 return {code:info.ExitCode,out:decodeDockerBuffer(Buffer.concat(chunks))};
}

module.exports={exec,execStreaming,waitDb,importSql,logs,decodeDockerBuffer};
