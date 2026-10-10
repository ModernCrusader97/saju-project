import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const args=process.argv.slice(2),get=n=>args[args.indexOf(n)+1],before=path.resolve(get('--before')),after=path.resolve(get('--after')),out=path.resolve(get('--out')),ffmpeg=path.resolve(get('--ffmpeg'));
if(fs.existsSync(out))throw Error('Preserve previous comparisons; use new folder');fs.mkdirSync(out,{recursive:true});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');const views=[];
for(const name of ['front','threequarter','side']){
 const old=path.join(before,name+'.png'),next=path.join(after,name+'.png'),file=path.join(out,'V2-left_V3-right_'+name+'.png');
 execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-i',old,'-i',next,'-filter_complex','[0:v][1:v]hstack=inputs=2','-frames:v','1',file]);
 views.push({view:name,file:path.basename(file),layout:'V2 LEFT; V3 RIGHT',source_before_sha256:hash(old),source_after_sha256:hash(next),comparison_sha256:hash(file),source_pixels_preserved:true});
}
fs.writeFileSync(path.join(out,'comparison-provenance.json'),JSON.stringify({status:'REAL_RENDER_SAME_CAMERA_BEFORE_AFTER',views},null,2)+'\n');console.log(JSON.stringify(views,null,2));
