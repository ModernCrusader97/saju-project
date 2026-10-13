"""Copy completed new evidence into a new art directory, preserving old versions."""
import hashlib
import json
import shutil
from pathlib import Path

audit = Path(__file__).resolve().parent
repo = Path('/workspace/saju-cloud-reconstruction-20261013')
art = repo / 'assets/source-reference/saju-dragon-cloud-portable-render-replay-20261013'
summary = json.loads((audit / 'batch-regression/cumulative-regression-summary.json').read_text())
assert summary['status'] == 'PASS_CUMULATIVE_FIVE_ITEM_ART_REGRESSION'
assert not art.exists(), 'New directory only'
art.mkdir(parents=True)
for source, relative in [
    (audit / 'relocated/tools/render_final_matched_after_portable.py', 'source/render_final_matched_after_portable.py'),
    (audit / 'relocated/tools/render_final_matched_after.py', 'archive/original_renderer_unchanged.py'),
    (audit / 'isolated_render_probe.py', 'evidence-source/isolated_render_probe.py'),
    (audit / 'run_cumulative_regression.py', 'evidence-source/run_cumulative_regression.py'),
]:
    target = art / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
for dirname, relative in [('evidence', 'evidence/reproducibility'), ('batch-regression', 'evidence/cumulative-regression'), ('relocated/render-green', 'renders/relocated-green')]:
    shutil.copytree(audit / dirname, art / relative)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
old3 = repo / 'assets/source-reference/saju-dragon-cloud-v26-reconstruction-20261013/progress-final.json'
old4 = repo / 'assets/source-reference/saju-dragon-cloud-lossless-buffer-reuse-20261013/progress-art-batch-4-of-5.json'
ledger = {
    'verified_art_count': 5,
    'previous_verified_art_count': 4,
    'new_independent_improvements': 1,
    'new_improvement': 'Final matched renderer uses the declared before native input instead of an undeclared absolute scratch camera-provenance file',
    'items': [
        {'number': 1, 'improvement': 'Reconstructed V26 upper-eyelid contact', 'scope': 'Separately labelled cloud reconstruction; exact original V26 identity not claimed'},
        {'number': 2, 'improvement': 'Reconstructed V26 mouth boundary', 'scope': 'Smile-tube removal remains explicitly labelled inference'},
        {'number': 3, 'improvement': 'Rounder soft convex eye outlines, preserving size and bilateral symmetry'},
        {'number': 4, 'improvement': 'Exact GLB buffer range reuse', 'saving_bytes': 326672, 'candidate_sha256': '9b9e04221279d7917f4c446bc04957eebaa5a1a2307ea4c125b63d56b35c713a'},
        {'number': 5, 'improvement': 'Declared-input final renderer replay path fix', 'different_pixels_in_three_existing_render_pairs': 0},
    ],
    'audits_restore_reuse_optimizer_regeneration_tests_reviews_counted_as_improvements': False,
    'cumulative_regression_passed': True,
    'independent_review_critical_or_important_findings': 0,
    'old_ledger_3_sha256': sha(old3),
    'old_ledger_4_sha256': sha(old4),
    'old_ledger_files_preserved': True,
    'commit_push_threshold': 5,
    'commit_push_status': 'Awaiting new owner-only Drive preservation and exact staged-file secret check; one ordinary batch commit then push authorized',
    'UI_batch_touched': False,
    'main_PR_deployment_permissions_payment_auth_changes': False,
}
(art / 'progress-art-batch-5-of-5.json').write_text(json.dumps(ledger, indent=2) + '\n')
report = {
    'status': 'PASS_ONE_MINIMAL_RENDERER_INPUT_PATH_FIX_AND_CUMULATIVE_FIVE_ITEM_REGRESSION',
    'renderer_sha256': sha(art / 'source/render_final_matched_after_portable.py'),
    'preserved_original_renderer_sha256': sha(art / 'archive/original_renderer_unchanged.py'),
    'new_production_change': 'Read before native camera signature through required --before. All existing render settings, output naming, loop and camera equality guard are unchanged.',
    'relocated_red_exception': 'FileNotFoundError on undeclared old scratch render-provenance.json Python read',
    'relocated_green': 'Declared before/after native inputs, new output directory, same Python open policy; three successful actual background renders',
    'all_three_images_RGBA8_and_IDAT_identical': True,
    'PNG_binary_identity_claim': False,
    'PNG_file_hash_difference': 'tEXt metadata only',
    'camera_signatures_and_quality_settings_match_originals': True,
    'asset_input_bytes_modified': False,
    'new_geometry_design_eye_quality_app_changes': False,
    'audit_only': {'optimizer': 'CLI relocated success and byte-identical current GLB', 'generator': 'Existing restored layout resolves pinned V25 source; old generation evidence reused', '158_file_restoration': 'Existing PASS_RESTORED_EXACT_CLOUD_FILES 158 reused, not rerun'},
    'cumulative_regression': summary,
    'evidence_limitations': [
        'Python open audit proves the reproduced hidden JSON dependency was removed. Native Blender OS file reads are outside that audit hook.',
        'Linux cloud execution only; no Windows/Joseph PC execution claimed.',
        'Archived diagnostic helpers use original scratch paths. Only the declared production renderer and optimizer entrypoints are claimed to replay with explicit inputs.',
        'Technical tests do not establish original V26 byte identity or user approval of photo fidelity.'
    ],
    'private_repository': {'full_name': 'ModernCrusader97/saju-project', 'visibility': 'private', 'connected_tool_push_permission_observed': True},
    'branch': 'art/dragon-cloud-v26-round-eyes-reconstruction-20261013',
    'base_sha256_identifier_git': 'b57f37aa1ff552e3c77ca0f75f4ac21ce2a9ae40',
    'batch_ledger': ledger,
}
(art / 'portable-render-replay-final-report.json').write_text(json.dumps(report, indent=2) + '\n')
(art / 'README_ko.txt').write_text('''최종 렌더의 숨은 입력 경로 오류 1건 수정 · 누적 아트 5/5 검증

source/render_final_matched_after_portable.py는 --before 모델의 카메라 정보를 읽습니다.
예전 /workspace 작업 폴더의 render-provenance.json이 없어도 선언한 두 native 입력과
새 출력 디렉터리로 최종 3개 뷰를 렌더할 수 있습니다.

blender --background --factory-startup --python-exit-code 1 --threads 4 \\
  --python source/render_final_matched_after_portable.py -- \\
  --before /absolute/relocated/before.blend --after /absolute/relocated/after.blend \\
  --out /absolute/new-output-directory

실행 환경: 클라우드 Linux의 기존 Blender 4.3.2, CPU Cycles, 640x640, 64 samples,
denoising off, seed 20261013. 모델·재질·색·동작·카메라 자산과 품질 설정은 그대로입니다.
원본 렌더러와 실패 기록을 archive 및 evidence에 보존했습니다.
세 이미지 RGBA8 픽셀 및 PNG IDAT는 기존 결과와 정확히 같습니다. 파일 SHA 차이는
tEXt 메타데이터 차이이므로 PNG 파일 자체의 byte-identical 주장은 하지 않습니다.

격리 증거는 Python open 감사로 특정 JSON 읽기를 차단한 범위입니다.
Blender native OS 읽기의 완전 격리나 Windows 실행을 검증했다는 주장은 아닙니다.
evidence-source와 이전 묶음의 고정 경로 진단 도구는 당시 실행 증거의 기록이며,
범용 재실행 진입점으로 소개하지 않습니다.

이 감사에서 생성기·최적화기 확인, 기존 158파일 복구 검증 재사용, 새 회귀 시험은
개선 건수에 포함하지 않았습니다. 증명된 생산 렌더러 오류 수정만 4→5로 셉니다.
누적 회귀: 정적 구조, 눈 크기·볼록함·대칭, 기존 눈꺼풀/갈기 접촉, 실제 동작,
무손실 GLB 데이터, Three.js 로더/동작, Khronos 및 native→현재 GLB 재가져오기.
원래 V26 파일 동일 복구 주장은 없으며, 입 경계 재구성의 추정은 그대로 명시합니다.

main, 별도 UI 묶음, 사이트, 인증·결제·권한, PR 및 배포는 대상에 포함하지 않습니다.
원본/실패/WIP는 삭제하거나 덮어쓰지 않습니다. 새 결과는 새 소유자 전용 Drive 파일로
보존하고, 검증·보존·비밀정보 점검 완료 후 현재 비공개 아트 브랜치에 1회 묶음 커밋합니다.
''', encoding='utf8')
print(json.dumps({'new_art_directory': str(art), 'verified_art_count': 5, 'files': sum(p.is_file() for p in art.rglob('*'))}))
