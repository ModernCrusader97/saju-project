"""Run a relocated renderer while denying undeclared reads from the old scratch folder."""
import json,runpy,sys
from pathlib import Path
root=Path('/workspace/saju-cloud-repro-audit-20261013');script=Path(sys.argv[sys.argv.index('--script')+1]).resolve();mode=sys.argv[sys.argv.index('--mode')+1]
events=[]
def audit(event,args):
    if event=='open' and isinstance(args[0],(str,bytes)):
        p=str(args[0]);m=args[1]
        if p.startswith('/workspace/saju-cloud-generated-20261013/') and (m is None or 'w' not in str(m)):
            events.append({'event':'undeclared_original_scratch_read','path':p,'mode':str(m)})
            raise FileNotFoundError('Relocated execution has no undeclared original scratch input: '+p)
sys.addaudithook(audit)
sys.argv=['blender','--','--before',str(root/'relocated/inputs/before.blend'),'--after',str(root/'relocated/inputs/after.blend'),'--out',str(root/'relocated'/('render-'+mode))]
try:
    runpy.run_path(str(script),run_name='__main__')
except Exception as e:
    with (root/'evidence'/('isolated-render-'+mode+'.json')).open('x') as f:json.dump({'status':'FAIL_RELOCATED_RENDERER','exception_type':type(e).__name__,'exception':str(e),'undeclared_scratch_reads':events,'original_files_removed_or_renamed':False,'isolation':'Python filesystem audit denies undeclared original scratch inputs; old files remain intact'},f,indent=2);f.write('\n')
    raise
with (root/'evidence'/('isolated-render-'+mode+'.json')).open('x') as f:json.dump({'status':'PASS_RELOCATED_RENDERER_DECLARED_INPUTS_ONLY','undeclared_scratch_reads':events,'original_files_removed_or_renamed':False,'isolation':'Same original-scratch read policy as red probe'},f,indent=2);f.write('\n')
