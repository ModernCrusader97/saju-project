"use client";
import {useCanvasStatus} from "@/hooks/use-canvas-status";
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {createCharacterMaterialFixture} from '@/lib/planet/character-material-fixture';
import {bindCharacterRestCoordinates} from '@/lib/planet/character-rest-coordinates';
import {createImWaterStudyMaterial} from '@/lib/planet/im-water-study-material';

export default function ImWaterStudy(){
 const mount=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement|null>(null),play=useRef(false);
 const [running,setRunning]=useState(false),[reset,setReset]=useState(0);
 const {ready,error,setReady,setError}=useCanvasStatus(String(reset));
 useEffect(()=>{play.current=running},[running]);
 useEffect(()=>{
  const target=mount.current;if(!target)return;
  let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'})}catch{setError('이 브라우저에서 3D를 시작하지 못했어요.');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
  renderer.debug.onShaderError=()=>setError('물 재질 셰이더를 표시하지 못했어요.');
  const element=renderer.domElement;canvas.current=element;target.replaceChildren(element);element.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y';element.setAttribute('aria-label','임의 물 재질을 정지 상태로 살펴보는 상반신 3D 표본');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#102333');
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.65;
  scene.add(new THREE.HemisphereLight('#d9f3ff','#17364b',.6));const key=new THREE.DirectionalLight('#e9faff',2.1);key.position.set(-3,4,4);scene.add(key);const rim=new THREE.DirectionalLight('#89dfff',1.3);rim.position.set(3,3,-2);scene.add(rim);
  const handle=createImWaterStudyMaterial({quality:'high'}),fixture=createCharacterMaterialFixture(handle,'high'),binding=bindCharacterRestCoordinates(fixture.group,fixture.surfaceTargets);
  const pivot=new THREE.Group();fixture.group.position.y=-2.45;pivot.add(fixture.group);scene.add(pivot);fixture.update(0);handle.update(0);
  const camera=new THREE.PerspectiveCamera(32,1,.1,30);camera.position.set(0,.12,3.15);camera.lookAt(0,0,0);
  const resize=()=>{const w=Math.max(1,target.clientWidth),h=Math.max(1,target.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.z=Math.max(3.15,.92/(Math.tan(THREE.MathUtils.degToRad(16))*camera.aspect));camera.updateProjectionMatrix()};const observer=new ResizeObserver(resize);observer.observe(target);resize();
  let drag:{x:number,y:number,angle:number,pitch:number}|null=null;
  const down=(e:PointerEvent)=>{drag={x:e.clientX,y:e.clientY,angle:pivot.rotation.y,pitch:pivot.rotation.x};element.setPointerCapture(e.pointerId)};
  const move=(e:PointerEvent)=>{if(drag){pivot.rotation.y=drag.angle+(e.clientX-drag.x)*.007;pivot.rotation.x=Math.max(-.3,Math.min(.3,drag.pitch+(e.clientY-drag.y)*.003))}};const up=()=>{drag=null};
  let alive=true,frame=0,time=0,last=performance.now();const lost=(e:Event)=>{e.preventDefault();alive=false;setError('그래픽 연결이 끊겼어요. 초기화로 다시 열어주세요.')};
  element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',up);element.addEventListener('webglcontextlost',lost);
  const draw=(now:number)=>{if(!alive)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(play.current&&!document.hidden)time+=dt;
   try{handle.update(time);pivot.updateMatrixWorld(true);renderer.render(scene,camera);setReady(v=>v||true)}catch{setError('물 표본을 그리지 못했어요.');alive=false;return}frame=requestAnimationFrame(draw)};frame=requestAnimationFrame(draw);
  return()=>{alive=false;cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',up);element.removeEventListener('webglcontextlost',lost);binding.dispose();fixture.dispose();handle.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();target.replaceChildren();canvas.current=null};
 },[reset,setReady,setError]);
 const capture=()=>{if(!canvas.current)return;try{const a=document.createElement('a');a.href=canvas.current.toDataURL('image/png');a.download='im-water-upper-body.png';a.click()}catch{setError('이미지를 저장하지 못했어요.')}};
 return <section className="material-study"><div className="material-study-heading"><p>壬 · STILL MATERIAL STUDY</p><h2>임의 물, 가까이 보기</h2><span>먼저 멈춘 상태에서 깊이·물길·물마루를 확인합니다. 드래그하면 시점을 돌릴 수 있습니다.</span></div><div className="material-study-toolbar"><button onClick={()=>setRunning(v=>!v)}>{running?'정지 화면으로 보기':'물결 재생'}</button><button onClick={()=>{setRunning(false);setReset(v=>v+1)}}>초기화</button><button disabled={!ready} onClick={capture}>이미지 저장</button></div><div ref={mount} style={{height:'min(70vh,680px)',minHeight:380,borderRadius:20,overflow:'hidden'}}/>{error&&<p role="alert" className="material-error">{error}</p>}<p className="material-study-note">기존 체형에 적용하는 별도 재질 실험입니다. 원래 재질 비교 화면과 캐릭터 외형은 변경하지 않습니다.</p><details className="material-reference"><summary>물의 결 참고 이미지</summary><img src="/images/im-water-target.png" alt="짙은 물길과 밝은 물마루가 촘촘히 어우러진 물 정령 참고 이미지" loading="lazy" width={1024} height={1536} style={{height:"auto"}}/></details></section>;
}
