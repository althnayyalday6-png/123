/* ---------- اختيار السيرفر ---------- */
const stores=guard(async()=>{if(!ME)return need();const g=await api('/guilds');
  app.innerHTML=`<div class="dh"><h2>اختر السيرفر</h2></div><p class="mut" style="margin-bottom:20px">تظهر السيرفرات التي تملكها أو لديك فيها صلاحية Administrator.</p><div class="grid">${g.map(x=>`<div class="card c"><div class="sg" style="margin:0 auto 10px">${x.icon?`<img src="https://cdn.discordapp.com/icons/${x.id}/${x.icon}.png?size=64">`:esc(x.name[0])}</div><h3 style="margin-bottom:14px">${esc(x.name)}</h3>
  ${x.botIn?`<a class="btn sm" href="#/s/${x.id}">لوحة التحكم</a>`:`<a class="btn sm ghost" target="_blank" href="${esc(x.invite)}">إضافة البوت</a>`}</div>`).join('')||'<div class="card c mut st">لا توجد سيرفرات تملك فيها صلاحية Administrator</div>'}</div>`});

/* ---------- صفحة الدفع ---------- */
const pay=guard(async id=>{if(!ME)return need();const o=await api('/order/'+id),P=o.pay;
  const cp=(l,v)=>v?`<label>${l}</label><div class="code" data-c="${esc(v)}">${esc(v)}</div>`:'';
  const mh=m=>`<div class="card st" style="margin-bottom:12px"><h3>${esc(m.name)}</h3>${cp('البنك',m.bank)}${cp('اسم المستفيد',m.beneficiary)}${cp('الآيبان',m.iban)}${m.accountOn?cp('رقم الحساب',m.account):''}${m.phoneOn?cp('رقم الجوال',m.phone):''}${m.linkOn&&m.link?`<br><a class="btn sm" target="_blank" rel="noopener" href="${esc(m.link)}">فتح رابط الدفع</a>`:''}${m.qr?`<div class="c"><br><img class="qr" src="${esc(m.qr)}"></div>`:''}</div>`;
  app.innerHTML=`<div style="max-width:620px;margin:auto"><div class="card st"><h2>إتمام الدفع</h2><div class="row sp" style="margin:14px 0"><b>${esc(o.product.name)}</b><span class="price">${o.product.price} ر.س</span></div><p class="mut">${esc(o.product.desc)}</p></div><br>
  ${o.status!=='awaiting_payment'?`<div class="card c st"><span class="badge b-${o.status}">${ST[o.status]}</span><p class="mut" style="margin:14px 0">${PM[o.status]||''}</p>${['delivered','rejected'].includes(o.status)?'':'<span class="live">يتحدث تلقائياً</span>'}</div>`:
  `${P.map(mh).join('')||'<div class="card c mut st">لم يضف التاجر طرق دفع بعد.</div>'}<div class="card st"><label style="margin-top:0">الطريقة التي حوّلت بها</label><select id="pmth">${P.map(m=>`<option>${esc(m.name)}</option>`).join('')}</select><label>اسم المحوِّل</label><input id="py"><label>إيصال التحويل</label><input type="file" id="rc" accept="image/*"><br><br><button class="btn" id="sb" style="width:100%">تأكيد وإرسال الإيصال</button></div>`}</div>`;
  app.querySelectorAll('[data-c]').forEach(e=>e.onclick=()=>{navigator.clipboard?.writeText(e.dataset.c);toast('تم النسخ')});
  $('#sb')&&($('#sb').onclick=guard(async()=>{const receipt=await readImg($('#rc').files[0]);await api(`/order/${id}/pay`,{method:'POST',body:{payer:$('#py').value,receipt,method:$('#pmth').value}});toast('تم الإرسال ✅');pay(id)}));
  if(['delivered','rejected'].includes(o.status))clearInterval(window.__live);else live(async()=>{const r=await api('/order/'+id+'/status');if(r.status!==o.status){if(PM[r.status])toast(PM[r.status]);pay(id)}})});


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
