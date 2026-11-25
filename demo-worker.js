const base=new URL(self.registration.scope);
const json=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const dbReady=new Promise((resolve,reject)=>{
 const open=indexedDB.open("yisheng-client-demo-v1",1);
 open.onupgradeneeded=()=>{open.result.createObjectStore("site");open.result.createObjectStore("files")};
 open.onsuccess=()=>resolve(open.result);
 open.onerror=()=>reject(open.error);
});
function operation(store,mode,work){
 return dbReady.then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode);
  let result;
  work(tx.objectStore(store),value=>{result=value});
  tx.oncomplete=()=>resolve(result);
  tx.onabort=()=>reject(tx.error);
 }));
}
const read=(store,key)=>operation(store,"readonly",(table,done)=>{const r=table.get(key);r.onsuccess=()=>done(r.result)});
const write=(store,key,value)=>operation(store,"readwrite",table=>table.put(value,key));
async function handle(request,route){
 const url=new URL(request.url);
 if(route.startsWith("files/")){
  const file=await read("files",route);
  if(!file)return json("文件不存在",404);
  const image=["image/png","image/jpeg","image/webp","image/gif"].includes(file.type);
  return new Response(file,{headers:{"Content-Type":image?file.type:"application/octet-stream","Content-Disposition":image?"inline":"attachment; filename*=UTF-8''"+encodeURIComponent(url.searchParams.get("name")||"download"),"X-Content-Type-Options":"nosniff"}});
 }
 const token=request.headers.get("X-Demo-Session");
 const active=token&&Number(await read("site","session-"+token))>Date.now();
 if(route==="api/login"&&request.method==="POST"){
  const input=await request.json();
  if(input.username!=="demo"||input.password!=="Yisheng2026")return json("账号或密码不正确",401);
  const session=crypto.randomUUID();
  await write("site","session-"+session,Date.now()+8*3600000);
  return json(session);
 }
 if(route==="api/logout"){if(token)await operation("site","readwrite",store=>store.delete("session-"+token));return json(true)}
 if(route==="api/site"&&request.method==="GET" || route==="api/manage"&&request.method==="GET"&&active){
  const saved=await read("site","current");
  const data=saved?.data??await (await fetch(new URL("content.json",base))).json();
  if(route==="api/site")data.records=data.records.filter(row=>row.published!==false);
  return json({data,revision:saved?.revision||"initial",version:saved?.revision||"",admin:!!active});
 }
 if(!active)return json("请先登录演示账号",401);
 if(route==="api/site"&&request.method==="PUT"){
  const {data,version}=await request.json();
  const revision=crypto.randomUUID();
  const saved=await operation("site","readwrite",(table,done)=>{
   const get=table.get("current");
   get.onsuccess=()=>{
    if((get.result?.revision||"")!==version){done(false);return}
    table.put({data,revision},"current");done(true);
   };
  });
  return saved?json(revision):json("数据已更新，请刷新后重试",409);
 }
 if(route==="api/upload"&&request.method==="POST"){
  const file=await request.blob();
  if(file.size>16*1024*1024)return json("文件大小上限为 16 MB",413);
  const key="files/"+crypto.randomUUID();await write("files",key,file);
  return json(new URL(key+url.search,base).pathname+url.search);
 }
 return json("页面不存在",404);
}
self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
 const url=new URL(e.request.url);
 if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname))return;
 const route=url.pathname.slice(base.pathname.length);
 if(route.startsWith("api/")||route.startsWith("files/"))
  e.respondWith(handle(e.request,route).catch(()=>json("无法保存或读取浏览器演示数据，请检查浏览器存储空间。",500)));
});
