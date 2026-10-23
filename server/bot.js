const {Client,GatewayIntentBits:G,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,StringSelectMenuBuilder,PermissionFlagsBits:P,SlashCommandBuilder,AttachmentBuilder,ChannelType}=require('discord.js');
const crypto=require('crypto'),db=require('./db');
const E=process.env,BASE=(E.BASE_URL||'').replace(/\/$/,'');
const c=new Client({intents:[G.Guilds]});
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
const dataImg=(v,name)=>{const m=/^data:image\/(\w+);base64,(.+)$/.exec(v||'');return m?new AttachmentBuilder(Buffer.from(m[2],'base64'),{name:name+'.'+m[1]}):null};
const hex=v=>parseInt(String(v||'#ff6a00').replace('#',''),16)||0xff6a00;
const link=(label,url)=>new ButtonBuilder().setLabel(label).setStyle(ButtonStyle.Link).setURL(url);
// هل المنتج متوفر في المخزن؟
const need=p=>Math.max(1,+p.stockQty||1);
const item=(st,p)=>p.stockId?st.stock.items.find(i=>i.id===p.stockId):null;
const avail=(st,p)=>{const i=item(st,p);return p.stockId?(!!i&&i.qty>=need(p)):true};

function panel(gid){
  const t=db.store(gid).ticket;
  const e=new EmbedBuilder().setColor(hex(t.color)).setTitle(t.title||'الشراء الذاتي').setDescription(t.desc||'—');
  const files=[],a=dataImg(t.banner,'banner');if(a){files.push(a);e.setImage('attachment://'+a.name)}
  const b=new ButtonBuilder().setCustomId('o_open').setLabel(t.btnLabel||'تصفّح المنتجات').setStyle(ButtonStyle[t.btnStyle]||ButtonStyle.Primary);
  if(t.btnEmoji)b.setEmoji(t.btnEmoji);
  return{embeds:[e],files,components:[row(b)]};
}
// ---- المخزن: رسالة واحدة تتحدث تلقائياً ----
function stockPayload(gid){
  const st=db.store(gid),S=st.stock;
  const e=new EmbedBuilder().setColor(hex(st.ticket.color)).setTitle('📦 المخزن').setTimestamp()
    .setDescription(S.items.length?S.items.map(i=>`${i.qty<=0?'🔴':i.qty<=S.lowAt?'🟡':'🟢'} ${i.emoji?i.emoji+' ':''}**${i.name}**\n┗ الكمية: \`${i.qty}\` • السعر: \`${i.price} ر.س\``).join('\n\n'):'لا توجد عناصر في المخزن.')
    .setFooter({text:'يتحدث تلقائياً'});
  return{embeds:[e]};
}
async function updateStock(gid){
  const st=db.store(gid),S=st.stock;if(!S.channelId)return false;
  const ch=await c.channels.fetch(S.channelId).catch(()=>null);if(!ch)return false;
  if(S.messageId){const m=await ch.messages.fetch(S.messageId).catch(()=>null);if(m){await m.edit(stockPayload(gid));return true}}
  const m=await ch.send(stockPayload(gid));S.messageId=m.id;db.save();return true;
}

c.once('ready',async()=>{
  await c.application.commands.set([new SlashCommandBuilder().setName('setup').setDescription('نشر لوحة الشراء الذاتي في هذه الروم').setDefaultMemberPermissions(P.Administrator).setDMPermission(false)]);
  console.log('🤖 Bot ready:',c.user.tag);
});

c.on('interactionCreate',async i=>{try{
  const st=db.d.stores[i.guildId]&&db.store(i.guildId);
  if(i.isChatInputCommand()&&i.commandName==='setup'){
    if(!st)return i.reply({content:`اربط السيرفر أولاً من لوحة التحكم: ${BASE}`,ephemeral:true});
    await i.channel.send(panel(i.guildId));return i.reply({content:'تم النشر ✅',ephemeral:true});
  }
  if(i.isButton()&&i.customId==='o_open'){
    if(!st||st.suspended)return i.reply({content:'المتجر غير متاح حالياً.',ephemeral:true});
    if(!st.products.length)return i.reply({content:'لا توجد منتجات حالياً.',ephemeral:true});
    return i.reply({ephemeral:true,content:'اختر المنتج:',components:[row(new StringSelectMenuBuilder().setCustomId('o_pick').setPlaceholder('اختر منتجاً')
      .addOptions(st.products.slice(0,25).map(p=>({label:p.name.slice(0,90)+(avail(st,p)?'':' (نفد)'),description:p.price+' ر.س',value:p.id}))))]});
  }
  if(i.isStringSelectMenu()&&i.customId==='o_pick'){
    const p=st?.products.find(x=>x.id===i.values[0]);if(!p)return i.reply({content:'المنتج غير متوفر',ephemeral:true});
    const e=new EmbedBuilder().setColor(hex(st.ticket.color)).setTitle(p.name).setDescription(p.desc||'—').addFields({name:'السعر',value:p.price+' ر.س',inline:true});
    const it=item(st,p);if(it)e.addFields({name:'المتوفر',value:String(it.qty),inline:true});
    const a=dataImg(p.image,'p'),f=a?[a]:[];if(a)e.setImage('attachment://'+a.name);
    const ok=avail(st,p);
    return i.update({content:'',embeds:[e],files:f,components:[row(new ButtonBuilder().setCustomId('o_buy:'+p.id).setLabel(ok?'شراء الآن':'نفدت الكمية').setStyle(ok?ButtonStyle.Success:ButtonStyle.Secondary).setDisabled(!ok))]});
  }
  if(i.isButton()&&i.customId.startsWith('o_buy:')){
    if(!st||st.suspended)return i.reply({content:'المتجر غير متاح حالياً.',ephemeral:true});
    const p=st.products.find(x=>x.id===i.customId.slice(6));if(!p)return i.reply({content:'المنتج غير متوفر',ephemeral:true});
    if(!avail(st,p))return i.reply({content:'عذراً، نفدت الكمية.',ephemeral:true});
    if(st.reviews.required){const un=db.d.orders.find(o=>o.gid===i.guildId&&o.buyer.id===i.user.id&&o.status==='delivered'&&!o.rated);
      if(un)return i.reply({ephemeral:true,content:'⭐ قيّم طلبك السابق أولاً لتتمكن من الشراء مجدداً:',components:[row(link('تقييم الطلب',`${BASE}/#/rate/${un.id}`))]})}
    const o={id:crypto.randomBytes(6).toString('hex'),gid:i.guildId,product:{id:p.id,name:p.name,desc:p.desc,price:p.price,roleId:p.roleId,stockId:p.stockId||'',stockQty:need(p)},
      buyer:{id:i.user.id,name:i.user.username},status:'awaiting_payment',created:Date.now()};
    db.d.orders.push(o);db.save();
    return i.reply({ephemeral:true,content:'طلبك جاهز ✅ أكمل الدفع من الرابط:',components:[row(link('الذهاب للدفع',`${BASE}/#/pay/${o.id}`))]});
  }
}catch(e){console.error(e);if(!i.replied&&!i.deferred)i.reply({content:'حدث خطأ',ephemeral:true}).catch(()=>{})}});

module.exports={
  start:()=>c.login(E.BOT_TOKEN),
  has:g=>c.guilds.cache.has(g),count:()=>c.guilds.cache.size,
  guildName:g=>c.guilds.cache.get(g)?.name||g,
  roles:g=>[...(c.guilds.cache.get(g)?.roles.cache.values()||[])].filter(r=>!r.managed&&r.id!==g).sort((a,b)=>b.position-a.position).map(r=>({id:r.id,name:r.name})),
  channels:g=>{const G=c.guilds.cache.get(g);return G?[...G.channels.cache.values()].filter(x=>x.type===ChannelType.GuildText&&x.permissionsFor(G.members.me)?.has(['ViewChannel','SendMessages'])).map(x=>({id:x.id,name:x.name})):[]},
  publish:async(g,ch)=>{const x=c.guilds.cache.get(g)?.channels.cache.get(ch);if(!x)throw new Error('الروم غير موجودة');return x.send(panel(g))},
  updateStock,avail,item,need,
  giveRole:async(g,u,r)=>(await c.guilds.cache.get(g).members.fetch(u)).roles.add(r),
  dm:async(u,payload)=>(await c.users.fetch(u)).send(payload),
  // رسالة التسليم: المنتج + زر التقييم + زر الفاتورة
  delivery:async(o,{link:l,note},inv)=>{
    const e=new EmbedBuilder().setColor(0xff6a00).setTitle('📦 تم تسليم طلبك: '+o.product.name).setDescription(String(note||'').slice(0,1500)||'—').setFooter({text:'فاتورة رقم '+inv.no});
    if(l)e.addFields({name:'رابط المنتج',value:String(l).slice(0,500)});
    const b=[link('🧾 عرض الفاتورة',`${BASE}/#/invoice/${inv.code}`),link('⭐ قيّم المنتج',`${BASE}/#/rate/${o.id}`)];
    return(await c.users.fetch(o.buyer.id)).send({embeds:[e],components:[row(...b)]});
  },
  postReview:async(gid,r)=>{
    const R=db.store(gid).reviews;if(!R.channelId)return;const ch=await c.channels.fetch(R.channelId).catch(()=>null);if(!ch)return;
    const e=new EmbedBuilder().setColor(hex(R.color)).setTitle('⭐'.repeat(r.stars)+'☆'.repeat(5-r.stars)).setDescription(r.comment||'—').setTimestamp();
    if(R.showProduct)e.addFields({name:'المنتج',value:r.product});
    if(R.showName||R.showAvatar)e.setAuthor({name:R.showName?r.buyer.name:'عميل',iconURL:R.showAvatar?r.buyer.avatarUrl:undefined});
    const files=[],a=R.allowImage?dataImg(r.image,'review'):null;if(a){files.push(a);e.setImage('attachment://'+a.name)}
    return ch.send({embeds:[e],files});
  },
  fetchUser:async id=>{const u=await c.users.fetch(id);return{id:u.id,username:u.globalName||u.username,avatarUrl:u.displayAvatarURL({size:256,extension:'png'})}},
  invite:g=>`https://discord.com/oauth2/authorize?client_id=${E.CLIENT_ID}&scope=bot%20applications.commands&permissions=268454912&guild_id=${g}&disable_guild_select=true`,
};
