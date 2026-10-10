// Encode only real Blender GLB render frames, then validate MP4 metadata and bytes.
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import crypto from "node:crypto";
import assert from "node:assert/strict";
const argv=process.argv.slice(2),get=n=>argv[argv.indexOf(n)+1];
const frames=path.resolve(get("--frames")),out=path.resolve(get("--out")),ffmpeg=path.resolve(get("--ffmpeg"));
assert(!fs.existsSync(out),"Use a new MP4 path; preserve earlier outputs");
const files=fs.readdirSync(frames).filter(n=>/^frame_\d{4}\.png$/.test(n)).sort();
assert.equal(files.length,72);
const concat=path.join(frames,"encode-list.txt");
fs.writeFileSync(concat,files.map(n=>"file '"+n+"'\nduration 0.0833333333333333\n").join(""));
const result=spawnSync(ffmpeg,["-nostdin","-hide_banner","-n","-safe","1","-f","concat","-i",concat,
 "-frames:v","72","-vf","fps=12","-c:v","libx264","-preset","medium","-crf","19","-pix_fmt","yuv420p",
 "-movflags","+faststart",out],{encoding:"utf8"});
fs.writeFileSync(out+".encode.log",result.stderr??"");
if(result.error)throw result.error;assert.equal(result.status,0,result.stderr);
const b=fs.readFileSync(out);
function boxes(start,end){const a=[];for(let p=start;p+8<=end;){let size=b.readUInt32BE(p),head=8;
 if(size===1){size=Number(b.readBigUInt64BE(p+8));head=16;}if(size===0)size=end-p;
 assert(size>=head && p+size<=end);a.push({type:b.toString("ascii",p+4,p+8),start:p+head,end:p+size});p+=size;}return a;}
const top=boxes(0,b.length),moov=top.find(x=>x.type==="moov");
assert(moov && top.some(x=>x.type==="mdat")&&top.some(x=>x.type==="ftyp"));
const children=x=>boxes(x.start,x.end),child=(x,t)=>children(x).find(c=>c.type===t);
const trak=children(moov).filter(x=>x.type==="trak").find(x=>{
 const h=child(child(x,"mdia"),"hdlr");return b.toString("ascii",h.start+8,h.start+12)==="vide";});
assert(trak);const mdia=child(trak,"mdia"),mdhd=child(mdia,"mdhd"),tkhd=child(trak,"tkhd");
const v=b[mdhd.start],scale=b.readUInt32BE(mdhd.start+(v?20:12));
const ticks=v?Number(b.readBigUInt64BE(mdhd.start+24)):b.readUInt32BE(mdhd.start+16);
const duration=ticks/scale,width=b.readUInt32BE(tkhd.end-8)/65536,height=b.readUInt32BE(tkhd.end-4)/65536;
const stbl=child(child(mdia,"minf"),"stbl"),stsz=child(stbl,"stsz"),count=b.readUInt32BE(stsz.start+8);
assert.equal(count,72);assert.equal(width,640);assert.equal(height,640);assert(Math.abs(duration-6)<.002);
const report={status:"PASS_REAL_RENDER_MP4",rendered_glb_sha256:"6e4270709ea0305b4e4caeb26e4fbc683565e6739bd71bcb92b7cb5447147282",
 frames:count,fps:12,seconds:duration,width,height,bytes:b.length,
 sha256:crypto.createHash("sha256").update(b).digest("hex"),
 actual_blender_render_frames:files,loop_duplicate_end_frame_omitted:true};
fs.writeFileSync(out+".verification.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify(report,null,2));

