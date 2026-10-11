import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const mode=process.argv[2],number=Number(process.argv[3]),results='D:/Codex/Results/SaJuUiBatchTwo-20261011-Joseph',repo='D:/Codex/Work/SaJuUiOneBug-20261010-Joseph/repo';
assert(['apply','record'].includes(mode));assert(Number.isInteger(number)&&number>=1&&number<=5);
const sha=data=>createHash('sha256').update(data).digest('hex'),read=file=>JSON.parse(fs.readFileSync(results+'/'+file,'utf8')),write=(file,value)=>fs.writeFileSync(results+'/'+file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const pre=read('batch-preflight.json'),prior=read('progress-'+(number-1)+'of5.json'),beforeReport=read('before-v2/browser-results.json');assert.equal(prior.validated_new_fix_count,number-1);
const git=args=>execFileSync('git',['-c','safe.directory='+repo,'-C',repo,...args],{windowsHide:true,encoding:'utf8'}).trimEnd();assert.equal(git(['branch','--show-current']),pre.branch);assert.equal(git(['rev-parse','HEAD']),pre.basis);
const specifications=[
 {id:'saju-post-http-error-false-success',group:'http',file:'components/SajuInputModal.tsx',expected:6,change:'Require response.ok before invoking the existing success callback or closing the Saju input draft. Non-2xx success-shaped JSON follows the existing error path and permits manual retry.'},
 {id:'saju-input-close-accessible-name',group:'close',file:'components/SajuInputModal.tsx',expected:4,change:'Give the existing X close control an explicit name and button type; preserve pointer closing and permit native Tab/Enter identification.'},
 {id:'saju-input-dialog-keyboard',group:'dialog',file:'components/SajuInputModal.tsx',expected:4,change:'Name the input pane as a modal dialog, focus its first input, contain native Tab/Shift+Tab, restore the opener, and keep focus inside when submission temporarily removes the form.'},
 {id:'saved-category-selection-state',group:'filter',file:'app/saved/page.tsx',expected:4,change:'Expose the currently selected archive category with aria-pressed on existing chips; preserve pointer filtering and support native Space/Enter selection and reset.'},
 {id:'guin-post-person-map-shape',group:'join',file:'app/guin/[id]/page.tsx',expected:8,change:'Validate the POST friend map before acknowledging either manual or quick addition, retaining the current map and manual draft on malformed people. Existing GET validation stays byte-identical.'}
],spec=specifications[number-1];assert(beforeReport.groups[spec.group].failed>0,'Only reproduced unresolved failures qualify');
if(mode==='apply'){
 for(const source of pre.sources){let expected=source.sha256;for(let previous=1;previous<number;previous++){const change=read('changes/fix-'+previous+'.json');if(change.file===source.file)expected=change.after_sha256;}assert.equal(sha(fs.readFileSync(repo+'/'+source.file)),expected,'Product source changed independently; preserve it and stop');}
 if(!fs.existsSync(results+'/changes'))fs.mkdirSync(results+'/changes');assert(!fs.existsSync(results+'/changes/fix-'+number+'.json'));
 const nativeBefore=fs.readFileSync(repo+'/'+spec.file);let text=nativeBefore.toString('utf8');const replacements=[];
 function replace(before,after,count=1){before=before.replaceAll('\n','\r\n');after=after.replaceAll('\n','\r\n');assert.equal(text.split(before).length-1,count,'Exact source guard before any product write');text=text.split(before).join(after);replacements.push({before,after,count});}
 if(number===1)replace('if (data.success && data.fortune) {','if (res.ok && data.success && data.fortune) {');
 if(number===2)replace('<button\n            onClick={onClose}','<button\n            type="button"\n            aria-label="사주 입력 닫기"\n            onClick={onClose}');
 if(number===3){
  replace('import React, { useState, useEffect } from "react";','import React, { useState, useEffect, useRef } from "react";');
  replace('  const [loadingStep, setLoadingStep] = useState(0);\n','  const [loadingStep, setLoadingStep] = useState(0);\n  const dialogRef = useRef<HTMLDivElement>(null);\n');
  replace('  if (!isOpen) return null;',`  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog) return;
    dialog.querySelector<HTMLInputElement>("input")?.focus();
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
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) {
      (dialog.querySelector<HTMLInputElement>("input") || dialog.querySelector<HTMLButtonElement>("button"))?.focus();
    }
  }, [isOpen, loading]);

  if (!isOpen) return null;`);
  replace('<div\n        className="w-full max-w-md','<div\n        ref={dialogRef}\n        role="dialog"\n        aria-modal="true"\n        aria-label={categoryTitle}\n        className="w-full max-w-md');
 }
 if(number===4){replace('                onClick={() => setSelectedCategory("all")}','                aria-pressed={selectedCategory === "all"}\n                onClick={() => setSelectedCategory("all")}');replace('                    onClick={() => setSelectedCategory(key)}','                    aria-pressed={selectedCategory === key}\n                    onClick={() => setSelectedCategory(key)}');}
 if(number===5){
  replace('import GalaxyPokedexModal from "@/components/planet/GalaxyPokedexModal";\n',`import GalaxyPokedexModal from "@/components/planet/GalaxyPokedexModal";

function canRenderAddedGuinMap(value: unknown, mapId: string): value is GuinMapData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.id === mapId
    && ["ownerName", "ownerBirth", "ownerDayMaster", "ownerTheme", "createdAt"].every(key => typeof candidate[key] === "string")
    && Array.isArray(candidate.guins) && candidate.guins.every(value => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const person = value as Record<string, unknown>;
      return ["id", "name", "relationTitle", "dayMaster", "elementMatch", "advice"].every(key => typeof person[key] === "string")
        && typeof person.relationType === "string" && ["mentor", "partner", "supporter", "grounding"].includes(person.relationType)
        && typeof person.affinityScore === "number" && Number.isFinite(person.affinityScore)
        && (person.isMe === undefined || typeof person.isMe === "boolean");
    });
}
`);
  replace('if (data.success && data.guinMap) {','if (data.success && canRenderAddedGuinMap(data.guinMap, mapId)) {',2);
  replace('        setMapData(data.guinMap);\n      }\n    } catch {','        setMapData(data.guinMap);\n      } else {\n        throw new Error("등록 중 오류가 발생했습니다.");\n      }\n    } catch {');
  replace('        alert(`${mapData?.ownerName}님의 우리은하에 등록되었습니다! ✨`);\n      }\n    } catch {','        alert(`${mapData?.ownerName}님의 우리은하에 등록되었습니다! ✨`);\n      } else {\n        throw new Error("등록 중 오류가 발생했습니다.");\n      }\n    } catch {');
  const oldGet=nativeBefore.toString('utf8').slice(nativeBefore.toString('utf8').indexOf('    const fetchMap = async () => {'),nativeBefore.toString('utf8').indexOf('  }, [mapId]);')+'  }, [mapId]);'.length);assert(text.includes(oldGet),'Previous completed GET block must stay byte-exact');
 }
 let reversed=text;for(const replacement of [...replacements].reverse()){assert.equal(reversed.split(replacement.after).length-1,replacement.count);reversed=reversed.split(replacement.after).join(replacement.before);}assert(Buffer.from(reversed).equals(nativeBefore),'Inverse patch must preserve every surrounding native byte');
 const nativeAfter=Buffer.from(text);for(const[ending,data]of [['before',nativeBefore],['after',nativeAfter]])fs.writeFileSync(results+'/changes/fix-'+number+'-'+ending+'-native.tsx',data,{flag:'wx'});
 fs.writeFileSync(repo+'/'+spec.file,nativeAfter);assert(fs.readFileSync(repo+'/'+spec.file).equals(nativeAfter));
 write('changes/fix-'+number+'.json',{status:'APPLIED_REPRODUCED_FIX_AWAITING_OWN_FOCUSED_BROWSER_PROOF',at_utc:new Date().toISOString(),number,...spec,before_sha256:sha(nativeBefore),after_sha256:sha(nativeAfter),before_bytes:nativeBefore.length,after_bytes:nativeAfter.length,inverse_native_bytes_verified:true,replacements,commit_created:false,push_performed:false});
 console.log(JSON.stringify({status:'APPLIED_ONLY_ONE_REPRODUCED_NEW_UI_FIX',number,id:spec.id,file:spec.file,validated_new_fix_count:prior.validated_new_fix_count,awaiting:'item'+number+' browser verification',commit_created:false,push_performed:false}));
}else{
 const change=read('changes/fix-'+number+'.json'),proof=read('item'+number+'/browser-results.json');assert.equal(proof.status,'PASS');assert.equal(proof.passed,spec.expected);assert.equal(proof.failed,0);assert.equal(proof.page_errors.length,0);assert.equal(proof.console_errors.length,0);assert.equal(proof.outbound_requests.length,0);assert.deepEqual(Object.keys(proof.groups),[spec.group]);assert.equal(proof.products[spec.file],change.after_sha256);assert.equal(sha(fs.readFileSync(repo+'/'+spec.file)),change.after_sha256);assert.equal(proof.previous_completed_fixes_counted,0);assert.equal(proof.previous_completed_suites_rerun,0);
 const item={number,id:spec.id,file:spec.file,change:spec.change,before_reproduction:beforeReport.groups[spec.group],after_focused_verification:proof.groups[spec.group],browser:proof.browser,viewports:['390x844','1440x1000'],native_pointer_and_keyboard:true,manual_dom_events:0,before_sha256:change.before_sha256,after_sha256:change.after_sha256,inverse_native_bytes_verified:true,proof:results+'/item'+number+'/browser-results.json'};
 write('progress-'+number+'of5.json',{status:'PASS_'+number+'_OF_5_NEW_DISTINCT_UI_FIXES_VALIDATED_NO_INTERMEDIATE_COMMIT',at_utc:new Date().toISOString(),branch:pre.branch,basis:pre.basis,validated_new_fix_count:number,commit_batch_target:5,fixes:[...(prior.fixes||[]),item],ordinary_commit_count:0,nonforce_push_count:0,commit_created:false,push_performed:false,previous_completed_fixes_counted:0,previous_completed_suites_rerun:0,remaining:'Current-batch full regression and type/build/lint gates required before publishing five fixes.',limits:proof.scope});
 console.log(JSON.stringify({status:'PASS_NEW_FIX_VALIDATED_AND_COUNT_RECORDED',number,id:spec.id,validated_new_fix_count:number,passed:proof.passed,failed:0,commit_created:false,push_performed:false}));
}
