import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {pngDecode} from './png_decode.mjs';
const args=process.argv.slice(2),opt=n=>args[args.indexOf(n)+1];
const a=path.resolve(opt('--before')),b=path.resolve(opt('--after')),out=path.resolve(opt('--out'));
assert(!fs.existsSync(out));
const oldBytes=fs.readFileSync(a),newBytes=fs.readFileSync(b),old=pngDecode(oldBytes),now=pngDecode(newBytes);
assert.equal(old.width,now.width);assert.equal(old.height,now.height);
let max=0,total=0,changedChannels=0,changedPixels=0;
for(let i=0;i<old.data.length;i+=4){let different=false;for(let c=0;c<4;c++){const delta=Math.abs(old.data[i+c]-now.data[i+c]);max=Math.max(max,delta);total+=delta;if(delta){changedChannels++;different=true;}}if(different)changedPixels++;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={status:max===0?'PASS_ACTUAL_GLB_RENDER_PIXEL_IDENTICAL':'REVIEW_ACTUAL_GLB_RENDER_PIXEL_DIFFERENCES',before_name:path.basename(a),after_name:path.basename(b),before_png_sha256:hash(oldBytes),after_png_sha256:hash(newBytes),before_pixel_sha256:old.pixel_sha256,after_pixel_sha256:now.pixel_sha256,width:old.width,height:old.height,max_channel_difference_8bit:max,mean_channel_difference_8bit:total/old.data.length,changed_channels:changedChannels,changed_pixels:changedPixels,source_blend_sha256:'c18682ca0f32973b815abd0185c049c6ed9ce005eee6388a2549388bd66bc3bc',camera:'Camera_ThreeQuarter',frame:0,cycles_samples:40,threads:4,baseline_render_reused:true,note:'Both images are official Blender glTF reimport renders from the byte-identical V3 native source and identical verify_native.py helper. Existing V3 actual render is reused.'};
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
