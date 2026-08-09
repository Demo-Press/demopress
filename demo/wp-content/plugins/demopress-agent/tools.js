(function(){
  if(typeof DemoPressAgent==='undefined')return;
  async function call(path,opts={}){
    opts.headers=Object.assign({'X-WP-Nonce':DemoPressAgent.nonce},opts.headers||{});
    const r=await fetch(DemoPressAgent.rest+path,opts);
    return r.json();
  }
  async function refreshSession(){
    const el=document.getElementById('demopress-session');
    if(!el)return;
    try{
      const x=await call('session');
      if(x&&x.success&&x.expiresAt){
        const mins=Math.max(0,Math.ceil((x.expiresAt*1000-Date.now())/60000));
        el.textContent='Demo expires in about '+mins+' minute'+(mins===1?'':'s')+'.';
      }else el.textContent='Temporary DemoPress environment.';
    }catch(e){el.textContent='Temporary DemoPress environment.';}
  }
  document.addEventListener('click',async function(e){
    if(e.target&&e.target.id==='demopress-reset'){
      if(!confirm('Reset this demo? All changes in this temporary site will be lost.'))return;
      e.target.disabled=true;e.target.textContent='Resetting…';
      try{await call('reset',{method:'POST'});location.reload();}catch(err){e.target.disabled=false;e.target.textContent='Reset Demo';}
    }
  });
  refreshSession();
  setInterval(()=>call('heartbeat',{method:'POST'}).catch(()=>{}),60000);
})();
