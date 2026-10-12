import json,hashlib,zipfile,subprocess,os,re
from pathlib import Path
work=Path('D:/Codex/Work/SaJuUiBatchFourFinish-20261012-Joseph');root=Path('D:/Codex/Results/SaJuUiBatchFourFinish-20261012-Joseph')
read=lambda n:json.loads((root/n).read_text(encoding='utf-8'));sha=lambda b:hashlib.sha256(b).hexdigest()
r=read('commit-push-final-preservation.json');assert r['validated_new_fix_count']==5 and r['remote_match'] and r['ordinary_commit_count']==1 and r['nonforce_push_count']==1
repo=Path(r['repo']);env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',GIT_TERMINAL_PROMPT='0',GCM_INTERACTIVE='Never')
def git(args):return subprocess.check_output(['git','-c',f'safe.directory={repo.as_posix()}','-C',str(repo),*args],env=env)
assert git(['rev-parse','HEAD']).decode().strip()==r['commit'] and git(['status','--porcelain']).decode().strip()==''
archive=root/f'SaJu_UI_Batch4_Final_FiveFixes_20261012_Joseph_{r["commit"][:8]}.zip';assert not archive.exists();members={}
for x in r['native_and_git_bytes']:
    f=x['file'];assert '..' not in Path(f).parts and not Path(f).is_absolute();native=(repo/f).read_bytes();blob=git(['show',r['commit']+':'+f]);assert len(native)==x['native_bytes'] and sha(native)==x['native_sha256'];assert len(blob)==x['git_bytes'] and sha(blob)==x['git_sha256'];members['git/'+f]=blob
    if f in r['modified_preexisting_products'] or f in r['new_qa_scripts']:members['working-native/'+f]=native
for n in ['commit-push-final-preservation.json','commit-process.log','push-process.log','five-products.patch','post-documentation-types.json','post-documentation-types.log']:
    members['post-commit-evidence/'+n]=(root/n).read_bytes()
for directory,label in [(work/'authoring','current-authoring'),(Path('D:/Codex/Work/SaJuUiBatchFour-20261011-Joseph/authoring'),'prior-four-authoring')]:
    for f in sorted(directory.iterdir()):
        assert not f.is_symlink()
        if f.is_file():members[label+'/'+f.name]=f.read_bytes()
summary=read('final-validation-summary.json');assert summary['validated_new_fix_count']==5 and summary['final_regression']['total_passed']==72 and summary['types_exit']==summary['production_build_exit']==0
members['README.txt']=(f'FINAL FIVE FIXES - SaJu UI batch four, Joseph, 2026-10-12\nBranch: {r["branch"]}\nOne ordinary commit / one nonforce push; confirmed remote SHA: {r["commit"]}\nFive new improvements: native Manse required birth fields; additional Saved render boundaries; named existing Pokedex dialog; nonempty string create ID; whitespace-only chat acknowledgement rejection retaining the question draft.\nHistorical Manse label and Saved analysis/element guards are retained source/WIP, excluded from the five count. Prior empty-string chat cases are controls. Original failed reproductions and corrections remain intact.\nCurrent-code native Chrome regression 72/72 PASS; individual fifth 12/12; type/build/post-documentation types PASS. Existing changed-file lint: {r["lint_existing_errors"]} errors/{r["lint_existing_warnings"]} warnings retained, new product/QA diagnostics zero. Full-repository lint is not claimed clean.\nExactly five preexisting product paths were modified; all {r["all_other_preexisting_tree_entries_identical"]} other preexisting Git entries are identical. Original {r["old_remote_refs_preserved"]} remote refs, legacy WIP, five art checkouts, canonical model/runtime bytes and previous evidence are preserved. No main/PR/merge/deployment/auth/billing/provider/access/default-model/other-process changes.\nUI pixels are actual native browser captures, not generated images or 3D renders. All fixtures are fictional; no real backend/DB/Gemini, calendar correctness, hosted, physical-device or screen-reader acceptance.\nThe reply guard uses ECMAScript trim emptiness without trimming useful reply formatting. It is not a policy for every invisible Unicode character.\nGit canonical LF blobs and tested native source bytes are both included and verified. ZIP CRC, all entry bytes and source hashes are verified. Credentials, actual personal DB, profiles, dependencies, build directories, raw hosting configuration and model bytes are excluded.\nCurrent new owner-only Drive backup records are included; older blocked records are historical and superseded. Drive permission/size metadata is evidence, not an independent remote byte rehash.\n').encode('utf-8')
patterns={
 'private-key':re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----'),
 'google-api-key':re.compile(rb'AIza[0-9A-Za-z_-]{35}'),
 'github-token':re.compile(rb'(?:gh[pousr]_[0-9A-Za-z]{30,}|github_pat_[0-9A-Za-z_]{40,})'),
 'slack-token':re.compile(rb'xox[baprs]-[0-9A-Za-z-]{20,}'),
 'aws-access-key':re.compile(rb'(?:AKIA|ASIA)[A-Z0-9]{16}'),
 'openai-key':re.compile(rb'sk-(?:proj-|svcacct-)?[0-9A-Za-z_-]{32,}'),
 'credential-uri':re.compile(rb'(?:https?|postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s:/@"<>]{1,80}:[^\s/@"<>]{8,200}@'),
 'email':re.compile(rb'(?i)[a-z0-9.!#$%&\x27*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+')}
findings=[];text_count=0;image_count=0
for name,data in members.items():
    assert not any(p in {'.git','.codex','.aws','.openai','node_modules','dist','chrome-profile'} or p.startswith('.env') or p=='.npmrc' or p=='db.json' for p in Path(name).parts)
    assert not name.endswith(('.glb','.blend','.glb.gz'))
    if name.endswith('.png'):
        assert data.startswith(b'\x89PNG\r\n\x1a\n');image_count+=1;continue
    data.decode('utf-8');text_count+=1
    for kind,pattern in patterns.items():
        for m in pattern.finditer(data):findings.append({'file':name,'kind':kind,'offset':m.start(),'match_sha256':sha(m.group()),'value_not_printed':True})
privacy={'status':'PASS_FINAL_PAYLOAD_STRUCTURAL_AND_TEXT_CREDENTIAL_PERSONAL_DATA_REVIEW' if not findings else 'BLOCKED_PENDING_REDACTED_MATCH_REVIEW','text_entries':text_count,'native_fictional_ui_png_entries':image_count,'findings_redacted':findings,'actual_values_not_printed':True,'privacy_limits':'Structural provenance and patterns do not prove absence of every encoded secret; images originate only from fictional intercepted native UI cases.'}
with (root/'final-payload-privacy-review.json').open('x',encoding='utf-8') as f:json.dump(privacy,f,ensure_ascii=False,indent=2);f.write('\n')
assert not findings,'Review privacy candidates before creating/uploading final ZIP; do not print values'
members['post-commit-evidence/final-payload-privacy-review.json']=(root/'final-payload-privacy-review.json').read_bytes()
members['SHA256SUMS']=''.join(f'{sha(b)}  {n}\n' for n,b in sorted(members.items())).encode('utf-8')
prefix=f'SaJuUiBatchFourFinalFive_{r["commit"][:8]}/'
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,data in sorted(members.items()):z.writestr(prefix+name,data)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist())==len(members)
    for name,data in members.items():assert z.read(prefix+name)==data
proof={'status':'PASS_FINAL_FIVE_FIX_ZIP_CRC_ALL_ENTRIES_GIT_BLOBS_NATIVE_BYTES_AND_PRIVACY_VERIFIED','archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive.read_bytes()),'entries':len(members),'commit':r['commit'],'branch':r['branch'],'validated_new_fix_count':5,'git_entries_verified':len(r['native_and_git_bytes']),'native_product_entries':5,'native_qa_entries':2,'ordinary_commit_count':1,'nonforce_push_count':1,'privacy_review_path':str(root/'final-payload-privacy-review.json'),'credentials_db_profiles_dependencies_raw_hosting_or_models_packaged':False}
with (root/'final-archive-verification.json').open('x',encoding='utf-8') as f:json.dump(proof,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps(proof,ensure_ascii=True))