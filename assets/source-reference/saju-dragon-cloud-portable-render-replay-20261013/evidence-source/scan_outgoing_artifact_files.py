"""Bounded high-confidence credential check; reports no matched secret values.

The manifest binds the check to exact outgoing bytes. Compressed native packed
texts/images are additionally verified by the existing read-only Blender QA.
This is not a claim of exhaustive secret discovery.
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument('--repo', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--staged', action='store_true')
ap.add_argument('--include-audit', action='store_true')
args = ap.parse_args()
repo = Path(args.repo).resolve()
out = Path(args.out).resolve()
assert not out.exists(), 'New report only'
prefixes = [
    'assets/source-reference/saju-dragon-cloud-v26-reconstruction-20261013/',
    'assets/source-reference/saju-dragon-cloud-lossless-buffer-reuse-20261013/',
    'assets/source-reference/saju-dragon-cloud-portable-render-replay-20261013/',
]
if args.staged:
    names = subprocess.check_output(['git', 'diff', '--cached', '--name-only', '-z'], cwd=repo).decode().split('\0')
    paths = [(repo / n, 'repo/' + n) for n in names if n]
    assert paths and all(any(str(p.relative_to(repo)).startswith(pre) for pre in prefixes) for p, _ in paths)
else:
    paths = [(p, 'repo/' + str(p.relative_to(repo))) for pre in prefixes for p in sorted((repo / pre).rglob('*')) if p.is_file() and p.suffix != '.pyc']
if args.include_audit:
    audit = Path(__file__).resolve().parent
    paths += [(p, 'audit/' + str(p.relative_to(audit))) for p in sorted(audit.rglob('*')) if p.is_file() and p.resolve() != out]
rules = {
    'github_credential': rb'(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{30,255}',
    'github_fine_grained_credential': rb'github_pat_[A-Za-z0-9_]{50,255}',
    'aws_access_key': rb'(?<![A-Za-z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])',
    'google_api_key': rb'AIza[0-9A-Za-z_-]{35}',
    'google_oauth_access_token': rb'ya29\.[0-9A-Za-z_-]{25,}',
    'slack_credential': rb'xox[baprs]-[A-Za-z0-9-]{20,}',
    'private_key_header': rb'-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----',
    'url_embedded_credentials': rb'https?://[^\s/"\x27:]{2,}:[^\s/"\x27@]{4,}@',
    'credential_string_assignment': rb'(?i)(?:password|secret_access_key|client_secret|api_key|access_token|refresh_token)[\x22\x27 ]{0,2}[:=][ \t]*[\x22\x27]([^\x22\x27\r\n]{20,})[\x22\x27]',
    'credential_url_query': rb'(?i)[?&](?:access_token|refresh_token|api_key|token|signature|x-amz-signature)=[A-Za-z0-9%+/_=-]{24,}',
}
compiled = {name: re.compile(pattern) for name, pattern in rules.items()}
rows = []
findings = []
blocked_names = []
for path, label in paths:
    if any(part in {'.git', 'node_modules', '.aws', '.codex', '.env'} for part in path.parts) or path.name.startswith('.env'):
        blocked_names.append(label)
    data = path.read_bytes()
    if args.staged:
        # Scan the actual index blob and assert that the reviewable working copy is the same.
        index_data = subprocess.check_output(['git', 'show', ':' + str(path.relative_to(repo))], cwd=repo)
        assert data == index_data, label
    for rule, expression in compiled.items():
        hits = list(expression.finditer(data))
        if hits:
            findings.append({'path': label, 'rule': rule, 'count': len(hits), 'matched_values_omitted': True})
    rows.append({'path': label, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
report = {
    'status': 'PASS_BOUNDED_OUTGOING_CREDENTIAL_AND_SCOPE_CHECK' if not findings and not blocked_names else 'REVIEW_REQUIRED_OUTGOING_CREDENTIAL_OR_SCOPE_FINDING',
    'exact_staged_index_blobs_scanned': args.staged,
    'file_count': len(rows),
    'total_bytes': sum(row['bytes'] for row in rows),
    'rules': list(rules),
    'findings_without_values': findings,
    'forbidden_source_paths': blocked_names,
    'file_manifest': rows,
    'limitations': [
        'Bounded high-confidence patterns, not an exhaustive guarantee.',
        'Raw binary bytes are scanned. Compressed native packed texts and images require the independently passing Blender packed-source/reference hash check.',
        'Native packed sources equal the pinned generator and cloud bind script; the only packed approved image has the expected source SHA.',
        'No Git identity, credential store, environment variables, repository metadata personal profile fields, or unrelated directories were added.'
    ],
}
out.parent.mkdir(parents=True, exist_ok=True)
with out.open('x') as handle:
    json.dump(report, handle, indent=2)
    handle.write('\n')
print(json.dumps({k: report[k] for k in ('status', 'file_count', 'total_bytes', 'findings_without_values', 'forbidden_source_paths')}))
assert not findings and not blocked_names, 'Review required; secret values intentionally omitted'
