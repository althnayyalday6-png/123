const $=s=>document.querySelector(s),app=$('#app');let ME=null,CFG={};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2800)};
const readImg=f=>new Promise((ok,no)=>{if(!f)return ok('');if(f.size>1.8e6)return no(new Error('الصورة أكبر من 1.8MB'));const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(f)});
const ST={awaiting_payment:'بانتظار الدفع',pending:'بانتظار القبول',accepted:'مقبول',rejected:'مرفوض',delivered:'تم التسليم'};
const STY=[['Primary','أزرق','#5865f2'],['Secondary','رمادي شفاف','#4e5058'],['Success','أخضر','#248046'],['Danger','أحمر','#da373c']];
const need=()=>{app.innerHTML=`<div class="c" style="padding:80px 0"><img src="img/logo.png" width="110"><h1 style="margin:16px 0">سجّل دخولك أولاً</h1><p class="mut" style="margin-bottom:20px">اربط حساب ديسكورد للمتابعة.</p><button class="btn" onclick="doLogin(location.hash)">ربط حساب ديسكورد</button></div>`};
const modal=h=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="card">${h}</div>`;m.onclick=e=>{if(e.target===m)m.remove()};document.body.append(m);return m};
const guard=f=>async(...a)=>{try{await f(...a)}catch(e){toast(e.message)}};
const sw=(id,label,on)=>`<label class="sw"><span>${label}</span><input type="checkbox" id="${id}" ${on?'checked':''}><i></i></label>`;

function nav(){
  $('#nav').innerHTML=ME?`<div class="av"><img src="${esc(ME.avatarUrl)}" id="avb"><div class="menu" id="menu"><b>${esc(ME.username)}</b><a href="#/stores">لوحة التحكم</a>${ME.isOwner?'<a href="#/admin">إدارة المنصة</a>':''}<button id="out">تسجيل خروج</button></div></div>`
   :`<button class="btn sm" id="lg">ربط حساب ديسكورد</button>`;
  if(ME){$('#avb').onclick=e=>{e.stopPropagation();$('#menu').classList.toggle('on')};$('#out').onclick=doLogout}else $('#lg').onclick=()=>doLogin(location.hash);
  $('#ann').innerHTML=CFG.announce?`<div class="ann">📢 ${esc(CFG.announce)}</div>`:'';
  $('#foot').innerHTML=CFG.support?`<a class="btn disc" href="${esc(CFG.support)}" target="_blank" rel="noopener">💬 تواصل معنا على ديسكورد</a>`:'';
}
document.addEventListener('click',()=>$('#menu')?.classList.remove('on'));


/* ---- أدوات مشتركة v4 ---- */
const PM={pending:'تم استلام الإيصال، بانتظار قبول التاجر ⏳',accepted:'✅ تم قبول طلبك، بانتظار تسليم المنتج',delivered:'🎉 تم تسليم المنتج! تفقد رسائلك الخاصة',rejected:'❌ تم رفض الطلب، تواصل مع التاجر'};
function live(fn,ms=1000){clearInterval(window.__live);let busy=0;window.__live=setInterval(async()=>{if(busy)return;busy=1;try{await fn()}catch(e){}busy=0},ms)}
const lockPage=m=>{clearInterval(window.__live);app.innerHTML=`<div class="card st lock"><div class="big">🔒</div><h2 style="margin:14px 0">${esc(m)}</h2><p class="mut" style="margin-bottom:24px">جدّد اشتراكك في باقة Orbit لتعود لوحة التحكم وكل الخدمات للعمل فوراً.</p><a class="btn lg" href="#/plan">تجديد الاشتراك</a></div>`};
const cp=(l,v)=>v?`<label>${l}</label><div class="code" data-c="${esc(v)}">${esc(v)}</div>`:'';
const methodCard=m=>`<div class="card st" style="margin-bottom:12px"><h3>${esc(m.name)}</h3>${cp('البنك',m.bank)}${cp('اسم المستفيد',m.beneficiary)}${cp('الآيبان',m.iban)}${m.accountOn?cp('رقم الحساب',m.account):''}${m.phoneOn?cp('رقم الجوال',m.phone):''}${m.linkOn&&m.link?`<br><a class="btn sm" target="_blank" rel="noopener" href="${esc(m.link)}">فتح رابط الدفع</a>`:''}${m.qr?`<div class="c"><br><img class="qr" src="${esc(m.qr)}"></div>`:''}</div>`;
const bindCopy=r=>r.querySelectorAll('[data-c]').forEach(e=>e.onclick=()=>{navigator.clipboard?.writeText(e.dataset.c);toast('تم النسخ')});
const avt=m=>m.avatarUrl?`<img src="${esc(m.avatarUrl)}" alt="">`:`<div class="sg big">${esc((m.username||'?')[0])}</div>`;
const fmtD=t=>new Date(t).toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'});
