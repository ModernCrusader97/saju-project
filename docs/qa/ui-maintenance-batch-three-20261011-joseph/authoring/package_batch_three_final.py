import json,hashlib,zipfile,subprocess,os
from pathlib import Path
work=Path('D:/Codex/Work/SaJuUiBatchThree-20261011-Joseph');results=Path('D:/Codex/Results/SaJuUiBatchThree-20261011-Joseph')
read=lambda n:json.loads((results/n).read_text(encoding='utf-8'));sha=lambda b:hashlib.sha256(b).hexdigest()
r=read('commit-push-preservation.json');assert r['status']=='PASS_ONE_ORDINARY_COMMIT_PUSH_FOR_FIVE_NEW_BATCH3_UI_FIXES'
assert r['validated_new_fix_count']==5 and r['remote_match'] and r['ordinary_commit_count']==1 and r['nonforce_push_count']==1
repo=Path(r['repo']);commit=r['commit'];env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
def git(args):return subprocess.check_output(['git','-c',f'safe.directory={repo.as_posix()}','-C',str(repo),*args],env=env)
assert git(['rev-parse','HEAD']).decode().strip()==commit and git(['status','--porcelain']).decode().strip()==''
archive=results/f'SaJu_UI_Batch3_Final_20261011_Joseph_{commit[:8]}.zip';assert not archive.exists();members={}
for item in r['git_and_local_bytes']:
    relative=item['path'];assert '..' not in Path(relative).parts and not Path(relative).is_absolute()
    data=git(['show',commit+':'+relative]);assert len(data)==item['git_bytes'] and sha(data)==item['git_sha256']
    native=(repo/relative).read_bytes();assert len(native)==item['working_bytes'] and sha(native)==item['working_sha256']
    members['git/'+relative]=data
    if relative in r['only_modified_preexisting_paths']:members['working-native/'+relative]=native
for n in ['commit-push-preservation.json','commit-process.log','push-process.log','minimal-products.patch']:members['post-commit-evidence/'+n]=(results/n).read_bytes()
for file in sorted((work/'authoring').iterdir()):
    assert not file.is_symlink()
    if file.is_file():members['authoring-current/'+file.name]=file.read_bytes()
members['README_ko.txt']=(f'새 세 번째 UI 묶음 5/5 완료. 이전 완료 항목 재실행·재계수 0.\n브랜치: {r["branch"]}\n커밋: {commit}\n일반 commit/push 각 1회·원격 SHA 일치.\n현재 Chrome 46/46, 타입·프로덕션 빌드 통과. 기존 lint 오류 {r["lint_existing_errors"]}·경고 {r["lint_existing_warnings"]} 보존, 새 진단 0.\n정상 UI PNG 16개·CSS 바이트 동일; 변경 화면 직접 픽셀 확인. 원본 FAIL·하네스 수정 진단·각 검증·원본 네이티브 CRLF 및 Git LF 바이트 보존.\n기존 브랜치 61개·원본 WIP·보호 아트·기본 모델 보존. 빈 시간은 기존 파서가 거절하며 새 수정은 네이티브 필수 입력·초점 개선임.\n실제 API·DB·Gemini·개인 저장소·3D·배포·물리 기기 검증은 포함하지 않음. 가상 응답 및 새 격리 Chrome 프로필만 사용.\ncredentials·hosting 원문/값·DB 내용·프로필·dependencies·빌드 출력·모델 바이트·무관 개인정보 제외.\n').encode('utf-8')
for name in members:
    parts=Path(name).parts
    assert not any(p in {'.git','.codex','.aws','.openai','node_modules','dist','chrome-profile'} or p.startswith('.env') or p=='.npmrc' for p in parts)
    assert not name.endswith(('.glb','.blend','.glb.gz'))
prefix=f'SaJuUiBatchThreeFinal_{commit[:8]}/'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,data in sorted(members.items()):z.writestr(prefix+name,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist())==len(members)
    for name,data in members.items():assert z.read(prefix+name)==data
proof={'status':'PASS_FINAL_BATCH3_ZIP_ENTRIES_CRC_GIT_BLOBS_AND_NATIVE_BYTES_VERIFIED','archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes()),'entries':len(members),'commit':commit,'validated_new_fix_count':5,'ordinary_commit_count':1,'nonforce_push_count':1,'git_entries_verified':len(r['git_and_local_bytes']),'native_product_entries':5,'raw_hosting_values_credentials_db_or_model_bytes_packaged':False}
with (results/'final-archive-verification.json').open('x',encoding='utf-8') as f:json.dump(proof,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps(proof))
