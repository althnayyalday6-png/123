// تخزين JSON بسيط. للتخزين الدائم على ريندر المجاني استبدله بـ MongoDB Atlas (انظر README)
const fs=require('fs'),path=require('path');
const dir=process.env.DATA_DIR||path.join(__dirname,'..','data'),file=path.join(dir,'db.json');
fs.mkdirSync(dir,{recursive:true});
let d={stores:{},orders:[],users:{},team:[],site:{support:'',announce:''},counter:0};
try{d={...d,...JSON.parse(fs.readFileSync(file,'utf8'))}}catch{}
let t;const save=()=>{clearTimeout(t);t=setTimeout(()=>fs.writeFile(file,JSON.stringify(d),()=>{}),300)};
const store=g=>{
  const s=d.stores[g]||(d.stores[g]={},save(),d.stores[g]);
  s.products??=[];
  s.ticket??={title:'🪐 الشراء الذاتي',desc:'اضغط الزر لتصفّح المنتجات واشترِ بنفسك بدون انتظار.',banner:'',btnLabel:'تصفّح المنتجات',btnEmoji:'🛒',btnStyle:'Primary',color:'#ff6a00'};
  if(!s.payments){s.payments=[];const o=s.settings; // ترحيل البيانات القديمة
    if(o&&(o.iban||o.account))s.payments.push({id:'m0',name:o.bank||'تحويل بنكي',bank:o.bank||'',beneficiary:o.beneficiary||'',iban:o.iban||'',account:o.account||'',accountOn:!!o.account,phone:'',phoneOn:false,link:'',linkOn:false,qr:o.qr||'',active:true});
    delete s.settings}
  s.reviews??={channelId:'',required:false,showAvatar:true,showName:true,showProduct:true,allowImage:true,color:'#ffb347',list:[]};
  s.invoices??={active:'d1',designs:[{id:'d1',name:'التصميم الأساسي',layout:'classic',storeName:'متجري',logo:'',primary:'#ff5e00',secondary:'#fff4ea',footer:'شكراً لتسوقك معنا',regNo:''}]};
  s.stock??={channelId:'',messageId:'',lowAt:3,items:[]};
  return s};
const nextInvoice=()=>{d.counter=(d.counter||0)+1;save();return 'ORB-'+String(d.counter).padStart(6,'0')};
const user=id=>{if(!d.users[id]){d.users[id]=Date.now();save()}};
module.exports={d,save,store,user,nextInvoice};
