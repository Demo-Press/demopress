const profile=require("./profile");const config=require("./config");const {csrfToken}=require("./security");const {esc}=require("./helpers");
function adminNav(active){
 const items=[["overview","Dashboard","/manage"],["demos","Demos","/manage/demos"],["template","Template","/manage/template"],["diagnostics","Diagnostics","/manage/diagnostics"],["analytics","Analytics","/manage/analytics"],["system","System","/manage/system"],["setup","Setup","/manage/setup"],["profile","Profile","/manage/profile"],["settings","Settings","/manage/settings"]];
 return `<aside class="side"><div class="logo">DEMOPRESS<span>MANAGER</span></div>${items.map(([k,l,u])=>`<a class="${active===k?"active":""}" href="${u}">${l}</a>`).join("")}<div class="foot"><a href="/">View Launcher</a><a href="https://${profile.templateDomain}" target="_blank" rel="noopener">View Template</a><a href="/health">Health</a>${config.githubUrl?`<a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">GitHub</a>`:""}<a href="https://demopress.co.uk" target="_blank" rel="noopener">DemoPress.co.uk</a></div></aside>`;
}
function css(){return `<style>
:root{color-scheme:dark;--bg:#070707;--p:#111;--p2:#161616;--line:#2a2a30;--muted:#9999a3;--green:#76e59e;--amber:#f3cc73;--red:#ff8e8e}
*{box-sizing:border-box}body{margin:0;background:#080808;color:#fafafa;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif}a{color:inherit}.wrap{max-width:1140px;margin:auto;padding:30px 20px 70px}.top{display:flex;justify-content:space-between}.brand{font-weight:900;letter-spacing:.13em}.brand span,.logo span{display:block;font-weight:400;color:#888;font-size:10px;letter-spacing:.18em}.hero{padding:80px 0 48px;max-width:850px}.eyebrow,.label{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#85858f}.hero h1{font-size:clamp(48px,8vw,84px);line-height:.96;letter-spacing:-.06em;margin:16px 0}.hero p,.muted{color:var(--muted)}.hero p{font-size:19px;line-height:1.65}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{background:var(--p);border:1px solid var(--line);border-radius:17px;padding:21px}.stat{font-size:31px;font-weight:900;letter-spacing:-.04em}.success{color:var(--green)}.warn{color:var(--amber)}.danger{color:var(--red)}
.btn{background:#fff;color:#050505;border:0;border-radius:12px;padding:13px 18px;font-weight:800;text-decoration:none;display:inline-flex;cursor:pointer}.btn.secondary{background:#18181b;color:#fff;border:1px solid #35353b}.btn.red{background:#2d1212;color:#ffd8d8;border:1px solid #642828}.mini{padding:8px 10px;font-size:12px;border-radius:9px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}
.admin{display:grid;grid-template-columns:230px 1fr;min-height:100vh}.side{border-right:1px solid var(--line);padding:25px 17px;position:sticky;top:0;height:100vh}.logo{font-weight:900;letter-spacing:.1em;margin-bottom:26px}.side>a,.foot a{display:block;padding:11px 12px;border-radius:9px;text-decoration:none;color:#aaa}.side>a.active,.side>a:hover,.foot a:hover{background:#17171a;color:#fff}.foot{position:absolute;bottom:20px;left:17px;right:17px;border-top:1px solid var(--line);padding-top:10px}.main{padding:34px;max-width:1450px}.main h1{font-size:38px;letter-spacing:-.04em;margin:0 0 6px}.sub{color:#999;margin-bottom:28px}.crumb{color:#8d8d96;font-size:13px;margin-bottom:18px}.crumb a{text-decoration:none}.tablewrap{overflow:auto;border:1px solid var(--line);border-radius:15px}table{border-collapse:collapse;width:100%;min-width:920px}th,td{padding:13px 14px;border-bottom:1px solid var(--line);text-align:left;font-size:13px}th{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#85858f}.log{white-space:pre-wrap;background:#030303;border:1px solid #25252a;border-radius:13px;padding:16px;color:#bbb;max-height:520px;overflow:auto;font-family:monospace}.notice{background:#121216;border:1px solid #303038;border-radius:14px;padding:16px}.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:15px}input,select{width:100%;background:#111;color:#fff;border:1px solid #333;border-radius:9px;padding:11px}.progress{height:8px;background:#222;border-radius:99px;overflow:hidden;margin:22px 0}.progress div{height:100%;background:#fff;transition:width .35s ease}.steps{display:grid;gap:10px;margin:24px 0}.step{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#0e0e10;color:#777}.step.done{color:#fff}.step.active{color:#fff;border-color:#555}.stepdot{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#222;font-size:12px}.step.done .stepdot{background:#fff;color:#000}.step.active .stepdot{border:2px solid #fff;background:transparent}.value{font-size:18px;font-weight:800;margin-top:7px;word-break:break-word}.kpirow{display:flex;justify-content:space-between;gap:14px;align-items:center}.badge{display:inline-flex;padding:5px 8px;border:1px solid var(--line);border-radius:99px;font-size:11px;color:#aaa}.barrow{display:grid;grid-template-columns:120px 1fr 80px;gap:12px;align-items:center;margin:10px 0}.bar{height:9px;background:#222;border-radius:99px;overflow:hidden}.bar>i{display:block;height:100%;background:#fff}.tips{min-height:42px}.codeblock{white-space:pre-wrap;background:#030303;border:1px solid #25252a;border-radius:13px;padding:16px;color:#bbb;font-family:monospace}.spinner{width:54px;height:54px;border:4px solid #26262b;border-top-color:#fff;border-radius:50%;animation:s .8s linear infinite;margin:25px 0}@keyframes s{to{transform:rotate(360deg)}}@media(max-width:850px){.grid,.formgrid{grid-template-columns:1fr}.admin{grid-template-columns:1fr}.side{height:auto;position:relative}.foot{position:static}.main{padding:22px}}

@media (max-width: 820px){
  body{overflow-x:hidden}
  .shell{display:block}
  .sidebar{
    position:sticky;
    top:0;
    width:100%;
    height:auto;
    min-height:0;
    padding:10px 12px;
    z-index:50;
    border-right:0;
    border-bottom:1px solid var(--line);
    background:#08080a;
  }
  .brand{
    margin:0 0 9px;
    padding:0 2px;
    font-size:15px;
  }
  .nav{
    display:flex;
    gap:7px;
    overflow-x:auto;
    overscroll-behavior-x:contain;
    scrollbar-width:none;
    padding-bottom:2px;
  }
  .nav::-webkit-scrollbar{display:none}
  .nav a{
    flex:0 0 auto;
    white-space:nowrap;
    padding:9px 11px;
    border-radius:9px;
    font-size:12px;
  }
  .main{
    margin-left:0!important;
    width:100%!important;
    max-width:100%!important;
    padding:18px 14px 34px!important;
  }
  h1{font-size:27px;line-height:1.1}
  h2{font-size:19px;margin-top:26px}
  .sub{font-size:13px}
  .grid{
    grid-template-columns:1fr!important;
    gap:10px;
  }
  .card{
    min-width:0;
    padding:15px;
  }
  .stat{font-size:29px}
  .kpirow{
    align-items:flex-start;
    flex-direction:column;
    gap:10px;
  }
  .actions{
    width:100%;
    display:flex;
    flex-wrap:wrap;
    gap:8px;
  }
  .actions form{
    flex:1 1 auto;
    min-width:0;
  }
  .actions .btn,
  .actions button.btn,
  .actions a.btn{
    min-height:42px;
  }
  .actions form .btn{
    width:100%;
  }
  .tablewrap{
    width:100%;
    max-width:100%;
    overflow-x:auto;
    -webkit-overflow-scrolling:touch;
    border-radius:12px;
  }
  table{
    min-width:720px;
    font-size:12px;
  }
  th,td{
    padding:10px 9px;
    white-space:nowrap;
  }
  .barrow{
    grid-template-columns:92px minmax(90px,1fr) 62px;
    gap:8px;
    font-size:12px;
  }
  .log,.codeblock{
    max-width:100%;
    overflow:auto;
    font-size:11px;
    line-height:1.45;
    padding:12px;
    border-radius:10px;
  }
  .formgrid{
    grid-template-columns:1fr!important;
  }
  input,select,textarea{
    width:100%;
    max-width:100%;
    font-size:16px;
  }
  .notice{font-size:13px;padding:13px}
  .crumb{
    overflow-x:auto;
    white-space:nowrap;
    padding-bottom:3px;
  }
  .badge{
    max-width:100%;
    white-space:normal;
  }
}

@media (max-width: 480px){
  .main{padding:15px 10px 28px!important}
  .sidebar{padding-left:10px;padding-right:10px}
  h1{font-size:24px}
  .actions{
    display:grid;
    grid-template-columns:1fr 1fr;
  }
  .actions .btn,
  .actions button.btn,
  .actions a.btn{
    width:100%;
    text-align:center;
    justify-content:center;
  }
  .actions form{width:100%}
  .actions > *:only-child{grid-column:1 / -1}
  .stat{font-size:26px}
  .value{font-size:15px}
  .barrow{
    grid-template-columns:78px minmax(70px,1fr) 55px;
  }
}


.btn:disabled{opacity:.45;cursor:not-allowed}
.empty{padding:30px;text-align:center;color:#888}
.tablewrap table a{white-space:nowrap}
@media (max-width:480px){
  .actions{grid-template-columns:1fr!important}
  .actions > *{grid-column:1/-1}
  .actions form{margin:0}
  .btn.mini{min-height:38px}
}


.fieldhint{display:block;margin-top:6px;color:#777;font-size:12px;line-height:1.45}
.fieldok{color:#7ee787}.fielderror{color:#ff7b72}
.toast{position:fixed;right:20px;top:20px;z-index:9999;max-width:420px;background:#151518;border:1px solid #34343b;color:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 12px 35px rgba(0,0,0,.35);display:flex;gap:10px;align-items:flex-start}
.toast.success{border-color:#2f6f44}.toast.error{border-color:#8a3434}.toast strong{display:block;margin-bottom:2px}.toast .muted{font-size:12px}
.setupcheck{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-bottom:1px solid var(--line)}.setupcheck:last-child{border-bottom:0}
.setupdot{width:10px;height:10px;border-radius:50%;background:#555;margin-top:5px;flex:0 0 auto}.setupdot.ok{background:#3fb950}.setupdot.bad{background:#f85149}.setupdot.warn{background:#d29922}
input:invalid,textarea:invalid,select:invalid{border-color:#743a3a}

.publicfooter{margin:42px 0 10px;padding-top:20px;border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;color:#777;font-size:12px}.publicfooter a{color:#aaa;text-decoration:none}.publicfooter a:hover{color:#fff}</style>`}

function publicPage(title,body){
 const favicon=profile.branding&&profile.branding.faviconUrl?`<link rel="icon" href="${esc(profile.branding.faviconUrl)}">`:"";
 const logo=profile.branding&&profile.branding.logoUrl
   ?`<img src="${esc(profile.branding.logoUrl)}" alt="${esc(profile.productName)}" style="max-height:30px;max-width:160px;object-fit:contain">`
   :`DEMOPRESS <span>LIVE DEMO</span>`;
 const github=config.githubUrl?`<a href="${esc(config.githubUrl)}" target="_blank" rel="noopener">GitHub</a>`:"";
 const footer=`<footer class="publicfooter"><span>${esc((profile.branding||{}).footerText||"Powered by DemoPress")}</span><span>${github} <a href="https://demopress.co.uk" target="_blank" rel="noopener">DemoPress.co.uk</a></span></footer>`;
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${favicon}${css()}</head><body><div class="wrap"><div class="top"><div class="brand">${logo}</div><a href="/health" class="muted">Status</a></div>${body}${footer}</div></body></html>`;
}
function adminPage(title,body,active){
 const favicon=profile.branding&&profile.branding.faviconUrl?`<link rel="icon" href="${esc(profile.branding.faviconUrl)}">`:"";
 const token=csrfToken();
 return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${favicon}${css()}</head><body><div class="admin">${adminNav(active)}<main class="main">${body}</main></div><script>(function(){
const t=${JSON.stringify(token)};
document.querySelectorAll('form[method="post"],form[method="POST"]').forEach(function(f){
 if(!f.querySelector('input[name="_csrf"]')){const i=document.createElement("input");i.type="hidden";i.name="_csrf";i.value=t;f.appendChild(i)}
 f.addEventListener("submit",function(){if(!f.checkValidity())return;const b=f.querySelector('button[type="submit"],button:not([type])');if(b){b.disabled=true;b.dataset.old=b.textContent;b.textContent="Saving…"}})
});
const q=new URLSearchParams(location.search),saved=q.get("saved"),error=q.get("error");
if(saved||error){
 const el=document.createElement("div");el.className="toast "+(error?"error":"success");
 const msg=error||saved||"Changes saved.";
 el.innerHTML='<div><strong>'+(error?'Could not save':'Saved successfully')+'</strong><div class="muted"></div></div>';
 el.querySelector(".muted").textContent=msg;
 document.body.appendChild(el);
 setTimeout(()=>el.remove(),4500);
 const u=new URL(location.href);u.searchParams.delete("saved");u.searchParams.delete("error");history.replaceState(null,"",u.pathname+(u.search||""));
}
})();</script></body></html>`;
}
module.exports={publicPage,adminPage};
