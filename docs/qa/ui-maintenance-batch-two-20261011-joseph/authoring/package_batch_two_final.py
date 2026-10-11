import sys, json, hashlib, zipfile, subprocess, os
from pathlib import Path
mode=sys.argv[1]
task='SaJuUiBatchTwo-20261011-Joseph'
work=Path('D:/Codex/Work')/task
results=Path('D:/Codex/Results')/task
repo=Path('D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo')
sha=lambda data:hashlib.sha256(data).hexdigest()
read=lambda name:json.loads((results/name).read_text(encoding='utf-8'))
if mode=='prepare-evidence':
    assert read('production-build-v3.json')['exit_code']==0 and read('types.json')['exit_code']==0
    original=(work/'authoring/assemble_batch_two_v3.mjs').read_text(encoding='utf-8')
    needle="};write('validation-summary.json',summary);"
    assert original.count(needle)==1
    replacement="};summary.build_input_recovery={canonical_inputs:read('canonical-build-input-restoration.json'),local_binding_metadata:read('local-binding-build-input-restoration.json'),actual_resource_id_format:read('hosting-resource-id-format-diagnostic.json'),canonical_runtime_bytes:read('canonical-runtime-output-byte-preservation.json'),failed_build_attempts_retained:2,recovery_product_edits_or_new_fix_count:0};summary.direct_visual_inspection=read('visual-inspection.json');summary.limits.push('Sparse branch switch removed required build inputs. Seven missing canonical assets/code inputs and the nonsecret 91-byte project binding metadata were materialized byte-exact from basis Git objects without replacing existing files or changing sparse/auth/permissions/data. Two failed builds and overly strict helper schema guards are retained; actual resource ID is a 40-character ASCII identifier, not a UUID. Build-v3 and first nonincremental types passed; five existing runtime assets remain byte-identical. No raw hosting config values are packaged.');write('validation-summary.json',summary);"
    with (work/'authoring/assemble_batch_two_v4.mjs').open('x',encoding='utf-8',newline='') as stream:stream.write(original.replace(needle,replacement))
    print(json.dumps({'status':'PASS_SUCCESSFUL_BUILD_V3_SELECTOR_AND_RECOVERY_LIMITS_PREPARED','raw_hosting_values_packaged':False,'product_edits':0}))
elif mode=='final':
    receipt=read('commit-push-preservation.json')
    assert receipt['status']=='PASS_ONE_ORDINARY_COMMIT_PUSH_FOR_FIVE_NEW_BATCH2_UI_FIXES'
    assert receipt['validated_new_fix_count']==5 and receipt['remote_match'] and receipt['ordinary_commit_count']==1 and receipt['nonforce_push_count']==1
    env=dict(os.environ,GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
    def git(args):return subprocess.check_output(['git','-c',f'safe.directory={repo.as_posix()}','-C',str(repo),*args],env=env)
    commit=receipt['commit']
    assert git(['rev-parse','HEAD']).decode().strip()==commit and git(['status','--porcelain']).decode().strip()==''
    archive=results/f'SaJu_UI_Batch2_Final_20261011_Joseph_{commit[:8]}.zip'
    assert not archive.exists()
    members={}
    for item in receipt['git_and_local_bytes']:
        relative=item['path']
        assert '..' not in Path(relative).parts and not Path(relative).is_absolute()
        data=git(['show',commit+':'+relative])
        assert len(data)==item['git_bytes'] and sha(data)==item['git_sha256']
        local=(repo/relative).read_bytes()
        assert len(local)==item['working_bytes'] and sha(local)==item['working_sha256']
        members['git/'+relative]=data
        if relative in receipt['only_modified_preexisting_paths']:members['working-native/'+relative]=local
    for name in ['commit-push-preservation.json','commit-process.log','push-process.log','minimal-products.patch']:
        members['post-commit-evidence/'+name]=(results/name).read_bytes()
    for file in sorted((work/'authoring').iterdir()):
        if file.is_file():
            assert not file.is_symlink()
            members['authoring-current/'+file.name]=file.read_bytes()
    members['README_ko.txt']=(f'UI 두 번째 묶음: 새 수정 5/5, 일반 commit/push 1회, 원격 SHA 일치.\n브랜치: {receipt["branch"]}\n커밋: {commit}\n이번 Chrome 회귀 26/26, 빌드-v3 및 비증분 타입 통과. 기존 lint 오류 {receipt["lint_existing_errors"]}·경고 {receipt["lint_existing_warnings"]} 유지, 새 진단 0.\n기존 원격 브랜치 60개, 원본 WIP 3개, 보호 아트 작업 5개 및 나머지 기존 Git 항목 1158개 보존.\n이전 완료 시험 재실행 및 재계수 0. 정상 UI 8개·CSS 바이트 비교와 실제 캡처·원본 FAIL·복구 진단은 증거 폴더 참고.\n원본 Git 바이트와 제품 작업 파일 CRLF 바이트를 별도로 포함.\n자격 증명·hosting.json 원문/값·DB 내용·브라우저 프로필·의존성·빌드 출력·모델 바이트·무관한 개인정보는 제외.\n실제 서버·DB·Gemini·3D·배포·물리 기기 검증은 포함하지 않음.\n').encode('utf-8')
    for name in members:
        parts=Path(name).parts
        assert not any(part in {'.git','.codex','.aws','.openai','node_modules','dist','chrome-profile'} or part.startswith('.env') or part=='.npmrc' for part in parts)
        assert not name.endswith(('.glb','.blend','.glb.gz'))
    prefix=f'SaJuUiBatchTwoFinal_{commit[:8]}/'
    with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zipped:
        for name,data in sorted(members.items()):zipped.writestr(prefix+name,data)
    with zipfile.ZipFile(archive) as zipped:
        assert zipped.testzip() is None and len(zipped.namelist())==len(members)
        for name,data in members.items():assert zipped.read(prefix+name)==data
    proof={'status':'PASS_FINAL_BATCH2_ZIP_ENTRIES_CRC_GIT_BLOBS_AND_NATIVE_BYTES_VERIFIED','archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes()),'entries':len(members),'commit':commit,'validated_new_fix_count':5,'ordinary_commit_count':1,'nonforce_push_count':1,'git_entries_verified':len(receipt['git_and_local_bytes']),'native_product_entries':3,'raw_hosting_config_values_or_model_bytes_packaged':False}
    with (results/'final-archive-verification.json').open('x',encoding='utf-8') as stream:json.dump(proof,stream,ensure_ascii=False,indent=2);stream.write('\n')
    print(json.dumps(proof))
else:raise ValueError('Unknown packaging mode')
