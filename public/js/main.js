/* ---------- التوجيه والتشغيل ---------- */
async function route(){const[p,a]=(location.hash.slice(2)||'').split('/');scrollTo(0,0);
  document.querySelectorAll('nav>a').forEach(l=>l.classList.toggle('on',l.dataset.n===p));
  ({stores,s:()=>dash(a),pay:()=>pay(a),rate:()=>rate(a),invoice:()=>invoicePage(a),admin,terms,team}[p]||home)();}
(async()=>{try{ME=await api('/me')}catch{}try{CFG=await api('/config')}catch{}nav();route();addEventListener('hashchange',route)})();
