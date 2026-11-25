"use strict";
const $=s=>document.querySelector(s), esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe=v=>{try{const u=new URL(v,document.baseURI);return ["http:","https:"].includes(u.protocol)?esc(u.href):"#"}catch{return "#"}};
let data,version,admin,group=-1,kind=-1,page=1,query="";
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
 $("#services").innerHTML="";
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
function detail(r){modal(r.title,'<small>'+esc(data.groups[r.group])+' · '+esc(r.date)+'</small><p class="body">'+esc(r.body)+'</p><div class="actions">'+(r.file?external("查看或下载附件",r.file):"")+(r.url?external("查看原文",r.url):"")+'</div>')}
function maps(){modal("地图导航",data.offices.map(o=>'<h3>'+esc(o.title)+'</h3><p>'+esc(o.address)+'</p>'+external("打开地图导航","https://uri.amap.com/search?keyword="+encodeURIComponent(o.address))).join(""))}
function calculator(){modal("费用计算器",'<iframe title="招标代理服务费计算器" src="./calculator.html" style="border:0;width:100%;height:400px"></iframe>')}

fetch("./content.json").then(r=>{if(!r.ok)throw Error();return r.json()}).then(v=>{data=v;render()}).catch(()=>$("#rows").textContent="加载失败，请刷新页面");
