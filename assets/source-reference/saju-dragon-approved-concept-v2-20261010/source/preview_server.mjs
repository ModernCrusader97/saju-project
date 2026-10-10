// Local-only preview of the delivered actual GLB render; no files beyond two explicit inputs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const a=process.argv.slice(2),get=n=>a[a.indexOf(n)+1];
const video=path.resolve(get("--video")),poster=path.resolve(get("--poster"));
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><title>SaJu 실제 GLB idle 검토</title>
<style>body{font:18px system-ui;background:#252828;color:#f7f4ed;margin:24px}main{max-width:720px;margin:auto}video{width:640px;max-width:100%;background:#aaa;border-radius:12px}button{padding:10px;margin:8px 8px 8px 0}p{font-size:15px}</style>
<main><h1>새 용 후보 · 실제 GLB 렌더</h1><video id="idle" src="/idle.mp4" poster="/poster.png" controls loop playsinline preload="auto"></video>
<div><button id="play" onclick="document.getElementById('idle').play()">재생</button><button id="pause" onclick="document.getElementById('idle').pause()">일시정지</button><button id="first" onclick="document.getElementById('idle').currentTime=0">시작</button><button id="boundary" onclick="document.getElementById('idle').currentTime=5.5">루프 경계</button></div>
<p id="status">로딩</p><p>Blender가 실제 최종 GLB를 불러 렌더한 6초 영상입니다.</p></main>
<script>const v=document.getElementById('idle'),s=document.getElementById('status');let wraps=0,last=0;
function update(){if(v.currentTime+1<last&&!v.paused)wraps++;last=v.currentTime;s.textContent='시간 '+v.currentTime.toFixed(3)+' / '+v.duration+'초 · '+(v.paused?'정지':'재생')+' · 루프 통과 '+wraps+' · '+v.videoWidth+'×'+v.videoHeight;requestAnimationFrame(update);}update();</script></html>`;
const server=http.createServer((req,res)=>{
 if(!["GET","HEAD"].includes(req.method)){res.writeHead(405);return res.end();}
 const pathname=new URL(req.url,"http://localhost").pathname;
 if(pathname==="/"){res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});return res.end(req.method==="HEAD"?"":html);}
 const file=pathname==="/idle.mp4"?video:pathname==="/poster.png"?poster:null;
 if(!file){res.writeHead(404);return res.end();}
 const size=fs.statSync(file).size,type=pathname.endsWith(".mp4")?"video/mp4":"image/png";
 let start=0,end=size-1,status=200;
 if(req.headers.range){const m=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
  if(!m){res.writeHead(416,{"Content-Range":"bytes */"+size});return res.end();}
  start=+m[1];end=m[2]?Math.min(+m[2],size-1):size-1;status=206;
  if(start>end||start>=size){res.writeHead(416,{"Content-Range":"bytes */"+size});return res.end();}}
 const headers={"Content-Type":type,"Content-Length":end-start+1,"Accept-Ranges":"bytes","Cache-Control":"no-store"};
 if(status===206)headers["Content-Range"]="bytes "+start+"-"+end+"/"+size;
 res.writeHead(status,headers);if(req.method==="HEAD")return res.end();
 fs.createReadStream(file,{start,end}).pipe(res);
});
server.listen(0,"127.0.0.1",()=>console.log("ACTUAL_VIDEO_PREVIEW=http://127.0.0.1:"+server.address().port+"/"));

