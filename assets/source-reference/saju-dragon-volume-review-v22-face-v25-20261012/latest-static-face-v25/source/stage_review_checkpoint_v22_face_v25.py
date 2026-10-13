import hashlib,json,shutil
from pathlib import Path
from datetime import datetime,timezone
W=Path("D:/Codex/Work/SaJuDragonPhotoReconstructionV8-20261012-Joseph")
R=Path("D:/Codex/Results/SaJuDragonPhotoReconstructionV8-20261012-Joseph")
O=R/"review-checkpoint-v22-face-v25-01"
assert not O.exists(),"Use a new checkpoint folder"
MIN_FREE=20*1024**3
assert shutil.disk_usage(R).free>=MIN_FREE,"20 GiB admission unchanged"
def sha(p):
 h=hashlib.sha256()
 with p.open("rb") as f:
  for b in iter(lambda:f.read(4*1024*1024),b""):h.update(b)
 return h.hexdigest()
def read(p):return json.loads(p.read_text(encoding="utf8"))
def create(p,text):
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open("x",encoding="utf8",newline="\n") as f:f.write(text)
rows=[]
def cp(p,t):
 assert p.is_file() and not p.is_symlink() and not t.exists(),str(p)
 before=sha(p);size=p.stat().st_size
 t.parent.mkdir(parents=True,exist_ok=True)
 with p.open("rb") as src,t.open("xb") as dst:shutil.copyfileobj(src,dst,4*1024*1024)
 assert t.stat().st_size==size and sha(t)==before and sha(p)==before,str(p)
 rows.append({"file":t.relative_to(O).as_posix(),"bytes":size,"sha256":before,"source":p.as_posix()})
faceQa=["volume-v25-static-technical-qa.json","volume-v25-eye-rim-contact.json","volume-v25-eye-shell-self-occlusion.json","volume-v25-mane-root-contact.json"]
for n in faceQa:assert read(R/n)["status"].startswith("PASS"),n
diag=read(R/"face-diagnostics-v25-01"/"diagnostic-report.json")
assert not diag["native_geometry_modified"] and not diag["native_saved"]
assert all(x["brown_radial_concave_samples"]==0 for x in diag["eyes"])
assert sha(R/"volume-refinement-v25"/"SaJu_Dragon_V8_Volume_Refinement_v25.blend")==diag["source_native_sha256"]
assert sha(W/"authoring"/"build_dragon_v8_volume_v25.py")=="691202de75b0c3e11934a1fefa12dd1cf200e41edd88ffd9163b695b42308c4c"
assert read(R/"volume-v22-mane-root-contact-before-v23.json")["status"].startswith("FAIL")
assert read(R/"qa-volume-v22-01"/"native-glb-verification.json")["status"]=="PASS_NATIVE_AND_GLB_ROUNDTRIP"
O.mkdir()
for p in sorted((R/"delivery-volume-v22-01").rglob("*")):
 if p.is_file():
  assert not any(x in (".git",".env",".npmrc","node_modules","data") for x in p.relative_to(R/"delivery-volume-v22-01").parts)
  cp(p,O/"animated-checkpoint-v22"/p.relative_to(R/"delivery-volume-v22-01"))
for p in sorted((R/"volume-refinement-v25").rglob("*")):
 if p.is_file():cp(p,O/"latest-static-face-v25"/"native"/p.relative_to(R/"volume-refinement-v25"))
for n in ["build_dragon_v8_volume_v25.py","verify_v8_static.py","diagnose_volume_eye_contact_1624.py","diagnose_eye_front_self_occlusion_v2.py","diagnose_mane_root_skin_contact.py","diagnose_v23_eye_curvature_lighting.py","compare_v25_diagnostic_face_height.mjs","png_decode.mjs","stage_review_checkpoint_v22_face_v25.py"]:
 cp(W/"authoring"/n,O/"latest-static-face-v25"/"source"/n)
for n in faceQa:
 cp(R/n,O/"latest-static-face-v25"/"qa"/n)
for n in ["volume-v25-static-qa.log","volume-v25-eye-contact-qa.log","volume-v25-eye-shell-qa.log","volume-v25-mane-root-qa.log"]:
 if (R/n).is_file():cp(R/n,O/"latest-static-face-v25"/"qa"/n)
for folder in ["face-diagnostics-v25-01","face-diagnostics-v25-height-matched-01"]:
 for p in sorted((R/folder).iterdir()):
  if p.is_file():cp(p,O/"latest-static-face-v25"/"diagnostics"/folder/p.name)
for n in ["volume-v22-mane-root-contact-before-v23.json","volume-v22-mane-root-contact-before-v23.log","volume-v23-mane-root-contact.json"]:
 cp(R/n,O/"known-regressions"/n)
for folder,names in [
 ("backup-volume-v01-v22-01",["preservation-manifest.json","restore_preserved_sources.py","local-archive-integrity.json","cloud-upload-receipt.json"]),
 ("backup-face-v23-v25-01",["face-addendum-manifest.json","cloud-face-upload-receipt.json"])]:
 for n in names:cp(R/folder/n,O/"private-backup-maps"/folder/n)
state={
 "status":"REVIEW_CHECKPOINT_ONLY_APPEARANCE_COMPLETION_HOLD",
 "created_utc":datetime.now(timezone.utc).isoformat(),
 "branch":"art/dragon-photo-volume-refinement-v8-20261012-joseph",
 "basis":"64b33195ff39c5c5b02e3188ede4ea2be91ade07",
 "latest_face":{"version":25,"static_only":True,"native_sha256":diag["source_native_sha256"],"builder_sha256":"691202de75b0c3e11934a1fefa12dd1cf200e41edd88ffd9163b695b42308c4c","brown_radial_concave_samples":[x["brown_radial_concave_samples"] for x in diag["eyes"]],"eye_contact_shell_skin_and_mane_root_checks_pass":True,"new_face_rig_idle_and_full_regeneration_tested":False},
 "older_animated_checkpoint":{"version":22,"glb_sha256":"5189fdd5894bf9d17c805f9340c20e2eb08525c635f9fb9add41758abfe4913d","native_sha256":"e4c55088f2d7eaec6d1d14f0bad1c2dcb702721ad02856ee3c5f3c85bee1abbd","idle_seconds":6,"native_glb_runtime_loop_and_regeneration_checks_passed":True,"later_mane_root_contact_regression_failed":True,"appearance_approved":False},
 "backup":{"distinct_preserved_file_records":836,"private_zip_parts":23,"local_zip_crc_sha256_and_source_unchanged":True,"remote_metadata_size_and_owner_only_checked":True,"remote_body_rehashed":False},
 "review_pngs":{
  "equal_face_height_glossy":"https://drive.google.com/file/d/1EfkUQbLqArH8yTa3fp6gM9ErDHFbkPYx/view?usp=drivesdk",
  "equal_face_height_matte":"https://drive.google.com/file/d/18gEeMQ9114A3Dvj-ThDWaJTFLbevREGo/view?usp=drivesdk"
 },
 "site_batch_five":{"previously_verified":4,"unverified_wip":1,"paused":True,"not_retested_by_art_checks":True},
 "user_final_appearance_approved":False,"appearance_completion_hold":True,"default_product_model_or_other_animals_changed":False,"deployment_or_pr_requested":False
}
create(O/"review-state.json",json.dumps(state,ensure_ascii=False,indent=2)+"\n")
readme="""# SaJu Dragon — V22 idle / V25 얼굴 검토 체크포인트

승인된 2D 원본을 기준으로 새로 만든 실제 Blender 작업입니다. 최종 외형 검토는 보류 상태이며, 최신 얼굴과 이전 애니메이션 모델을 별도 폴더에 보존합니다.

- latest-static-face-v25/: 최신 정적 Blender 원본, 실제 렌더, 같은 이마/턱 높이로 맞춘 원본 비교, literal 생성 스크립트와 진단 도구. V25 얼굴의 새 rig·GLB·idle·전체 재생성 검증은 아직 실행하지 않았습니다.
- animated-checkpoint-v22/: 이전 편집 가능한 Blender 원본, GLB, 6초 Idle_Loop, 실제 GLB 재불러오기 렌더·영상 및 실제 재생성 검증 자료. V25 얼굴이 들어간 모델이 아닙니다.
- known-regressions/: V22 갈기 뿌리와 피부 사이의 뜬 간격을 뒤늦게 발견한 실패 원문과 V23의 접촉 통과 기록. V22의 기존 idle 검증 통과가 이 결함을 해결했다는 뜻은 아닙니다. V25는 수정된 뿌리의 정적 접촉 검사를 통과했습니다.
- private-backup-maps/: 모든 중간·실패·원본을 보존한 23개 비공개 Drive 복구 ZIP의 manifest와 영수증. 로컬 CRC/SHA256·원본 불변, 원격 크기·소유자만 접근을 확인했습니다. 원격 ZIP 본문을 재다운로드하여 해시 확인하지는 않았습니다.
- review-state.json / checkpoint-file-manifest.json: 버전별 상태, 보류 항목, 복사한 literal bytes와 SHA256.

V25에서는 안구 내부를 얼굴 표면에 따라 휘게 하던 방식에서 볼록한 타원구 캡으로 바꿨습니다. 실제 피부 교차선까지 눈의 가장자리를 잘라 접촉을 유지했고, 흰 부분은 주로 바깥쪽에 남겼습니다. 갈색 눈 표면의 방사 방향 오목 표본은 양쪽 모두 0개입니다. 노멀·폐쇄 표면·눈 접촉·눈 자체 가림·갈기 뿌리의 정적 검사는 통과했습니다. 이는 원본과의 외형 일치 승인을 의미하지 않습니다.

진단 렌더 두 장은 같은 geometry에서 광택/무광 재질만 바꿉니다. 원본의 정확한 카메라와 조명은 알려져 있지 않아 조명 근사 조건이라고 표시했습니다. 얼굴 비교는 이마 꼭대기와 턱 아래의 높이를 맞추고 가로 폭 차이는 유지했습니다. 승인 원본보다 넓은 주둥이·턱 윤곽 등은 외형 검토 대상입니다.

설치된 Blender 5.2.1로 V25 정적 모델을 새 폴더에 생성하는 명령:

    & 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --factory-startup --disable-autoexec --python-exit-code 1 --threads 4 --python latest-static-face-v25/source/build_dragon_v8_volume_v25.py -- --out 'D:/Codex/Results/새_V25_정적_폴더' --reference animated-checkpoint-v22/reference/approved-2D-concept-original.png --stills

V22의 실제 통과된 재생성 wrapper:

    & 'C:/Program Files/Blender Foundation/Blender 5.2/5.2/python/bin/python.exe' animated-checkpoint-v22/source/regenerate_v8_volume_v22.py --out 'D:/Codex/Results/새_V22_재생성_폴더'

V22 GLB는 43,276,624 bytes / 1,106,644 triangles이며 모바일·브라우저 GPU 성능은 검증하지 않았습니다. 실제 렌더의 스튜디오 수평선을 보존했습니다. 관련 types/build 증거는 제품 코드가 같은 V20 시점의 통과 결과이고, 사이트 batch-five의 추가 검증 결과가 아닙니다.

별도 비공개 아트 브랜치의 검토 자료 추가입니다. 제품 기본 모델, 다른 11종, main, 기존 브랜치와 UI WIP는 보존합니다.
"""
create(O/"README.md",readme)
create(O/".gitattributes","* -text whitespace=cr-at-eol\n*.log binary\n")
allrows=[]
for p in sorted(O.rglob("*")):
 if p.is_file():allrows.append({"file":p.relative_to(O).as_posix(),"bytes":p.stat().st_size,"sha256":sha(p)})
create(O/"checkpoint-file-manifest.json",json.dumps({"status":"LITERAL_COPY_SHA256_VERIFIED_REVIEW_HOLD","files":allrows,"original_source_copies":rows,"manifest_self_excluded":True,"appearance_completion_hold":True},ensure_ascii=False,indent=2)+"\n")
assert shutil.disk_usage(R).free>=MIN_FREE
print(json.dumps({"status":"PASS_REVIEW_CHECKPOINT_LITERAL_BYTES_WITH_SEPARATE_VERSIONS","folder":O.as_posix(),"files":len(allrows)+1,"copy_bytes":sum(x["bytes"] for x in allrows),"free_bytes_after":shutil.disk_usage(R).free,"appearance_completion_hold":True}))