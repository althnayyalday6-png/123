/* ---------- الصفحات العامة ---------- */
function home(){
  const F=[['🔗','ربط فوري','سجّل بحساب ديسكورد واختر السيرفر الذي تديره.'],['📦','منتجات احترافية','اسم ووصف وصورة وسعر، مع رتبة تُمنح تلقائياً.'],['💳','طرق دفع متعددة','بنوك، STC Pay، UR Pay، روابط دفع وQR.'],['🎫','لوحة شراء مخصصة','بنر وإيموجي ولون زر تختارهم بنفسك.'],['🚀','تسليم في الخاص','المنتج يصل للمشتري وحده برسالة خاصة.'],['📊','متابعة كاملة','طلباتك ومبيعاتك في لوحة واحدة مرتبة.']];
  const S=[['اربط حسابك','سجّل دخولك عبر ديسكورد.'],['أضف البوت','اختر سيرفرك وأضف بوت Orbit.'],['جهّز متجرك','أضف المنتجات وبيانات الدفع.'],['انشر اللوحة','انشر زر الشراء في أي روم وابدأ البيع.']];
  app.innerHTML=`<section class="hero"><div><h1>متجرك داخل ديسكورد<br>يبيع عنك تلقائياً</h1><p>Orbit منصة شراء ذاتي مجانية بالكامل. يختار العميل المنتج من البوت، يحوّل المبلغ ويرفع الإيصال، وأنت تقبل الطلب وتسلّمه بضغطة زر.</p>
  <div class="row"><button class="btn" onclick="${ME?"location.hash='#/stores'":"doLogin('#/stores')"}">${ME?'فتح لوحة التحكم':'ابدأ مجاناً'}</button><a class="btn ghost" href="#/team">تعرّف على الطاقم</a></div></div><img class="logo" src="img/logo.png" alt="Orbit"></section>
  <section class="sec"><h2>الرئيسية</h2><p class="lead">Orbit وُجد ليجعل البيع داخل ديسكورد سهلاً ومرتباً. لا حاجة لتذاكر يدوية ولا انتظار؛ العميل يشتري بنفسه في أي وقت، وأنت تتحكم بكل شيء من لوحة واحدة: المنتجات، الطلبات، شكل لوحة الشراء، وطرق الدفع.</p></section>
  <section class="sec"><h2>كيف يعمل؟</h2><br><div class="grid">${S.map((x,i)=>`<div class="card step"><b class="n">${i+1}</b><h3>${x[0]}</h3><p class="mut">${x[1]}</p></div>`).join('')}</div></section>
  <section class="sec"><h2>المميزات</h2><br><div class="grid">${F.map(x=>`<div class="card"><div class="ic">${x[0]}</div><h3>${x[1]}</h3><p class="mut">${x[2]}</p></div>`).join('')}</div></section>`;
}
const team=guard(async()=>{const t=await api('/team');
  app.innerHTML=`<section class="sec" style="margin-top:20px"><h2>طاقم العمل</h2><p class="lead">الفريق الذي يقف خلف Orbit.</p><div class="grid">${t.map(m=>`<div class="card tm c st"><img src="${esc(m.avatarUrl)}" alt=""><h3>${esc(m.username)}</h3><span class="role">${esc(m.title)}</span></div>`).join('')||'<div class="card c mut st">لم تتم إضافة أعضاء بعد.</div>'}</div></section>`});
function terms(){app.innerHTML=`<div class="card st"><h2>الشروط والأحكام</h2><p class="mut" style="margin-top:12px">• المنصة وسيط تقني فقط، والبائع مسؤول عن منتجاته وتسليمها.<br>• لا تتحمل المنصة مسؤولية التحويلات البنكية بين البائع والمشتري.<br>• يُمنع بيع أي محتوى مخالف للأنظمة أو لشروط ديسكورد.<br>• يلزم ربط حساب ديسكورد لاستلام المنتج في الخاص.<br>• للمالك حق إيقاف أي متجر مخالف.</p></div>`}

/* ---------- اختيار السيرفر ---------- */
const stores=guard(async()=>{if(!ME)return need();const g=await api('/guilds');
  app.innerHTML=`<div class="dh"><h2>اختر السيرفر</h2></div><p class="mut" style="margin-bottom:20px">تظهر السيرفرات التي تملكها أو لديك فيها صلاحية Administrator.</p><div class="grid">${g.map(x=>`<div class="card c"><div class="sg" style="margin:0 auto 10px">${x.icon?`<img src="https://cdn.discordapp.com/icons/${x.id}/${x.icon}.png?size=64">`:esc(x.name[0])}</div><h3 style="margin-bottom:14px">${esc(x.name)}</h3>
  ${x.botIn?`<a class="btn sm" href="#/s/${x.id}">لوحة التحكم</a>`:`<a class="btn sm ghost" target="_blank" href="${esc(x.invite)}">إضافة البوت</a>`}</div>`).join('')||'<div class="card c mut st">لا توجد سيرفرات تملك فيها صلاحية Administrator</div>'}</div>`});

/* ---------- صفحة الدفع ---------- */
const pay=guard(async id=>{if(!ME)return need();const o=await api('/order/'+id),P=o.pay;
  const cp=(l,v)=>v?`<label>${l}</label><div class="code" data-c="${esc(v)}">${esc(v)}</div>`:'';
  const mh=m=>`<div class="card st" style="margin-bottom:12px"><h3>${esc(m.name)}</h3>${cp('البنك',m.bank)}${cp('اسم المستفيد',m.beneficiary)}${cp('الآيبان',m.iban)}${m.accountOn?cp('رقم الحساب',m.account):''}${m.phoneOn?cp('رقم الجوال',m.phone):''}${m.linkOn&&m.link?`<br><a class="btn sm" target="_blank" rel="noopener" href="${esc(m.link)}">فتح رابط الدفع</a>`:''}${m.qr?`<div class="c"><br><img class="qr" src="${esc(m.qr)}"></div>`:''}</div>`;
  app.innerHTML=`<div style="max-width:620px;margin:auto"><div class="card st"><h2>إتمام الدفع</h2><div class="row sp" style="margin:14px 0"><b>${esc(o.product.name)}</b><span class="price">${o.product.price} ر.س</span></div><p class="mut">${esc(o.product.desc)}</p></div><br>
  ${o.status!=='awaiting_payment'?`<div class="card c st"><span class="badge b-${o.status}">${ST[o.status]}</span><p class="mut" style="margin-top:12px">${o.status==='pending'?'تم استلام الإيصال، بانتظار قبول التاجر. ستصلك رسالة في الخاص.':''}</p></div>`:
  `${P.map(mh).join('')||'<div class="card c mut st">لم يضف التاجر طرق دفع بعد.</div>'}<div class="card st"><label style="margin-top:0">الطريقة التي حوّلت بها</label><select id="pmth">${P.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select><label>اسم المحوِّل</label><input id="py"><label>إيصال التحويل</label><input type="file" id="rc" accept="image/*"><br><br><button class="btn" id="sb" style="width:100%">تأكيد وإرسال الإيصال</button></div>`}</div>`;
  app.querySelectorAll('[data-c]').forEach(e=>e.onclick=()=>{navigator.clipboard?.writeText(e.dataset.c);toast('تم النسخ')});
  $('#sb')&&($('#sb').onclick=guard(async()=>{const receipt=await readImg($('#rc').files[0]);await api(`/order/${id}/pay`,{method:'POST',body:{payer:$('#py').value,receipt,method:$('#pmth').value}});toast('تم الإرسال ✅');pay(id)}))});


/* ---------- التقييم (للمشتري) ---------- */
const rate=guard(async id=>{if(!ME)return need();const r=await api('/rate/'+id);let stars=0;
  app.innerHTML=`<div style="max-width:560px;margin:auto"><div class="card st c"><img src="img/logo.png" width="70"><h2 style="margin:10px 0">قيّم ${esc(r.product)}</h2>${r.rated?'<p class="mut">شكراً! تم تسجيل تقييمك مسبقاً ⭐</p>':`<div class="stars" id="stars">${[1,2,3,4,5].map(n=>`<span data-n="${n}">★</span>`).join('')}</div><label>رأيك</label><textarea id="cm" rows=4 maxlength=500 placeholder="اكتب تجربتك..."></textarea>${r.allowImage?'<label>أرفق صورة (اختياري)</label><input type="file" id="ri" accept="image/*">':''}<br><br><button class="btn" id="rs" style="width:100%">إرسال التقييم</button>`}</div></div>`;
  if(r.rated)return;const paint=()=>app.querySelectorAll('#stars span').forEach(s=>s.classList.toggle('on',+s.dataset.n<=stars));
  app.querySelectorAll('#stars span').forEach(s=>s.onclick=()=>{stars=+s.dataset.n;paint()});
  $('#rs').onclick=guard(async()=>{if(!stars)throw new Error('اختر عدد النجوم');const image=r.allowImage?await readImg($('#ri').files[0]):'';await api('/rate/'+id,{method:'POST',body:{stars,comment:$('#cm').value,image}});toast('شكراً لتقييمك ⭐');rate(id)})});

/* ---------- الفاتورة ---------- */
function invoiceHTML(d,v){const dt=new Date(v.issued).toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'});
  return`<div class="inv ${esc(d.layout)}" style="--p:${esc(d.primary)};--s:${esc(d.secondary)}"><div class="ih"><div class="ib">${d.logo?`<img src="${esc(d.logo)}" alt="">`:''}<div><b>${esc(d.storeName)}</b>${d.regNo?`<small>سجل تجاري: ${esc(d.regNo)}</small>`:''}</div></div><div class="im"><h2>فاتورة</h2><span>${esc(v.no)}</span><span>${dt}</span></div></div>
  <div class="ibd"><p class="cu">العميل: <b>${esc(v.buyer)}</b></p><div class="it"><div class="ir hd"><span>البند</span><span>الكمية</span><span>السعر</span></div><div class="ir"><span>${esc(v.item.name)}<small>${esc(v.item.desc)}</small></span><span>${v.item.qty}</span><span>${v.item.price} ر.س</span></div></div>
  <div class="tot"><span>الإجمالي</span><b>${v.total} ر.س</b></div></div><div class="iff">${esc(d.footer)}</div></div>`}
const invoicePage=guard(async code=>{const v=await api('/invoice/'+code);
  app.innerHTML=`<div class="noprint c" style="margin-bottom:16px"><button class="btn" onclick="print()">🖨️ طباعة / حفظ PDF</button></div>${invoiceHTML(v.design,v)}`});
