const theme=require("./theme");
const {csrfToken}=require("./security");

function esc(s){
  return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function baseCss(){return `
:root{
  --bg:#f7f7f5;--fg:#111;--muted:#686868;--line:#deded8;--brand:#111;
  --panel:rgba(255,255,255,.68);--panel-solid:#fff;--radius:20px;--radius-sm:13px;
  --shadow:0 18px 55px rgba(20,20,20,.07);--focus:0 0 0 3px rgba(17,17,17,.12)
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit}
button,input,select,textarea{font:inherit}
button,a,input,select,textarea{outline:none}
button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{box-shadow:var(--focus)}
.ambient{position:fixed;border-radius:999px;filter:blur(100px);opacity:.10;pointer-events:none;z-index:-1}.a1{width:440px;height:440px;background:#8d7cff;right:-130px;top:-140px}.a2{width:380px;height:380px;background:#58c9ad;left:-150px;bottom:-110px}
.wrap{max-width:1180px;margin:auto;padding:24px 24px 54px}
.top{display:flex;align-items:center;min-height:58px;border-bottom:1px solid var(--line);padding:0 0 18px;gap:20px}
.brand{font-weight:850;letter-spacing:.12em;font-size:14px;white-space:nowrap}.brand span{font-weight:550;opacity:.72}
.public-nav{display:flex;gap:5px;margin-left:auto;flex-wrap:wrap;align-items:center}.public-nav a{color:inherit;text-decoration:none;font-size:13px;font-weight:650;padding:9px 12px;border-radius:999px;transition:background .16s ease,color .16s ease,border-color .16s ease}.public-nav a:hover{background:rgba(0,0,0,.055)}
.hero{padding:92px 0 52px;max-width:950px}.hero h1{font-size:clamp(50px,8vw,92px);line-height:.92;letter-spacing:-.058em;margin:.12em 0 .2em;font-weight:850}.hero p{font-size:20px;color:var(--muted);max-width:735px;line-height:1.58;margin:0 0 26px}
.eyebrow,.label{font-size:11px;text-transform:uppercase;letter-spacing:.14em;font-weight:850}.label{color:var(--muted)}
h1,h2,h3{letter-spacing:-.025em}h2{line-height:1.12}p{line-height:1.55}
.btn{appearance:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;background:var(--brand);color:#fff;text-decoration:none;padding:13px 19px;min-height:46px;border-radius:999px;font-weight:760;cursor:pointer;transition:transform .16s ease,opacity .16s ease,background .16s ease,border-color .16s ease}.btn:hover{transform:translateY(-1px);opacity:.92}.btn:active{transform:translateY(0)}.btn.secondary{background:transparent;color:var(--fg);border-color:var(--line)}.btn.secondary:hover{background:rgba(0,0,0,.035)}
.actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.card{border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(12px);padding:24px;border-radius:var(--radius);margin:16px 0;box-shadow:var(--shadow)}.card>h2:first-child,.card>h3:first-child{margin-top:0}.card .muted:last-child{margin-bottom:0}
.muted,.sub{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}.stat{font-size:31px;font-weight:850;letter-spacing:-.04em}.value{font-size:18px;font-weight:730;word-break:break-word}
.kpirow{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
.badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:730;letter-spacing:.01em;background:rgba(255,255,255,.35)}
.progress-shell{height:9px;background:rgba(0,0,0,.075);border-radius:99px;overflow:hidden;margin:21px 0 18px}.progress-fill{height:100%;width:10%;background:var(--brand);border-radius:99px;transition:width .5s ease}
.steps{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:18px 0}.step{position:relative;border:1px solid var(--line);padding:12px 12px 12px 14px;border-radius:var(--radius-sm);font-size:11px;font-weight:680;color:var(--muted);background:rgba(255,255,255,.22);transition:.2s ease}.step.active{border-color:var(--fg);color:var(--fg);font-weight:790;background:rgba(255,255,255,.62)}.step.done{background:var(--fg);border-color:var(--fg);color:var(--bg)}
.credential-grid{display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px}.credential{border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px;min-width:0;background:rgba(255,255,255,.28)}.credential span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.10em;font-weight:800;margin-bottom:8px}.credential code{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px;font-weight:650}.credential button{margin-top:9px;border:0;background:transparent;padding:0;text-decoration:none;cursor:pointer;color:inherit;font-size:11px;font-weight:780;opacity:.72}.credential button:hover{opacity:1;text-decoration:underline}
.live-dot{display:inline-flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;font-weight:700}.live-dot i{width:8px;height:8px;border-radius:50%;background:#43c77b;box-shadow:0 0 0 5px rgba(67,199,123,.13)}
.terminal{background:#09090b;color:#d9f8df;border:1px solid #2b2b31;border-radius:var(--radius-sm);padding:15px;min-height:180px;max-height:390px;overflow:auto;font:12px/1.58 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;word-break:break-word}.logs-grid{grid-template-columns:repeat(auto-fit,minmax(340px,1fr))}
.publicfooter{padding:52px 0 4px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);margin-top:48px}
@media(max-width:760px){.wrap{padding:16px 16px 38px}.top{display:grid;grid-template-columns:1fr}.public-nav{margin:4px 0 0;overflow:auto;flex-wrap:nowrap;padding-bottom:2px;scrollbar-width:none}.public-nav::-webkit-scrollbar{display:none}.public-nav a{flex:0 0 auto}.hero{padding:60px 0 34px}.hero h1{font-size:clamp(46px,15vw,70px)}.hero p{font-size:17px}.actions{display:grid}.actions .btn,.actions button.btn,.actions a.btn{width:100%}.steps{grid-template-columns:1fr 1fr}.credential-grid{grid-template-columns:1fr}.logs-grid{grid-template-columns:1fr}.card{padding:19px;border-radius:17px}}
`}

function publicPage(title,body){
  const t=theme.load(),c=t.config;
  const desc=c.meta?.description||"Launch a private disposable WordPress demo.";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(desc)}"><meta name="color-scheme" content="light dark"><title>${esc(title)} · ${esc(c.meta?.titleSuffix||c.name||"DemoPress")}</title><style>${baseCss()}\n${t.css}</style></head><body><div class="ambient a1"></div><div class="ambient a2"></div><div class="wrap"><header class="top"><a class="brand" href="/" style="text-decoration:none">${esc(c.brandLabel||"DEMOPRESS")} <span>${esc(c.brandSubLabel||"")}</span></a><nav class="public-nav" aria-label="Primary">${c.links?.website?`<a href="${esc(c.links.website)}">Site</a>`:""}${c.links?.docs?`<a href="${esc(c.links.docs)}">Docs</a>`:""}${c.links?.github?`<a href="${esc(c.links.github)}">GitHub</a>`:""}${c.showStatusLink!==false?`<a href="/status">Status</a>`:""}</nav></header><main>${body}</main><footer class="publicfooter">Private disposable environments · Powered by DemoPress</footer></div></body></html>`;
}

function injectCsrf(body){
  const token=esc(csrfToken());
  return String(body).replace(/<form\b([^>]*)method=["']post["']([^>]*)>/gi,m=>`${m}<input type="hidden" name="_csrf" value="${token}">`);
}

function flashScript(){return `<script>(function(){const q=new URLSearchParams(location.search),saved=q.get('saved'),error=q.get('error');if(!saved&&!error)return;const n=document.createElement('div');n.className='flash '+(error?'flash-error':'flash-success');n.setAttribute('role','status');n.innerHTML='<div class="flash-icon">'+(error?'!':'✓')+'</div><div><strong>'+(error?'Could not save':'Changes saved')+'</strong><span></span></div><button type="button" aria-label="Dismiss">×</button>';n.querySelector('span').textContent=error||saved;n.querySelector('button').onclick=()=>n.remove();const h=document.querySelector('header.top');h.insertAdjacentElement('afterend',n);setTimeout(()=>{if(n.isConnected)n.remove()},6000);})();</script>`}

function adminScript(){return `<script>(function(){const p=location.pathname;document.querySelectorAll('.manager-nav a').forEach(a=>{const h=a.getAttribute('href');if(h==='/manage'?p==='/manage'||p==='/manage/':p===h||p.startsWith(h+'/'))a.classList.add('active')});})();</script>`}

function adminPage(title,body){
  const content=injectCsrf(body);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(title)} · DemoPress Manager</title><style>${baseCss()}
body{background:#101012;color:#f6f6f4;--fg:#f6f6f4;--muted:#a7a7ae;--line:#2c2c31;--brand:#f6f6f4;--panel:#17171a;--panel-solid:#17171a;--shadow:0 18px 55px rgba(0,0,0,.18);--focus:0 0 0 3px rgba(255,255,255,.14)}
.ambient{display:none}.wrap{max-width:1240px}.top{position:sticky;top:0;z-index:40;background:rgba(16,16,18,.92);backdrop-filter:blur(14px);padding-top:14px}.brand{font-size:13px}.brand span{color:#8f8f98}.manager-nav{gap:3px}.manager-nav a{color:#aaaab0}.manager-nav a:hover{background:#1c1c20;color:#fff}.manager-nav a.active{background:#f1f1ef;color:#111}
main{padding-top:18px}.btn{background:#f6f6f4;color:#101012;border-color:#f6f6f4}.btn:hover{background:#fff}.btn.secondary{background:#232327;color:#f6f6f4;border-color:#45454d}.btn.secondary:hover{background:#2d2d32;border-color:#5b5b63}.card{background:#17171a;backdrop-filter:none;border-color:#29292e;box-shadow:0 14px 38px rgba(0,0,0,.12)}
.success{color:#8ee5a8}.danger{color:#ff9c9c}.warn{color:#ffdc65}
table{width:100%;border-collapse:separate;border-spacing:0}td,th{text-align:left;padding:12px 11px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.10em;color:#85858d;font-weight:800;white-space:nowrap}tbody tr{transition:background .14s ease}tbody tr:hover{background:#1b1b1f}tbody tr:last-child td{border-bottom:0}
input,select,textarea{background:#101012;color:#fff;border:1px solid #34343a;padding:11px 12px;border-radius:10px;width:100%;margin-top:7px;transition:border-color .15s ease,background .15s ease}input:hover,select:hover,textarea:hover{border-color:#46464e}input:focus,select:focus,textarea:focus{border-color:#666672;background:#131316}textarea{min-height:110px;resize:vertical}label{display:block;margin:14px 0;font-size:13px;font-weight:680}.fieldhint{display:block;color:var(--muted);font-size:11px;font-weight:500;line-height:1.45;margin-top:6px}.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:13px}.tablewrap table td:first-child,.tablewrap table th:first-child{padding-left:14px}.tablewrap table td:last-child,.tablewrap table th:last-child{padding-right:14px}
.badge{background:#1d1d21}.mini{padding:7px 10px;min-height:34px;font-size:11px}.formgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:5px 18px}.crumb{margin:4px 0 22px;color:var(--muted);font-size:12px}.crumb a{color:#d7d7dc;text-decoration:none}.crumb a:hover{text-decoration:underline}.barrow{display:grid;grid-template-columns:120px 1fr 80px;align-items:center;gap:12px;margin:13px 0}.bar{height:8px;background:#29292e;border-radius:99px;overflow:hidden}.bar i{display:block;height:100%;background:#f6f6f4;border-radius:99px}.notice{border:1px solid #3d3d44;background:#1b1b1f;padding:14px 16px;border-radius:12px;color:#d9d9dd}.terminal{box-shadow:inset 0 1px rgba(255,255,255,.03)}
.flash{position:sticky;top:78px;z-index:50;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;margin:14px 0;padding:12px 14px;border:1px solid;border-radius:12px;box-shadow:0 15px 35px rgba(0,0,0,.24)}.flash strong{display:block;font-size:12px}.flash span{display:block;font-size:11px;margin-top:2px;opacity:.84}.flash-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;font-weight:900}.flash-success{background:#122419;border-color:#286c3d;color:#c9f5d4}.flash-success .flash-icon{background:#1f5730}.flash-error{background:#2b1515;border-color:#8b3434;color:#ffd0d0}.flash-error .flash-icon{background:#642626}.flash button{border:0;background:transparent;color:inherit;font-size:20px;cursor:pointer;opacity:.7}.flash button:hover{opacity:1}
@media(max-width:980px){.top{display:block;position:relative}.manager-nav{margin:14px 0 0;overflow-x:auto;flex-wrap:nowrap;padding-bottom:3px;scrollbar-width:none}.manager-nav::-webkit-scrollbar{display:none}.manager-nav a{flex:0 0 auto}.barrow{grid-template-columns:90px 1fr 65px}.flash{top:10px}}
</style></head><body><div class="wrap"><header class="top"><a class="brand" href="/manage" style="text-decoration:none">DEMOPRESS <span>MANAGER</span></a><nav class="public-nav manager-nav" aria-label="Manager"><a href="/manage">Overview</a><a href="/manage/setup">Setup</a><a href="/manage/profile">Profile</a><a href="/manage/template">Template</a><a href="/manage/demos">Demos</a><a href="/manage/analytics">Analytics</a><a href="/manage/diagnostics">Diagnostics</a><a href="/manage/system">System</a><a href="/manage/settings">Settings</a></nav></header><main>${content}</main>${flashScript()}${adminScript()}</div></body></html>`;
}

module.exports={esc,publicPage,adminPage};
