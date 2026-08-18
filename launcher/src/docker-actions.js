const fs=require("fs");
const {PassThrough}=require("stream");

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function logs(c,n=300){
  try{
    const raw=await c.logs({stdout:true,stderr:true,tail:n,timestamps:false});
    // Docker returns non-TTY container logs as a multiplexed stream. Converting
    // that buffer directly to a string exposes the 8-byte stream headers as
    // binary garbage in Manager diagnostics. Demultiplex it first.
    if(!raw||!raw.length)return "";
    const stdout=new PassThrough(),stderr=new PassThrough();
    let out="";
    stdout.on("data",d=>out+=d.toString("utf8"));
    stderr.on("data",d=>out+=d.toString("utf8"));
    const source=new PassThrough();
    c.modem.demuxStream(source,stdout,stderr);
    source.end(raw);
    await new Promise(resolve=>{
      let pending=2;
      const done=()=>{if(--pending<=0)resolve()};
      stdout.on("end",done);stderr.on("end",done);
      setImmediate(()=>{stdout.end();stderr.end()});
    });
    return out;
  }catch(_){return ""}
}

/**
 * Execute a command inside a container without trusting Docker's hijacked
 * output stream to signal process completion. A child process can inherit the
 * exec stdout/stderr descriptors and keep that stream open after the actual
 * command has exited, which previously left DemoPress stuck in "finalising"
 * even though WordPress was already healthy.
 *
 * Docker's exec inspect state is the source of truth. Output is still
 * demultiplexed while the command runs, then the stream is closed once Docker
 * reports the exec has finished. The JavaScript-side deadline is a second
 * safety net around commands that already use GNU timeout internally.
 */
async function exec(c,cmd,env=[],options={}){
  const timeoutMs=Math.max(1000,Number(options.timeoutMs||210000));
  const pollMs=Math.max(50,Number(options.pollMs||200));
  const e=await c.exec({Cmd:["sh","-lc",cmd],AttachStdout:true,AttachStderr:true,Env:env});
  const s=await e.start({hijack:true,stdin:false});
  let out="",streamError=null;
  const stdout=new PassThrough(),stderr=new PassThrough();
  stdout.on("data",d=>out+=d.toString());
  stderr.on("data",d=>out+=d.toString());
  stdout.on("error",err=>{streamError=streamError||err});
  stderr.on("error",err=>{streamError=streamError||err});
  s.on("error",err=>{streamError=streamError||err});
  c.modem.demuxStream(s,stdout,stderr);

  const started=Date.now();
  let info=null;
  while(Date.now()-started<timeoutMs){
    info=await e.inspect();
    if(!info.Running)break;
    await sleep(pollMs);
  }

  if(!info||info.Running){
    try{s.destroy()}catch(_){}
    try{stdout.destroy()}catch(_){}
    try{stderr.destroy()}catch(_){}
    return{code:124,out:out+`\nDemoPress Docker exec deadline exceeded after ${Math.round(timeoutMs/1000)}s`};
  }

  // Allow the final demultiplexed bytes (including DEMO CLONE READY) to land
  // before closing a stream that may still be held open by a descendant.
  await sleep(75);
  try{s.destroy()}catch(_){}
  try{stdout.end()}catch(_){}
  try{stderr.end()}catch(_){}
  if(streamError&&out.length===0)out=`Docker exec stream error after process completion: ${streamError.message||streamError}`;
  return{code:info.ExitCode,out};
}

async function startDetached(c,cmd,env=[]){
  const e=await c.exec({Cmd:["sh","-lc",cmd],AttachStdout:false,AttachStderr:false,Env:env});
  await e.start({Detach:true,Tty:false});
  return e;
}

async function importSql(c,root,dbName,file,progress){
  if(!fs.existsSync(file))throw new Error(`Snapshot database file missing: ${file}`);
  const total=fs.statSync(file).size;
  const e=await c.exec({Cmd:["sh","-lc",`mariadb -uroot -p'${root.replace(/'/g,"'\\''")}' ${dbName}`],AttachStdin:true,AttachStdout:true,AttachStderr:true});
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
