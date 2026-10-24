require('dotenv').config();
const express=require('express'),session=require('express-session'),path=require('path'),crypto=require('crypto');
const db=require('./db'),bot=require('./bot');
const E=process.env,BASE=(E.BASE_URL||'http://localhost:3000').replace(/\/$/,''),MAX_STOCK=25;
const app=express();app.set('trust proxy',1);
app.use(express.json({limit:'8mb'}));
app.use(session({secret:E.SESSION_SECRET||'change-me',resave:false,saveUninitialized:false,cookie:{maxAge:6048e5,sameSite:'lax',secure:'auto'}}));
const fail=(m,c=400)=>{const e=new Error(m);e.code=c;throw e};
const wrap=f=>(q,s)=>Promise.resolve().then(()=>f(q,s)).catch(e=>s.status(e.code||500).json({error:e.message,sub:e.sub}));
const me=q=>q.session.user||fail('سجّل دخولك أولاً',401);
const isAdmin=g=>g.owner||(BigInt(g.permissions)&8n);
const S=(v,n)=>String(v??'').slice(0,n);
const col=(v,d)=>/^#[0-9a-f]{6}$/i.test(v)?v:d;
const isOwner=q=>me(q).id===E.OWNER_ID||fail('للمالك فقط',403);
const img=v=>{if(!v)return'';if(!/^data:image\/(png|jpe?g|webp|gif);base64,/.test(v)||v.length>2.6e6)fail('صورة غير صالحة أو كبيرة (الحد 1.8MB)');return v};
const upsert=(arr,o)=>{const i=arr.findIndex(x=>x.id===o.id);if(i<0)arr.push(o);else arr[i]=o};
const orderOf=(q,id)=>db.d.orders.find(x=>x.id===id)||fail('الطلب غير موجود',404);

// ---------- Discord OAuth ----------
app.get('/auth/login',(q,s)=>{q.session.next=String(q.query.next||'');q.session.st=crypto.randomBytes(8).toString('hex');
  s.redirect('https://discord.com/oauth2/authorize?'+new URLSearchParams({client_id:E.CLIENT_ID,response_type:'code',scope:'identify guilds',redirect_uri:BASE+'/auth/callback',state:q.session.st}))});
app.get('/auth/callback',wrap(async(q,s)=>{
  if(!q.query.code||q.query.state!==q.session.st)fail('طلب غير صالح');
  const t=await(await fetch('https://discord.com/api/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({client_id:E.CLIENT_ID,client_secret:E.CLIENT_SECRET,grant_type:'authorization_code',code:q.query.code,redirect_uri:BASE+'/auth/callback'})})).json();
  if(!t.access_token)fail('فشل ربط الحساب');
  const H={headers:{Authorization:'Bearer '+t.access_token}};
  const u=await(await fetch('https://discord.com/api/users/@me',H)).json();
  const g=await(await fetch('https://discord.com/api/users/@me/guilds',H)).json();
  q.session.user={id:u.id,username:u.global_name||u.username,
    avatarUrl:u.avatar?`https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`:'https://cdn.discordapp.com/embed/avatars/0.png',
    guilds:(Array.isArray(g)?g:[]).filter(isAdmin).map(x=>({id:x.id,name:x.name,icon:x.icon}))};
  db.user(u.id);
  const n=q.session.next||'';s.redirect('/'+(n.startsWith('#')?n:'#/stores'));
}));
app.post('/auth/logout',(q,s)=>q.session.destroy(()=>s.json({ok:1})));

// ---------- عام ----------
app.get('/api/config',(q,s)=>s.json({clientId:E.CLIENT_ID,support:db.d.site.support||E.SUPPORT_URL||'',announce:db.d.site.announce||'',price:db.d.site.price}));
app.get('/api/team',(q,s)=>s.json(db.d.team));
app.get('/api/me',(q,s)=>{const u=q.session.user;s.json(u?{id:u.id,username:u.username,avatarUrl:u.avatarUrl,isOwner:u.id===E.OWNER_ID}:null)});
app.get('/api/guilds',wrap((q,s)=>s.json(me(q).guilds.map(g=>({...g,botIn:bot.has(g.id),active:!!db.d.stores[g.id],suspended:!!db.d.stores[g.id]?.suspended,invite:bot.invite(g.id)})))));

// ---------- المتجر ----------
const own=q=>{const u=me(q),g=q.params.gid;if(!u.guilds.some(x=>x.id===g)&&u.id!==E.OWNER_ID)fail('لا تملك صلاحية على هذا السيرفر',403);
  if(!bot.has(g))fail('البوت غير موجود في السيرفر',409);const st=db.store(g);if(st.suspended&&u.id!==E.OWNER_ID)fail('تم إيقاف هذا المتجر من إدارة المنصة',403);
  if(!db.subActive(g)&&u.id!==E.OWNER_ID){const x=new Error(db.d.subs[g]?'انتهى الاشتراك، يرجى التجديد':'هذا المتجر يحتاج اشتراكاً في باقة Orbit');x.code=402;x.sub=true;throw x}return st};
const G='/api/stores/:gid';
app.get(G,wrap((q,s)=>{const st=own(q);s.json({...st,name:bot.guildName(q.params.gid),sub:db.subInfo(q.params.gid),roles:bot.roles(q.params.gid),channels:bot.channels(q.params.gid),orders:db.d.orders.filter(o=>o.gid===q.params.gid).reverse(),maxStock:MAX_STOCK})}));

app.put(G+'/ticket',wrap((q,s)=>{const st=own(q),b=q.body,t=st.ticket;
  t.title=S(b.title,100);t.desc=S(b.desc,1500);t.btnLabel=S(b.btnLabel,40);t.btnEmoji=S(b.btnEmoji,60);
  t.btnStyle=['Primary','Secondary','Success','Danger'].includes(b.btnStyle)?b.btnStyle:'Primary';t.color=col(b.color,'#ff6a00');
  if(b.clearBanner)t.banner='';else if(b.banner)t.banner=img(b.banner);db.save();s.json(t)}));
app.post(G+'/publish',wrap(async(q,s)=>{own(q);await bot.publish(q.params.gid,String(q.body.channelId)).catch(e=>fail('تعذّر النشر: '+e.message));s.json({ok:1})}));

app.post(G+'/payments',wrap((q,s)=>{const st=own(q),b=q.body;if(!S(b.name,40))fail('أدخل اسم طريقة الدفع');
  const link=S(b.link,300);if(b.linkOn&&!/^https?:\/\//.test(link))fail('رابط الدفع يجب أن يبدأ بـ https://');
  const old=st.payments.find(x=>x.id===b.id);
  const m={id:b.id||crypto.randomBytes(4).toString('hex'),name:S(b.name,40),bank:S(b.bank,40),beneficiary:S(b.beneficiary,60),iban:S(b.iban,40),account:S(b.account,40),accountOn:!!b.accountOn,
    phone:S(b.phone,20),phoneOn:!!b.phoneOn,link,linkOn:!!b.linkOn,active:b.active!==false,qr:img(b.qr)||(old&&!b.clearQr?old.qr:'')};
  upsert(st.payments,m);db.save();s.json(m)}));
app.delete(G+'/payments/:id',wrap((q,s)=>{const st=own(q);st.payments=st.payments.filter(x=>x.id!==q.params.id);db.save();s.json({ok:1})}));

app.post(G+'/products',wrap((q,s)=>{const st=own(q),b=q.body;if(!b.name||!(+b.price>0))fail('أدخل اسم المنتج وسعراً صحيحاً');
  const old=st.products.find(x=>x.id===b.id);
  const p={id:b.id||crypto.randomBytes(4).toString('hex'),name:S(b.name,60),desc:S(b.desc,500),price:+b.price,roleId:b.roleId||'',
    stockId:st.stock.items.some(i=>i.id===b.stockId)?b.stockId:'',stockQty:Math.max(1,parseInt(b.stockQty)||1),image:img(b.image)||old?.image||''};
  upsert(st.products,p);db.save();s.json(p)}));
app.delete(G+'/products/:pid',wrap((q,s)=>{const st=own(q);st.products=st.products.filter(p=>p.id!==q.params.pid);db.save();s.json({ok:1})}));

// ---- المخزن ----
app.put(G+'/stock',wrap(async(q,s)=>{const st=own(q),k=st.stock;
  if(q.body.channelId!==k.channelId){k.channelId=S(q.body.channelId,30);k.messageId=''}
  k.lowAt=Math.max(0,parseInt(q.body.lowAt)||0);db.save();await bot.updateStock(q.params.gid).catch(()=>{});s.json(k)}));
app.post(G+'/stock/items',wrap(async(q,s)=>{const st=own(q),k=st.stock,b=q.body;if(!S(b.name,40))fail('أدخل اسم العنصر');
  if(!b.id&&k.items.length>=MAX_STOCK)fail('الحد الأقصى '+MAX_STOCK+' عنصر');
  const it={id:b.id||crypto.randomBytes(4).toString('hex'),name:S(b.name,40),emoji:S(b.emoji,40),qty:Math.max(0,parseInt(b.qty)||0),price:Math.max(0,+b.price||0)};
  upsert(k.items,it);db.save();await bot.updateStock(q.params.gid).catch(()=>{});s.json(it)}));
app.delete(G+'/stock/items/:id',wrap(async(q,s)=>{const st=own(q);st.stock.items=st.stock.items.filter(i=>i.id!==q.params.id);
  st.products.forEach(p=>{if(p.stockId===q.params.id)p.stockId=''});db.save();await bot.updateStock(q.params.gid).catch(()=>{});s.json({ok:1})}));
app.post(G+'/stock/refresh',wrap(async(q,s)=>{const st=own(q);st.stock.messageId='';db.save();if(!await bot.updateStock(q.params.gid).catch(()=>false))fail('اختر روماً صالحة أولاً');s.json({ok:1})}));

// ---- التقييمات ----
app.put(G+'/reviews',wrap((q,s)=>{const R=own(q).reviews,b=q.body;R.channelId=S(b.channelId,30);R.required=!!b.required;R.showAvatar=!!b.showAvatar;R.showName=!!b.showName;R.showProduct=!!b.showProduct;R.allowImage=!!b.allowImage;R.color=col(b.color,'#ffb347');db.save();s.json(R)}));
app.delete(G+'/reviews/:id',wrap((q,s)=>{const R=own(q).reviews;R.list=R.list.filter(r=>r.id!==q.params.id);db.save();s.json({ok:1})}));

// ---- الفواتير ----
app.post(G+'/invoices/designs',wrap((q,s)=>{const I=own(q).invoices,b=q.body;if(!S(b.name,40))fail('أدخل اسم التصميم');const old=I.designs.find(x=>x.id===b.id);
  if(!b.id&&I.designs.length>=10)fail('الحد الأقصى 10 تصاميم');
  const d={id:b.id||crypto.randomBytes(3).toString('hex'),name:S(b.name,40),layout:['classic','modern','minimal'].includes(b.layout)?b.layout:'classic',storeName:S(b.storeName,60)||'متجري',
    logo:b.clearLogo?'':(img(b.logo)||old?.logo||''),primary:col(b.primary,'#ff5e00'),secondary:col(b.secondary,'#fff4ea'),footer:S(b.footer,200),regNo:S(b.regNo,40)};
  upsert(I.designs,d);if(!I.active)I.active=d.id;db.save();s.json(d)}));
app.delete(G+'/invoices/designs/:id',wrap((q,s)=>{const I=own(q).invoices;if(I.designs.length<2)fail('يجب أن يبقى تصميم واحد على الأقل');I.designs=I.designs.filter(d=>d.id!==q.params.id);
  if(I.active===q.params.id)I.active=I.designs[0].id;db.save();s.json({ok:1})}));
app.put(G+'/invoices/active',wrap((q,s)=>{const I=own(q).invoices;if(!I.designs.some(d=>d.id===q.body.id))fail('تصميم غير موجود');I.active=q.body.id;db.save();s.json({ok:1})}));

// ---- الطلبات ----
app.post(G+'/orders/:oid/:act',wrap(async(q,s)=>{const st=own(q),gid=q.params.gid;
  const o=db.d.orders.find(x=>x.id===q.params.oid&&x.gid===gid);if(!o)fail('الطلب غير موجود',404);const a=q.params.act;
  if(a==='accept'||a==='reject'){if(o.status!=='pending')fail('حالة الطلب لا تسمح');
    if(a==='accept'&&o.product.stockId){const it=st.stock.items.find(i=>i.id===o.product.stockId);if(!it||it.qty<o.product.stockQty)fail('المخزون غير كافٍ لهذا الطلب')}
    o.status=a==='accept'?'accepted':'rejected';
    if(a==='accept'&&o.product.roleId)await bot.giveRole(gid,o.buyer.id,o.product.roleId).catch(()=>{o.roleErr=true});
  }else if(a==='deliver'){
    if(o.status!=='accepted')fail('اقبل الطلب أولاً');const{link,note}=q.body;if(!link&&!note)fail('أرفق رابط المنتج أو الوصف');
    const inv={no:db.nextInvoice(),code:crypto.randomBytes(8).toString('hex'),designId:st.invoices.active,issued:Date.now()};
    await bot.delivery(o,{link,note},inv).catch(()=>fail('تعذّر الإرسال: الخاص مغلق عند المشتري'));
    o.status='delivered';o.invoice=inv;
    const it=o.product.stockId&&st.stock.items.find(i=>i.id===o.product.stockId); // خصم المخزون وتحديث الروم تلقائياً
    if(it&&!o.stockDone){it.qty=Math.max(0,it.qty-o.product.stockQty);o.stockDone=true;bot.updateStock(gid).catch(()=>{})}
  }else fail('إجراء غير معروف');
  db.save();s.json(o)}));

// ---------- صفحات المشتري ----------
app.get('/api/order/:id',wrap((q,s)=>{const u=me(q),o=orderOf(q,q.params.id);if(o.buyer.id!==u.id)fail('الطلب غير متاح لهذا الحساب',404);
  s.json({id:o.id,status:o.status,product:o.product,pay:db.store(o.gid).payments.filter(m=>m.active)})}));
app.post('/api/order/:id/pay',wrap((q,s)=>{const u=me(q),o=orderOf(q,q.params.id);if(o.buyer.id!==u.id)fail('الطلب غير متاح',404);
  if(o.status!=='awaiting_payment')fail('تم رفع الإيصال مسبقاً');const{payer,receipt,method}=q.body;
  if(!payer||!receipt)fail('أدخل اسم المحوِّل وأرفق الإيصال');o.payer=S(payer,60);o.method=S(method,40);o.receipt=img(receipt);o.status='pending';db.save();s.json({ok:1})}));
app.get('/api/rate/:id',wrap((q,s)=>{const u=me(q),o=orderOf(q,q.params.id);if(o.buyer.id!==u.id||o.status!=='delivered')fail('التقييم غير متاح لهذا الطلب',404);
  s.json({product:o.product.name,rated:!!o.rated,allowImage:db.store(o.gid).reviews.allowImage})}));
app.post('/api/rate/:id',wrap(async(q,s)=>{const u=me(q),o=orderOf(q,q.params.id);if(o.buyer.id!==u.id||o.status!=='delivered')fail('التقييم غير متاح',404);if(o.rated)fail('قيّمت هذا الطلب مسبقاً');
  const R=db.store(o.gid).reviews,stars=parseInt(q.body.stars);if(!(stars>=1&&stars<=5))fail('اختر عدد النجوم');
  const r={id:crypto.randomBytes(4).toString('hex'),orderId:o.id,stars,comment:S(q.body.comment,500),image:R.allowImage?img(q.body.image):'',buyer:{id:u.id,name:u.username,avatarUrl:u.avatarUrl},product:o.product.name,created:Date.now()};
  R.list.push(r);o.rated=true;db.save();await bot.postReview(o.gid,r).catch(e=>console.error('review post',e.message));s.json({ok:1})}));
app.get('/api/invoice/:code',wrap((q,s)=>{const o=db.d.orders.find(x=>x.invoice?.code===q.params.code);if(!o)fail('الفاتورة غير موجودة',404);
  const I=db.store(o.gid).invoices,d=I.designs.find(x=>x.id===o.invoice.designId)||I.designs[0];
  s.json({no:o.invoice.no,issued:o.invoice.issued,design:d,buyer:o.buyer.name,item:{name:o.product.name,desc:o.product.desc,qty:o.product.stockQty||1,price:o.product.price},total:o.product.price,orderId:o.id})}));

// ---------- إدارة المنصة (المالك) ----------
app.get('/api/admin/overview',wrap((q,s)=>{isOwner(q);const O=db.d.orders,ok=x=>['accepted','delivered'].includes(x.status);
  const stores=Object.keys(db.d.stores).map(g=>{const st=db.store(g),mine=O.filter(o=>o.gid===g);
    return{id:g,name:bot.guildName(g),botIn:bot.has(g),suspended:!!st.suspended,products:st.products.length,orders:mine.length,sales:mine.filter(ok).length,revenue:mine.filter(ok).reduce((a,o)=>a+o.product.price,0),reviews:st.reviews.list.length,sub:db.subInfo(g)}});
  s.json({stats:{servers:bot.count(),stores:stores.length,users:Object.keys(db.d.users).length,orders:O.length,pending:O.filter(o=>o.status==='pending').length,accepted:O.filter(ok).length,delivered:O.filter(o=>o.status==='delivered').length,revenue:O.filter(ok).reduce((a,o)=>a+o.product.price,0),invoices:db.d.counter||0,activeSubs:Object.keys(db.d.subs).filter(g=>db.subInfo(g).active).length,pendingSubs:db.d.subOrders.filter(o=>o.status==='pending').length},
    stores,orders:O.slice(-40).reverse().map(o=>({id:o.id,store:bot.guildName(o.gid),product:o.product.name,price:o.product.price,buyer:o.buyer.name,status:o.status,created:o.created,invoice:o.invoice?.no||''})),site:db.d.site}) }));
app.put('/api/admin/store/:gid',wrap((q,s)=>{isOwner(q);const st=db.d.stores[q.params.gid]||fail('غير موجود',404);st.suspended=!!q.body.suspended;db.save();s.json({ok:1})}));
// ===== v4: التحديث اللحظي + الباقة + الشركاء + الطاقم الثابت =====
app.get(G+'/sync',wrap((q,s)=>{const st=own(q),g=q.params.gid;
  const x=[db.d.orders.filter(o=>o.gid===g).map(o=>o.id+o.status+(o.rated?1:0)).join(),st.stock.items.map(i=>i.id+i.qty).join(),st.reviews.list.length,st.products.length,st.payments.length,db.subInfo(g).until].join('|');
  s.json({sig:crypto.createHash('md5').update(x).digest('hex')})}));
app.get('/api/order/:id/status',wrap((q,s)=>{const u=me(q),o=orderOf(q,q.params.id);if(o.buyer.id!==u.id)fail('غير متاح',404);s.json({status:o.status})}));

const cleanMethod=(b,old)=>{const link=S(b.link,300);if(!S(b.name,40))fail('أدخل اسم طريقة الدفع');if(b.linkOn&&!/^https?:\/\//.test(link))fail('رابط الدفع يجب أن يبدأ بـ https://');
  return{id:b.id||crypto.randomBytes(4).toString('hex'),name:S(b.name,40),bank:S(b.bank,40),beneficiary:S(b.beneficiary,60),iban:S(b.iban,40),account:S(b.account,40),accountOn:!!b.accountOn,
    phone:S(b.phone,20),phoneOn:!!b.phoneOn,link,linkOn:!!b.linkOn,active:b.active!==false,qr:img(b.qr)||(old&&!b.clearQr?old.qr:'')}};

// الباقة
app.get('/api/plan',(q,s)=>s.json({price:db.d.site.price,methods:db.d.site.payments.filter(m=>m.active),required:db.d.site.requirePlan}));
app.get('/api/sub/mine',wrap((q,s)=>{const u=me(q);
  s.json({orders:db.d.subOrders.filter(o=>o.user.id===u.id).map(({receipt,...r})=>r).reverse(),
    guilds:u.guilds.filter(g=>bot.has(g.id)).map(g=>({gid:g.id,name:g.name,...db.subInfo(g.id)}))})}));
app.post('/api/sub/order',wrap((q,s)=>{const u=me(q),{gid,payer,method,receipt}=q.body,g=u.guilds.find(x=>x.id===gid);
  if(!g)fail('اختر سيرفراً تديره');if(!bot.has(gid))fail('أضف البوت للسيرفر أولاً',409);if(!payer||!receipt)fail('أدخل اسم المحوِّل وأرفق الإيصال');
  if(db.d.subOrders.some(o=>o.gid===gid&&o.user.id===u.id&&o.status==='pending'))fail('لديك طلب اشتراك قيد المراجعة لهذا السيرفر');
  db.d.subOrders.push({id:crypto.randomBytes(5).toString('hex'),gid,gname:g.name,user:{id:u.id,name:u.username},payer:S(payer,60),method:S(method,40),receipt:img(receipt),price:db.d.site.price,status:'pending',created:Date.now()});
  db.save();s.json({ok:1})}));
app.get('/api/admin/subs',wrap((q,s)=>{isOwner(q);s.json({orders:[...db.d.subOrders].reverse(),subs:Object.keys(db.d.subs).map(g=>({gid:g,name:bot.guildName(g),...db.subInfo(g)})),payments:db.d.site.payments,price:db.d.site.price})}));
app.post('/api/admin/subs/:id/:act',wrap((q,s)=>{isOwner(q);const o=db.d.subOrders.find(x=>x.id===q.params.id)||fail('غير موجود',404);if(o.status!=='pending')fail('تمت معالجته مسبقاً');
  if(q.params.act==='accept'){o.status='accepted';o.until=db.addDays(o.gid,30);
    bot.dm(o.user.id,{content:`✅ تم تفعيل اشتراك Orbit لسيرفر **${o.gname}** لمدة 30 يوماً، وينتهي في ${new Date(o.until).toLocaleDateString('ar-SA')}.`}).catch(()=>{})}
  else if(q.params.act==='reject')o.status='rejected';else fail('إجراء غير معروف');db.save();s.json({ok:1})}));
app.post('/api/admin/grant',wrap((q,s)=>{isOwner(q);const g=S(q.body.gid,30);if(!db.d.stores[g])fail('متجر غير موجود',404);
  if(q.body.stop){db.d.subs[g]={until:0};db.save()}else db.addDays(g,Math.min(366,Math.max(1,parseInt(q.body.days)||30)));s.json({ok:1})}));
app.post('/api/admin/payments',wrap((q,s)=>{isOwner(q);const P=db.d.site.payments,m=cleanMethod(q.body,P.find(x=>x.id===q.body.id));upsert(P,m);db.save();s.json(m)}));
app.delete('/api/admin/payments/:id',wrap((q,s)=>{isOwner(q);db.d.site.payments=db.d.site.payments.filter(x=>x.id!==q.params.id);db.save();s.json({ok:1})}));
app.put('/api/admin/site',wrap((q,s)=>{isOwner(q);const u=S(q.body.support,200),st=db.d.site;if(u&&!/^https?:\/\//.test(u))fail('الرابط يجب أن يبدأ بـ https://');
  st.support=u;st.announce=S(q.body.announce,200);if(+q.body.price>0)st.price=+(+q.body.price).toFixed(2);st.requirePlan=!!q.body.requirePlan;db.save();s.json({ok:1})}));
app.get('/api/admin/sync',wrap((q,s)=>{isOwner(q);s.json({sig:[db.d.subOrders.map(o=>o.id+o.status).join(),db.d.orders.length,Object.keys(db.d.stores).length,db.d.partners.length].join('|')})}));

// شركاء النجاح (يُجلب عدد الأعضاء من رابط الدعوة)
const inviteCode=u=>{const m=/(?:discord\.gg|discord(?:app)?\.com\/invite)\/([\w-]{2,32})/i.exec(String(u));return m&&m[1]};
const fetchInvite=async c=>{const r=await fetch('https://discord.com/api/v10/invites/'+c+'?with_counts=true');if(!r.ok)fail('رابط الدعوة غير صالح أو منتهي');const j=await r.json();if(!j.guild)fail('الدعوة ليست لسيرفر');
  return{gid:j.guild.id,name:j.guild.name,icon:j.guild.icon?`https://cdn.discordapp.com/icons/${j.guild.id}/${j.guild.icon}.png?size=128`:'',desc:S(j.guild.description,160),members:j.approximate_member_count||0,online:j.approximate_presence_count||0,at:Date.now()}};
app.get('/api/partners',wrap(async(q,s)=>{const P=db.d.partners,old=P.filter(p=>Date.now()-p.at>9e5);
  await Promise.allSettled(old.map(async p=>Object.assign(p,await fetchInvite(p.code))));if(old.length)db.save();s.json(P)}));
app.post('/api/admin/partners',wrap(async(q,s)=>{isOwner(q);const c=inviteCode(q.body.url)||fail('ضع رابط دعوة صحيح (discord.gg/...)');
  const p={id:crypto.randomBytes(4).toString('hex'),code:c,url:'https://discord.gg/'+c,owner:S(q.body.owner,60),...await fetchInvite(c)};
  const i=db.d.partners.findIndex(x=>x.gid===p.gid);if(i<0)db.d.partners.push(p);else db.d.partners[i]={...p,id:db.d.partners[i].id};db.save();s.json(p)}));
app.post('/api/admin/partners/:id/refresh',wrap(async(q,s)=>{isOwner(q);const p=db.d.partners.find(x=>x.id===q.params.id)||fail('غير موجود',404);Object.assign(p,await fetchInvite(p.code));db.save();s.json(p)}));
app.delete('/api/admin/partners/:id',wrap((q,s)=>{isOwner(q);db.d.partners=db.d.partners.filter(x=>x.id!==q.params.id);db.save();s.json({ok:1})}));

// طاقم العمل: ثابت (يُدخل يدوياً ولا يتغير تلقائياً)
app.post('/api/admin/team',wrap(async(q,s)=>{isOwner(q);const b=q.body,old=db.d.team.find(x=>x.id===b.id);let username=S(b.username,40),avatarUrl=b.avatar?img(b.avatar):'';
  if(b.discordId&&!avatarUrl){const u=await bot.fetchUser(String(b.discordId).trim()).catch(()=>fail('تعذّر جلب الحساب، تأكد من الآيدي'));avatarUrl=u.avatarUrl;username=username||u.username}
  if(!username)fail('أدخل اليوزر');const r={id:old?.id||crypto.randomBytes(4).toString('hex'),username,title:S(b.title,40)||'عضو الطاقم',avatarUrl:avatarUrl||old?.avatarUrl||''};
  upsert(db.d.team,r);db.save();s.json(r)}));
app.delete('/api/admin/team/:id',wrap((q,s)=>{isOwner(q);db.d.team=db.d.team.filter(x=>x.id!==q.params.id);db.save();s.json({ok:1})}));

app.use(express.static(path.join(__dirname,'..','public')));
app.listen(process.env.PORT||3000,()=>console.log('🌐 Orbit on',BASE));
bot.start().catch(e=>console.error('Bot login failed:',e.message));
