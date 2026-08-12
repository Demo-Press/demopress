const crypto=require("crypto");
const config=require("./config");
const {csrfToken,validCsrf}=require("./security");

const COOKIE="demopress_manager";
const SESSION_SECONDS=12*60*60;
const failures=new Map();

function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function configured(){const p=String(config.adminPassword||"");return Boolean(p&&p!=="change-me-now"&&p!=="REPLACE_WITH_A_LONG_RANDOM_PASSWORD");}
function secret(){return crypto.createHash("sha256").update(`demopress-manager-session-v2\0${String(config.adminPassword||"")}`).digest();}
function sign(value){return crypto.createHmac("sha256",secret()).update(value).digest("base64url");}
function safeEqual(a,b){const x=Buffer.from(String(a||"")),y=Buffer.from(String(b||""));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
function parseCookies(req){const out={};for(const bit of String(req.headers.cookie||"").split(";")){const i=bit.indexOf("=");if(i<1)continue;try{out[bit.slice(0,i).trim()]=decodeURIComponent(bit.slice(i+1).trim());}catch(_){}}return out;}
function secureRequest(req){return String(req.headers["x-forwarded-proto"]||"").split(",")[0].trim()==="https"||req.secure;}
function cookie(value,maxAge,req){return `${COOKIE}=${encodeURIComponent(value)}; Path=/manage; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureRequest(req)?"; Secure":""}`;}
function issueSession(req,res){const payload=`${Math.floor(Date.now()/1000)+SESSION_SECONDS}.${crypto.randomBytes(18).toString("base64url")}`;res.setHeader("Set-Cookie",cookie(`${payload}.${sign(payload)}`,SESSION_SECONDS,req));}
function clearSession(req,res){res.setHeader("Set-Cookie",cookie("",0,req));}
function validSession(req){const raw=parseCookies(req)[COOKIE]||"",parts=raw.split(".");if(parts.length!==3)return false;const payload=`${parts[0]}.${parts[1]}`;if(!safeEqual(parts[2],sign(payload)))return false;const exp=Number(parts[0]);return Number.isFinite(exp)&&exp>Math.floor(Date.now()/1000);}
function ip(req){return String(req.headers["x-forwarded-for"]||req.socket?.remoteAddress||"").split(",")[0].trim();}
function rateState(req){const key=ip(req),now=Date.now(),windowMs=15*60*1000;let row=failures.get(key);if(!row||now-row.started>windowMs){row={started:now,count:0};failures.set(key,row);}return row;}
function blocked(req){return rateState(req).count>=8;}
function failure(req){rateState(req).count++;}
function success(req){failures.delete(ip(req));}
function safeReturn(value){const v=String(value||"");return /^\/manage(?:\/|$)/.test(v)&&!v.startsWith("//")?v:"/manage";}

function loginPage(message="",returnTo="/manage"){
 const disabled=!configured();
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow"><title>Sign in · DemoPress Manager</title><style>
 *{box-sizing:border-box}html,body{min-height:100%;margin:0}body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0d0d0f;color:#f6f6f4;display:grid;place-items:center;padding:24px;-webkit-font-smoothing:antialiased}.glow{position:fixed;width:520px;height:520px;border-radius:50%;background:#5048e5;filter:blur(150px);opacity:.13;top:-250px;right:-170px;pointer-events:none}.shell{width:min(100%,440px);position:relative}.brand{font-size:13px;font-weight:850;letter-spacing:.13em;margin-bottom:28px}.brand span{color:#8d8d96;font-weight:600}.card{border:1px solid #29292f;background:#161619;border-radius:22px;padding:30px;box-shadow:0 30px 80px rgba(0,0,0,.34)}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#9999a2;font-weight:850}.card h1{font-size:34px;letter-spacing:-.045em;margin:8px 0 8px}.sub{color:#a5a5ad;font-size:14px;line-height:1.55;margin:0 0 24px}label{display:block;font-size:12px;font-weight:750;margin:0 0 18px}input{font:inherit;width:100%;margin-top:8px;background:#0e0e10;color:#fff;border:1px solid #37373e;border-radius:12px;padding:13px 14px;min-height:48px;outline:0}input:focus{border-color:#777784;box-shadow:0 0 0 3px rgba(255,255,255,.07)}button{font:inherit;width:100%;min-height:48px;border:0;border-radius:999px;background:#f5f5f2;color:#111;font-weight:800;cursor:pointer}button:hover{background:#fff}.notice{margin:0 0 18px;border:1px solid #843b3b;background:#2b1617;color:#ffd2d2;border-radius:12px;padding:12px 14px;font-size:12px;line-height:1.5}.foot{color:#72727b;font-size:11px;text-align:center;margin-top:18px;line-height:1.5}.back{display:inline-block;color:#aaaab2;text-decoration:none;font-size:12px;margin-bottom:14px}.back:hover{color:#fff}.lock{width:42px;height:42px;border-radius:12px;background:#232329;display:grid;place-items:center;margin-bottom:18px;font-size:18px}@media(max-width:520px){body{padding:16px}.card{padding:23px;border-radius:18px}.card h1{font-size:30px}}
 </style></head><body><div class="glow"></div><main class="shell"><div class="brand">DEMOPRESS <span>MANAGER</span></div><a class="back" href="/">← Return to demo launcher</a><section class="card"><div class="lock">⌁</div><div class="eyebrow">Protected administration</div><h1>Welcome back.</h1><p class="sub">Sign in to manage templates, demos, visitor capture, analytics and platform settings.</p>${message?`<div class="notice" role="alert">${esc(message)}</div>`:""}${disabled?`<div class="notice">ADMIN_PASSWORD is not configured securely. Set a strong Manager password before signing in.</div>`:`<form method="post" action="/manage/login"><input type="hidden" name="_csrf" value="${esc(csrfToken())}"><input type="hidden" name="return_to" value="${esc(safeReturn(returnTo))}"><label>Manager password<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Sign in to Manager →</button></form>`}</section><div class="foot">Session cookies are HTTP-only, SameSite protected and expire automatically after 12 hours.</div></main></body></html>`;
}

function loginGet(req,res){res.set("Cache-Control","no-store");if(validSession(req))return res.redirect(safeReturn(req.query.return_to));res.status(configured()?200:503).send(loginPage("",req.query.return_to));}
function loginPost(req,res){res.set("Cache-Control","no-store");if(!configured())return res.status(503).send(loginPage("Manager authentication is not configured securely.",req.body?.return_to));if(!validCsrf(req.body?._csrf))return res.status(403).send(loginPage("Your sign-in form expired. Please try again.",req.body?.return_to));if(blocked(req))return res.status(429).send(loginPage("Too many failed sign-in attempts. Please wait 15 minutes and try again.",req.body?.return_to));const supplied=String(req.body?.password||"");if(!safeEqual(supplied,String(config.adminPassword))){failure(req);return res.status(401).send(loginPage("The password you entered is incorrect.",req.body?.return_to));}success(req);issueSession(req,res);res.redirect(safeReturn(req.body?.return_to));}
function logout(req,res){clearSession(req,res);res.redirect("/manage/login");}
function requireAuth(req,res,next){res.set("Cache-Control","no-store, max-age=0");if(!configured())return res.status(503).send(loginPage("Manager authentication is not configured securely.",req.originalUrl));if(validSession(req))return next();const target=encodeURIComponent(safeReturn(req.originalUrl));res.redirect(`/manage/login?return_to=${target}`);}

module.exports={requireAuth,loginGet,loginPost,logout,validSession};
