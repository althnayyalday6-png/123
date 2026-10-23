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

