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
summary=json.loads((repo/'docs/qa/ui-maintenance-batch-three-20261011-joseph/validation-summary.json').read_text(encoding='utf-8'))
assert summary['visual']['byte_identical_count']==13 and summary['visual']['compared']==16 and summary['visual']['different_pixels_total']==43
members['README.txt']=(f'UI maintenance batch three, Joseph, 2026-10-11: five new fixes. Prior completed fixes/suites counted or rerun: zero.\nBranch: {r["branch"]}\nCommit and confirmed remote SHA: {commit}\nExactly one ordinary commit and nonforce push. Native current-batch Chrome 46/46 PASS, types/production build PASS. Existing lint: 4 errors/7 warnings retained, new diagnostics zero.\nNormal raw UI captures: 16 reviewed, 13 byte/pixel-identical, three with 43 total differing edge pixels, maximum channel delta 5/255. CSS/affected fixture observations are identical. Raster variance is an inference; exact Chrome cause is not independently established. All original PNGs, strict-guard failure and diagnostics are preserved; changed/error UI was directly inspected.\nOriginal 61 remote branches, legacy WIP, protected art and defaults preserved. The existing parser already rejects known-time blanks; fix 1 improves native required validation/focus.\nNo real backend, database, Gemini, calculation correctness, hosted deployment, 3D render or physical-device claim. Actual native Chrome with isolated fictional fixtures only.\nNo credentials, raw hosting values, personal database bodies, profiles, dependencies, build outputs or model bytes are packaged. Git blobs, native CRLF products, ZIP CRC and each entry were verified.\n').encode('utf-8')
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
