"use strict";
const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe=v=>{try{const u=new URL(v,document.baseURI);return ["http:","https:"].includes(u.protocol)?esc(u.href):"#"}catch{return "#"}};
let data,version,admin,group=-1,kind=-1,page=1,query="";
async function api(path,options={}){
 const headers=new Headers(options.headers);
 headers.set("Accept","application/json");
 if(typeof options.body==="string")headers.set("Content-Type","application/json");
 const token=sessionStorage.getItem("yisheng-demo-session");
 if(token)headers.set("X-Demo-Session",token);
 const response=await fetch("."+path,{...options,headers,credentials:"same-origin",cache:"no-store"});
 if(!response.headers.get("Content-Type")?.includes("application/json"))
  throw Error("网站未返回管理数据。请在浏览器中重新打开网站并登录站点账户。");
 const result=await response.json();
 if(!response.ok)throw Object.assign(Error(result),{status:response.status});
 if(path==="/api/login")sessionStorage.setItem("yisheng-demo-session",result);
 if(path==="/api/logout")sessionStorage.removeItem("yisheng-demo-session");
 return result;
}
let requestNumber=0, currentRevision=null, openedRecord=null;
const changes=typeof BroadcastChannel==="function"?new BroadcastChannel("portal-content"):null;
const inManagement=()=>location.hash==="#manage";
async function load(managing=false){
 const number=++requestNumber;
 const state=await api(managing?"/api/manage":"/api/site");
 if(number!==requestNumber)return;
 ({data,version,admin}=state);
 currentRevision=state.revision;
 render();
}
async function refreshPublic(){
 if(inManagement()||!data)return;
 const number=++requestNumber;
 try{
  const state=await api("/api/site");
  if(number!==requestNumber||inManagement()||state.revision===currentRevision)return;
  ({data,version,admin}=state);
  currentRevision=state.revision;
  if(openedRecord && !data.records.some(record=>record.title===openedRecord.title && record.url===openedRecord.url && record.group===openedRecord.group && record.date===openedRecord.date))$("#modal").close();
  render();
 }catch{/* 下一次切回页面或定时检查时重试。 */}
}
changes?.addEventListener("message",refreshPublic);
window.addEventListener("storage",event=>{if(event.key==="portal-content")refreshPublic()});
window.addEventListener("focus",refreshPublic);
window.addEventListener("pageshow",refreshPublic);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshPublic()});
setInterval(()=>{if(!document.hidden)refreshPublic()},12000);
function buttons(el,items,fn,active=-2){el.replaceChildren(...items.map((name,i)=>{const b=document.createElement("button");b.textContent=name;b.className="chip"+(active===i?" active":"");b.onclick=()=>fn(i);return b}))}
function select(g){group=g;kind=-1;page=1;query="";$("#search input").value="";render()}
function homeSlides(site){
 return site.slides??[{desktop:site.banner||"assets/acaee3c1e2711757.jpg",mobile:site.mobileBanner||"",caption:site.bannerCaption||""}];
}
let coverTimer;
let coverKey;
function renderCover(){
 const slides=homeSlides(data), cover=$("#cover");
 cover.hidden=group!==-1||Boolean(query)||data.bannerEnabled===false||slides.length===0;
 const key=cover.hidden?"":JSON.stringify(slides);
 if(key===coverKey)return;
 coverKey=key;
 clearTimeout(coverTimer);
 cover.replaceChildren();
 if(cover.hidden)return;
 const track=document.createElement("div");
 track.className="coverTrack";
 for(const slide of slides){
  const frame=document.createElement("figure");
  const picture=document.createElement("picture");
  const mobile=document.createElement("source");
  mobile.media="(max-width:760px)";
  mobile.srcset=slide.mobile||slide.desktop;
  const image=document.createElement("img");
  image.alt="";
  picture.append(mobile,image);
  image.src=slide.desktop;
  frame.append(picture);
  if(slide.caption){
   const caption=document.createElement("figcaption");
   caption.textContent=slide.caption;
   frame.append(caption);
  }
  track.append(frame);
 }
 cover.append(track);
 function schedule(){
  if(track.isConnected && track.children.length>1 && !matchMedia("(prefers-reduced-motion: reduce)").matches)
   coverTimer=setTimeout(advance,5000);
 }
 async function advance(){
  if(document.hidden||$("#modal").open){schedule();return}
  const first=track.firstElementChild,next=first.nextElementSibling;
  try{await next.querySelector("img").decode()}catch{
   if(track.isConnected)track.append(next);
   schedule();return;
  }
  if(!track.isConnected)return;
  const motion=track.animate([{transform:"translateX(0)"},{transform:"translateX(-100%)"}],
   {duration:950,easing:"cubic-bezier(.45,0,.25,1)",fill:"forwards"});
  await motion.finished;
  track.append(first);
  motion.cancel();
  schedule();
 }
 schedule();
}
function render(){
 document.title=data.name;$("#brand").textContent=data.name;$("#mark").innerHTML=data.logo?'<img alt="" src="'+safe(data.logo)+'">':"益晟";$("#intro").textContent=data.intro==="集中查询政府采购、工程招标公告与项目动态"?"":data.intro;
 renderCover();
 buttons($("#nav"),["首页",...data.groups],i=>select(i-1),group+1);$("#nav").querySelectorAll("button").forEach(b=>b.classList.remove("chip"));
 $("#login").textContent="管理";$("#services").innerHTML="";
 [["▤",data.groups[3],()=>select(3)],["▦","费用计算器",calculator],["⌖","地图导航",maps]].forEach(([icon,name,fn])=>{const b=document.createElement("button");b.className="service";b.innerHTML='<span class="icon">'+icon+'</span>'+esc(name);b.onclick=fn;$("#services").append(b)});
 $("#offices").innerHTML=data.offices.map(o=>'<div class="office"><b>'+esc(o.title)+'</b><p>'+esc(o.address)+'</p><a href="tel:'+esc(o.phone)+'">'+esc(o.phone)+'</a></div>').join("");
 $("#links").innerHTML=data.links.map(l=>external(l.title,l.url)).join("");$("#copyright").textContent="© "+new Date().getFullYear()+" "+data.name;list();
}
function external(title,url){return '<a target="_blank" rel="noopener" href="'+safe(url)+'">'+esc(title)+'</a>'}
function newestFirst(a,b){
 return (b.date||"").localeCompare(a.date||"");
}
function list(){
 $("#section").textContent=query?"搜索结果":group<0?(data.heading&&data.heading!=="招标采购信息服务平台"?data.heading:"最新公告"):data.groups[group];
 const home=group<0;buttons($("#filters"),home?["全部公告",...data.groups.slice(0,2)]:["全部",...data.kinds[group]],i=>{kind=i-1;page=1;list()},kind+1);
 const rows=data.records.filter(r=>r.published!==false).filter(r=>(home?(query||r.group<2)&&(kind<0||r.group===kind):r.group===group&&(kind<0||r.kind===kind))&&(r.title+" "+r.body).toLowerCase().includes(query.toLowerCase())).sort(newestFirst);
 page=Math.min(page,Math.max(1,Math.ceil(rows.length/7)));$("#count").textContent="共 "+rows.length+" 条";$("#rows").innerHTML="";for(const r of rows.slice((page-1)*7,page*7)){const b=document.createElement("button");b.className="row";b.innerHTML='<span class="noticeTitle">'+esc(r.title)+'</span><time>'+esc(r.date)+'</time>' ;b.onclick=()=>detail(r);$("#rows").append(b)}
 if(!rows.length)$("#rows").textContent="暂无符合条件的内容";const total=Math.max(1,Math.ceil(rows.length/7));$("#pager").innerHTML='<button id="prev">上一页</button><span>'+page+' / '+total+'</span><button id="next">下一页</button>';for(const [id,step] of [["prev",-1],["next",1]]){const b=$("#"+id);b.disabled=page+step<1||page+step>total;b.onclick=()=>{page+=step;list();$("#section").scrollIntoView({block:"start"})}}
}
$("#searchToggle").onclick=()=>{
 const open=$("#searchToggle").getAttribute("aria-expanded")!=="true";
 $("#searchToggle").setAttribute("aria-expanded",String(open));
 $("#searchToggle").textContent=open?"收起":"搜索";
 if(open)$("#search input").focus();
};
$("#search").onsubmit=e=>{e.preventDefault();group=kind=-1;page=1;query=$("#search input").value.trim();render();$("#section").scrollIntoView()};
function modal(title,html){$("#content").innerHTML="<h2>"+esc(title)+"</h2>"+html;$("#error").textContent="";if(!$("#modal").open)$("#modal").showModal();$("#modal").scrollTop=0}
$("#close").onclick=()=>$("#modal").close();
function detail(r){openedRecord=r;modal(r.title,'<small>'+esc(data.groups[r.group])+' · '+esc(r.date)+'</small><p class="body">'+esc(r.body)+'</p><div class="actions">'+(r.file?external("查看或下载附件",r.file):"")+(r.url?external("查看原文",r.url):"")+'</div>')}
function maps(){modal("地图导航",data.offices.map(o=>'<h3>'+esc(o.title)+'</h3><p>'+esc(o.address)+'</p>'+external("打开地图导航","https://uri.amap.com/search?keyword="+encodeURIComponent(o.address))).join(""))}
function calculator(){modal("费用计算器",'<iframe title="招标代理服务费计算器" src="./calculator.html" style="border:0;width:100%;height:400px"></iframe>')}
const field=(label,id,value="",type="text")=>'<label>'+esc(label)+'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';
const area=(label,id,value)=>'<label>'+label+'<textarea id="'+id+'">'+esc(value)+'</textarea></label>';
function on(id,fn){$("#"+id).onclick=async()=>{try{$("#error").textContent="";await fn()}catch(e){$("#error").textContent=e.message}}}
$("#login").onclick=()=>{
 modal("管理员登录",'<p>演示账号 <b>demo</b>　密码 <b>Yisheng2026</b></p><form id="signin"><label>账号<input name="username" autocomplete="username" required></label><label>密码<input type="password" name="password" autocomplete="current-password" required></label><button class="primary">登录管理端</button></form>');
 const form=$("#signin");
 form.elements.username.focus();
 form.onsubmit=async event=>{
  event.preventDefault();
  const submit=form.querySelector("button");
  submit.disabled=true;
  try{
   await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(form)))});
   history.replaceState(null,"","#manage");
   await load(true);
   if(!admin)throw Error("登录会话未保存，请在浏览器中允许本站 Cookie 后重试。");
   $("#modal").classList.add("adminWorkspace");
   manage();
  }catch(err){$("#error").textContent=err.message;form.elements.password.select()}
  finally{submit.disabled=false}
 };
};
$("#modal").addEventListener("close",()=>{openedRecord=null;$("#modal").classList.remove("adminWorkspace")});
$("#modal").addEventListener("cancel",event=>{if($("#modal").classList.contains("adminWorkspace"))event.preventDefault()});
let adminPage=1,adminSearch="";
const adminPageSize=10;
async function publish(d,search=adminSearch){version=await api("/api/site",{method:"PUT",body:JSON.stringify({data:d,version})});data=d;changes?.postMessage("saved");try{localStorage.setItem("portal-content",crypto.randomUUID())}catch{}render();manage(search)}
function manage(search=adminSearch){modal("网站管理",'<p>演示修改仅保存在当前浏览器。可打开同一网址的新标签页查看前台效果。</p>'+'<div class="actions"><button id="add" class="primary">发布内容</button><button id="coverSettings">首页图片</button><button id="settings">站点设置</button><button id="logout">退出登录</button></div>'+field("查找要修改的内容","lookup")+'<div id="manageRows"></div><div id="adminPager" aria-label="管理列表分页"></div>');on("add",()=>edit(-1));on("coverSettings",coverSettings);on("settings",settings);on("logout",async()=>{await api("/api/logout",{method:"POST"});history.replaceState(null,"",location.pathname+location.search);$("#modal").close();await load()});
 $("#lookup").value=typeof search==="string"?search:adminSearch;
 function refresh(){
  const box=$("#manageRows");box.replaceChildren();
  adminSearch=$("#lookup").value;
  const matches=data.records.map((record,index)=>({record,index})).filter(({record})=>record.title.includes(adminSearch.trim()))
   .sort((a,b)=>newestFirst(a.record,b.record));
  const pages=Math.max(1,Math.ceil(matches.length/adminPageSize));
  adminPage=Math.min(adminPage,pages);
  const offset=(adminPage-1)*adminPageSize;
  if(!matches.length)box.textContent="没有找到匹配的内容";
  matches.slice(offset,offset+adminPageSize).forEach(({record,index})=>{
   const row=document.createElement("div");
   row.className="manageRow";
   const metadata=[record.date,data.kinds[record.group]?.[record.kind]].filter(Boolean).join(" · ");
   row.innerHTML='<span><small class="recordMeta">'+esc(metadata)+'</small>'+esc(record.title)+'</span><label class="publishToggle"><input type="checkbox" role="switch"><span></span></label><button>编辑</button>';
   const toggle=row.querySelector("input");
   toggle.checked=record.published!==false;
   toggle.setAttribute("aria-label",record.title+" 是否发布");
   row.querySelector("label span").textContent=toggle.checked?"已发布":"已隐藏";
   toggle.onchange=async()=>{
    const draft=structuredClone(data);
    draft.records[index].published=toggle.checked;
    const lookup=$("#lookup").value;
    $("#content").inert=true;
    try{await publish(draft,lookup)}
    catch(err){toggle.checked=record.published!==false;$("#error").textContent=err.message}
    finally{$("#content").inert=false}
   };
   row.querySelector("button").onclick=()=>edit(index);
   box.append(row);
  });
  const pager=$("#adminPager");
  pager.innerHTML='<span id="adminCount"></span><button id="adminPrev">上一页</button><select id="adminPageSelect" aria-label="跳转到页"></select><button id="adminNext">下一页</button>';
  $("#adminCount").textContent="共 "+matches.length+" 条";
  const selectPage=$("#adminPageSelect");
  for(let n=1;n<=pages;n++)selectPage.add(new Option("第 "+n+" / "+pages+" 页",String(n)));
  selectPage.value=String(adminPage);
  function go(n){adminPage=n;refresh();$("#lookup").scrollIntoView({block:"start"})}
  selectPage.onchange=()=>go(Number(selectPage.value));
  $("#adminPrev").disabled=adminPage===1;
  $("#adminNext").disabled=adminPage===pages;
  $("#adminPrev").onclick=()=>go(adminPage-1);
  $("#adminNext").onclick=()=>go(adminPage+1);
 }
 $("#lookup").oninput=()=>{adminPage=1;refresh()};refresh();
}
async function upload(id){const f=$("#"+id).files[0];if(!f)return "";if(f.size>16*1024*1024)throw Error("文件大小上限为 16 MB");return api("/api/upload?name="+encodeURIComponent(f.name),{method:"POST",body:f})}
const opts=(arr,sel)=>arr.map((v,i)=>'<option value="'+i+'" '+(i===sel?'selected':'')+'>'+esc(v)+'</option>').join("");
function edit(i){const d=structuredClone(data),r=d.records[i]||{group:0,kind:0,title:"",body:"",date:new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Shanghai"}),url:"",file:""};
 modal(i<0?"发布内容":"编辑内容",field("标题","title",r.title)+'<label class="publishToggle"><input type="checkbox" role="switch" id="published">是否发布</label>'+'<label>栏目<select id="group">'+opts(data.groups,r.group)+'</select></label><label>分类<select id="kind"></select></label>'+field("发布日期","date",r.date,"date")+area("正文","body",r.body)+field("原文链接（选填）","url",r.url)+field("附件地址（清空可移除）","file",r.file)+field("上传新附件","upload","","file")+'<div class="actions"><button class="primary" id="save">保存内容</button><button id="back">返回</button>'+(i>=0?'<button id="del">删除内容</button>':'')+'</div>');
 $("#published").checked=r.published!==false;
 const kinds=k=>$("#kind").innerHTML=opts(data.kinds[+$("#group").value],k);kinds(r.kind);$("#group").onchange=()=>kinds(0);on("back",manage);if(i>=0)on("del",async()=>{if(confirm("确定删除这条内容？")){d.records.splice(i,1);await publish(d)}});on("save",async()=>{if(!$("#title").value.trim())throw Error("请输入标题");Object.assign(r,{published:$("#published").checked,title:$("#title").value.trim(),date:$("#date").value,body:$("#body").value,url:$("#url").value,file:await upload("upload")||$("#file").value,group:+$("#group").value,kind:+$("#kind").value});if(i<0&&!d.records.includes(r))d.records.unshift(r);await publish(d)})}
function coverSettings(){
 const draft=structuredClone(data);
 modal("首页图片",'<label class="toggle"><input type="checkbox" id="showBanner">在首页显示横幅</label><div id="slideCards"></div><div class="actions"><button id="addSlide">添加图片</button><button class="primary" id="saveCover">保存设置</button><button id="back">返回</button></div>');
 $("#showBanner").checked=draft.bannerEnabled!==false;
 const list=$("#slideCards");
 let sequence=0;
 const cards=()=>Array.from(list.children);
 function updateOrder(){
  cards().forEach((card,i)=>{
   card.querySelector("h3").textContent="第 "+(i+1)+" 张";
   card.querySelector(".up").disabled=i===0;
   card.querySelector(".down").disabled=i===list.children.length-1;
  });
  $("#addSlide").disabled=list.children.length>=5;
  $("#addSlide").textContent="添加图片（"+list.children.length+"/5）";
 }
 function add(slide={}){
  if(list.children.length>=5)return;
  const card=document.createElement("section");
  card.className="slideCard";
  const id="slide"+(++sequence);
  card.dataset.prefix=id;
  const panel=(key,title,hint)=>'<fieldset><legend>'+title+'</legend><img class="coverPreview" alt="'+title+'预览" hidden><small>'+hint+'</small><label>上传图片<input type="file" id="'+id+key+'File" accept="image/jpeg,image/png,image/gif,image/webp"></label>'+field("图片地址",id+key,slide[key])+'</fieldset>';
  card.innerHTML='<div class="slideHead"><h3></h3><button class="up">上移</button><button class="down">下移</button><button class="remove">移除</button></div><div class="coverEditors">'+panel("desktop","电脑图片","建议尺寸 1680 × 620 像素")+panel("mobile","手机图片","留空时使用电脑图片")+'</div>'+field("图片说明（选填）",id+"caption",slide.caption);
  list.append(card);
  card.querySelector(".up").onclick=()=>{list.insertBefore(card,card.previousElementSibling);updateOrder()};
  card.querySelector(".down").onclick=()=>{list.insertBefore(card.nextElementSibling,card);updateOrder()};
  const urls={};
  function preview(){
   const desktop=urls.desktop||$("#"+id+"desktop").value.trim();
   for(const key of ["desktop","mobile"]){
    const img=$("#"+id+key).closest("fieldset").querySelector("img");
    const src=urls[key]||$("#"+id+key).value.trim()||desktop;
    img.hidden=!src;
    if(src)img.src=src;else img.removeAttribute("src");
   }
  }
  card.cleanup=()=>Object.values(urls).forEach(url=>URL.revokeObjectURL(url));
  card.querySelector(".remove").onclick=()=>{card.cleanup();card.remove();updateOrder()};
  for(const key of ["desktop","mobile"]){
   const input=$("#"+id+key+"File");
   input.onchange=()=>{
    if(urls[key])URL.revokeObjectURL(urls[key]);
    urls[key]=input.files[0]?URL.createObjectURL(input.files[0]):"";
    preview();
   };
   $("#"+id+key).oninput=preview;
  }
  preview();updateOrder();
 }
 homeSlides(draft).forEach(add);updateOrder();
 const cleanup=()=>cards().forEach(card=>card.cleanup());
 on("addSlide",()=>add());
 on("back",()=>{cleanup();manage()});
 on("saveCover",async()=>{
  const entries=cards();
  for(const card of entries){
   const prefix=card.dataset.prefix;
   if(!$("#"+prefix+"desktopFile").files.length&&!$("#"+prefix+"desktop").value.trim())throw Error(card.querySelector("h3").textContent+"请上传电脑图片或填写图片地址");
   for(const input of card.querySelectorAll('input[type="file"]')){
    const file=input.files[0];
    if(file&&(!["image/jpeg","image/png","image/gif","image/webp"].includes(file.type)||file.size>16*1024*1024))throw Error("请选择 16 MB 以内的 JPG、PNG、GIF 或 WebP 图片");
   }
  }
  $("#content").inert=true;
  try{
   draft.slides=[];
   for(const card of entries){
    const prefix=card.dataset.prefix,slide={caption:$("#"+prefix+"caption").value.trim()};
    for(const key of ["desktop","mobile"]){
     const fileId=prefix+key+"File";
     const uploaded=await upload(fileId);
     if(uploaded){$("#"+prefix+key).value=uploaded;$("#"+fileId).value=""}
     slide[key]=$("#"+prefix+key).value.trim();
    }
    draft.slides.push(slide);
   }
   draft.bannerEnabled=$("#showBanner").checked;
   await publish(draft);entries.forEach(card=>card.cleanup());
  }finally{$("#content").inert=false}
 });
}
function settings(){const d=structuredClone(data);modal("站点设置",field("公司名称","name",d.name)+field("首页标题","heading",d.heading)+field("首页说明","intro",d.intro)+["logo"].map((k,i)=>field(["标志图片地址","首页横幅地址"][i],k,d[k])+field("上传替换图片",k+"Up","","file")).join("")+d.groups.map((g,i)=>field("栏目名称","g"+i,g)+field("子分类（按原顺序，用 | 分隔）","k"+i,d.kinds[i].join("|"))).join("")+area("联系地点（每行填写 名称 | 地址 | 电话）","locations",d.offices.map(o=>[o.title,o.address,o.phone].join(" | ")).join("\n"))+area("友情链接（每行填写 名称 | 网址）","friends",d.links.map(o=>o.title+" | "+o.url).join("\n"))+'<div class="actions"><button class="primary" id="save">保存设置</button><button id="back">返回</button></div>');on("back",manage);on("save",async()=>{for(const k of ["name","heading","intro"])d[k]=$("#"+k).value;for(const k of ["logo"])d[k]=await upload(k+"Up")||$("#"+k).value;d.groups=d.groups.map((_,i)=>$("#g"+i).value);d.kinds=d.kinds.map((old,i)=>{const a=$("#k"+i).value.split("|");if(a.length<old.length||a.some(s=>!s.trim()))throw Error("请保留已有分类的位置与名称");return a});const lines=(id,keys)=>$("#"+id).value.split("\n").filter(l=>l.trim()).map(line=>{const a=line.split("|").map(s=>s.trim());if(a.length!==keys.length||a.some(s=>!s))throw Error("请检查联系地点或友情链接格式");return Object.fromEntries(keys.map((k,i)=>[k,a[i]]))});d.offices=lines("locations",["title","address","phone"]);d.links=lines("friends",["title","url"]);await publish(d)})}
async function start(){
 if(!("serviceWorker" in navigator))throw Error("请在支持站点存储的浏览器中打开演示。");
 await navigator.serviceWorker.register("./demo-worker.js");
 const ready=await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error("演示环境未就绪，请重新打开本页。")),10000);
   navigator.serviceWorker.addEventListener("controllerchange",()=>{clearTimeout(timeout);resolve()},{once:true});
   ready.active.postMessage("claim-demo-page");
  });

 if(!inManagement()){await load();return}
 try{
  await load(true);
  $("#modal").classList.add("adminWorkspace");
  manage();
 }catch(error){
  if(error.status!==401)throw error;
  $("#login").click();
 }
}
start().catch(e=>$("#rows").textContent=e.message);
