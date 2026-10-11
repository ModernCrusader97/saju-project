import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';
const mode=process.argv[2],number=Number(process.argv[3]),results='D:/Codex/Results/SaJuUiBatchThree-20261011-Joseph',repo='D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo',read=file=>JSON.parse(fs.readFileSync(results+'/'+file,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex'),write=(file,value)=>fs.writeFileSync(results+'/'+file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});assert(['apply','record'].includes(mode));assert(Number.isInteger(number)&&number>=1&&number<=5);
const pre=read('batch-preflight.json'),prior=read('progress-'+(number-1)+'of5.json'),baseline=read('before-v2/browser-results.json'),git=args=>execFileSync('git',['-c','safe.directory='+repo,'-C',repo,...args],{encoding:'utf8',windowsHide:true}).trimEnd();assert.equal(prior.validated_new_fix_count,number-1);assert.equal(git(['rev-parse','HEAD']),pre.basis);assert.equal(git(['branch','--show-current']),pre.branch);
const specs=[{id:'guin-known-time-required-field-focus',group:'time',files:['app/guin/page.tsx','app/guin/[id]/page.tsx'],expected:16,change:'Require known-hour/minute fields in relationship create/manual-join forms so native missing-field validation focuses the input before submission. Existing strict parser already rejects blanks; preserve valid known and unknown-time flows.'},{id:'guin-create-map-id-type',group:'id',files:['app/guin/page.tsx'],expected:8,change:'Require a string ID matching the already supported map-path characters before persisting or navigating after creation. Missing/null/numeric IDs retain the draft and follow the existing error alert.'},{id:'chat-modal-native-keyboard-boundary',group:'chat',files:['components/AskDoryeongModal.tsx'],expected:6,change:'Name the conversation pane as a modal dialog, focus its existing close control, contain native Tab/Shift+Tab during normal/pending history and restore the opener. Existing close/history/send logic stays unchanged.'},{id:'saju-input-choice-selection-state',group:'choice',files:['components/SajuInputModal.tsx'],expected:4,change:'Expose selected gender and calendar using aria-pressed on the existing five buttons; preserve pointer selection and native Space/Enter without form submission.'},{id:'ai-post-result-json-record',group:'result',files:['app/ai-test/page.tsx'],expected:12,change:'Show an explicit visible result-format error for POST null/primitives/arrays instead of accepting them or silently hiding null. Preserve valid/error JSON objects and one explicit request without auto-retry; existing GET status validator is unchanged.'}],spec=specs[number-1];assert(baseline.groups[spec.group].failed>0);
if(mode==='apply'){
 for(const source of pre.sources){let expected=source.sha256;for(let n=1;n<number;n++){const previous=read('changes/fix-'+n+'.json').files.find(x=>x.file===source.file);if(previous)expected=previous.after_sha256}assert.equal(sha(fs.readFileSync(repo+'/'+source.file)),expected,'Independent product WIP must be preserved; stop')}
 awaitDir();assert(!fs.existsSync(results+'/changes/fix-'+number+'.json'));const prepared=[];
 for(const file of spec.files){const before=fs.readFileSync(repo+'/'+file);let text=before.toString('utf8');const replacements=[];function replace(a,b,count=1){a=a.replaceAll('\n','\r\n');b=b.replaceAll('\n','\r\n');assert.equal(text.split(a).length-1,count,'Exact source guard before any product write');text=text.split(a).join(b);replacements.push({before:a,after:b,count})}
  if(number===1&&file==='app/guin/page.tsx'){replace('aria-label="은하 시" value={birthHour}','aria-label="은하 시" required value={birthHour}');replace('aria-label="은하 분" value={birthMinute}','aria-label="은하 분" required value={birthMinute}')}
  if(number===1&&file==='app/guin/[id]/page.tsx'){replace('placeholder="시 (0~23)"','required\n                        placeholder="시 (0~23)"');replace('placeholder="분 (0~59)"','required\n                        placeholder="분 (0~59)"')}
  if(number===2)replace('if (res.ok && data.success && data.guinMap) {','if (res.ok && data.success && data.guinMap\n        && typeof data.guinMap.id === "string" && /^[a-zA-Z0-9_-]+$/.test(data.guinMap.id)) {');
  if(number===3){replace('  const scrollRef = useRef<HTMLDivElement>(null);','  const scrollRef = useRef<HTMLDivElement>(null);\n  const dialogRef = useRef<HTMLDivElement>(null);');replace('  if (!isOpen) return null;',`  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    dialog.querySelector<HTMLButtonElement>("button")?.focus();
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]'
      )).filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (!controls.includes(document.activeElement as HTMLElement)
        || (event.shiftKey && document.activeElement === first)
        || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener("keydown", containTab);
    return () => {
      document.removeEventListener("keydown", containTab);
      if (opener?.isConnected) opener.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && dialogRef.current && !dialogRef.current.contains(document.activeElement)) {
      dialogRef.current.querySelector<HTMLButtonElement>("button")?.focus();
    }
  }, [isOpen, loading, historyLoading, historyError]);

  if (!isOpen) return null;`);replace('      <div\n        className="w-full max-w-md','      <div\n        ref={dialogRef}\n        role="dialog" aria-modal="true" aria-label="사주 풀이 대화"\n        className="w-full max-w-md')}
  if(number===4){replace('type="button"\n                    onClick={() => setGender("male")}','type="button"\n                    aria-pressed={gender === "male"}\n                    onClick={() => setGender("male")}');replace('type="button"\n                    onClick={() => setGender("female")}','type="button"\n                    aria-pressed={gender === "female"}\n                    onClick={() => setGender("female")}');replace('type="button"\n                    onClick={() => setCalendarType(item.id as any)}','type="button"\n                    aria-pressed={calendarType === item.id}\n                    onClick={() => setCalendarType(item.id as any)}')}
  if(number===5)replace('setResult(await response.json());','const value:unknown=await response.json();if(value===null||typeof value!=="object"||Array.isArray(value)){setResult({error:"시험 결과 응답 형식을 확인할 수 없습니다."});return;}setResult(value);');
  const after=Buffer.from(text),restored=replacements.reduceRight((current,item)=>{assert.equal(current.split(item.after).length-1,item.count);return current.split(item.after).join(item.before)},text);assert(Buffer.from(restored).equals(before));prepared.push({file,before,after,replacements});
 }
 const files=[];for(const[itemIndex,item]of prepared.entries()){const beforeSnapshot='changes/fix-'+number+'-'+itemIndex+'-before-native.tsx',afterSnapshot='changes/fix-'+number+'-'+itemIndex+'-after-native.tsx';fs.writeFileSync(results+'/'+beforeSnapshot,item.before,{flag:'wx'});fs.writeFileSync(results+'/'+afterSnapshot,item.after,{flag:'wx'});assert(fs.readFileSync(repo+'/'+item.file).equals(item.before));fs.writeFileSync(repo+'/'+item.file,item.after);assert(fs.readFileSync(repo+'/'+item.file).equals(item.after));files.push({file:item.file,before_sha256:sha(item.before),after_sha256:sha(item.after),before_bytes:item.before.length,after_bytes:item.after.length,before_snapshot:beforeSnapshot,after_snapshot:afterSnapshot,replacements:item.replacements,inverse_native_bytes_verified:true})}
 write('changes/fix-'+number+'.json',{status:'APPLIED_PENDING_FOCUSED_NATIVE_VERIFICATION',number,...spec,files,at_utc:new Date().toISOString(),prior_completed_work_recounted:0});console.log(JSON.stringify({status:'APPLIED_PENDING_VERIFICATION',number,id:spec.id,products:files.map(x=>x.file),validated_new_fix_count:number-1}));
}else{
 const after=read('item'+number+'/browser-results.json'),change=read('changes/fix-'+number+'.json');assert.equal(after.status,'PASS');assert.equal(after.failed,0);assert.equal(after.passed,spec.expected);assert.equal(after.groups[spec.group].failed,0);assert.equal(after.harness_sha256,baseline.harness_sha256);assert.equal(after.previous_completed_suites_rerun,0);assert.equal(after.page_errors.length,0);assert.equal(after.console_errors.length,0);assert.equal(after.outbound_requests.length,0);for(const item of change.files)assert.equal(sha(fs.readFileSync(repo+'/'+item.file)),item.after_sha256);
 const verified={number,id:spec.id,group:spec.group,files:change.files.map(({file,before_sha256,after_sha256,inverse_native_bytes_verified})=>({file,before_sha256,after_sha256,inverse_native_bytes_verified})),change:spec.change,before_reproduction:baseline.groups[spec.group],after_focused_verification:{passed:after.passed,failed:0},browser:after.browser,viewports:['390x844','1440x1000'],native_pointer_and_keyboard:true,manual_dom_events:0,proof:results+'/item'+number+'/browser-results.json'};write('progress-'+number+'of5.json',{status:number===5?'PASS_FIVE_NEW_BATCH3_UI_FIXES_AWAITING_BATCH_GATES':'PASS_PARTIAL_BATCH3_NEW_FIXES_PRESERVED',at_utc:new Date().toISOString(),branch:pre.branch,basis:pre.basis,validated_new_fix_count:number,commit_batch_target:5,fixes:[...(prior.fixes||[]),verified],commit_created:false,push_performed:false,previous_completed_suites_rerun:0,previous_completed_fixes_counted:0});console.log(JSON.stringify({status:'PASS_DISTINCT_NEW_FIX_VERIFIED',id:spec.id,validated_new_fix_count:number,passed:after.passed,commit_created:false,push_performed:false}));
}
function awaitDir(){if(!fs.existsSync(results+'/changes'))fs.mkdirSync(results+'/changes')}
