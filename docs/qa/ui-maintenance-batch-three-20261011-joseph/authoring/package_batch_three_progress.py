import sys, json, hashlib, zipfile, subprocess
from pathlib import Path
task='SaJuUiBatchThree-20261011-Joseph'
work=Path('D:/Codex/Work')/task
results=Path('D:/Codex/Results')/task
repo=Path('D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo')
number=int(sys.argv[1])
assert 0 < number < 5
sha=lambda data:hashlib.sha256(data).hexdigest()
read=lambda name:json.loads((results/name).read_text(encoding='utf-8'))
progress=read(f'progress-{number}of5.json')
assert progress['validated_new_fix_count']==number and not progress['commit_created'] and not progress['push_performed']
pre=read('batch-preflight.json')
def git(args):
    return subprocess.check_output(['git','-c',f'safe.directory={repo.as_posix()}','-C',str(repo),*args]).decode('utf-8').rstrip()
assert git(['rev-parse','HEAD'])==pre['basis'] and git(['branch','--show-current'])==pre['branch']
modified=git(['diff','--name-only',pre['basis']]).splitlines()
assert set(modified).issubset({item['file'] for item in pre['sources']})
archive=results/f'SaJu_UI_Batch3_Progress_{number}of5_20261011_Joseph_05b1e047.zip'
assert not archive.exists()
members={}
for file in sorted(results.rglob('*')):
    if file.is_file() and file.suffix!='.zip':
        assert not file.is_symlink()
        members['evidence/'+file.relative_to(results).as_posix()]=file.read_bytes()
for file in sorted((work/'authoring').glob('*')):
    if file.is_file():
        assert not file.is_symlink()
        members['authoring/'+file.name]=file.read_bytes()
for source in pre['sources']:
    file=repo/source['file']
    expected=source['sha256']
    for index in range(1,number+1):
        change=read(f'changes/fix-{index}.json')
        for item in change['files']:
            if item['file']==source['file']:expected=item['after_sha256']
    data=file.read_bytes()
    assert sha(data)==expected
    members['current-WIP/'+source['file']]=data
members['current-WIP.patch']=subprocess.check_output(['git','-c',f'safe.directory={repo.as_posix()}','-C',str(repo),'diff','--binary',pre['basis'],'--',*[item['file'] for item in pre['sources']]])
members['README.txt']=(f'New third UI batch: {number}/5 independently reproduced and verified fixes.\nBranch: {pre["branch"]}\nBasis: {pre["basis"]}\nNo intermediate commit or push. Previous completed fixes/tests are excluded.\nOnly isolated synthetic browser data and relevant source/evidence are included.\nNo credential files, database contents, browser profiles, dependencies, builds, model bytes or unrelated private material.\n').encode('utf-8')
prefix=f'SaJuUiBatchThreeProgress{number}of5/'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as zipped:
    for name,data in sorted(members.items()):zipped.writestr(prefix+name,data)
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None and len(zipped.namelist())==len(members)
    for name,data in members.items():assert zipped.read(prefix+name)==data
proof={'status':f'PASS_INTERMEDIATE_{number}OF5_WIP_SOURCE_REPORT_ZIP_ENTRY_BYTES_AND_CRC_VERIFIED','validated_new_fix_count':number,'commit_batch_target':5,'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes()),'entries':len(members),'commit_created':False,'push_performed':False,'excluded':['credentials','database contents','profiles','dependencies','build outputs','models','unrelated personal information']}
with (results/f'intermediate-archive-{number}of5-verification.json').open('x',encoding='utf-8') as stream:json.dump(proof,stream,ensure_ascii=False,indent=2);stream.write('\n')
print(json.dumps(proof))
