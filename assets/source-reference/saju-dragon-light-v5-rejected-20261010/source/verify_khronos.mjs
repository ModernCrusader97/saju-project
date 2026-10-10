// Validate the actual delivered GLB with Khronos glTF Validator.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const a=process.argv.slice(2),get=n=>a[a.indexOf(n)+1];
const input=path.resolve(get("--glb")),out=path.resolve(get("--out"));
assert(!fs.existsSync(out),"Use a new report path");
const validator=createRequire(import.meta.url)(path.resolve(get("--validator")));
const bytes=fs.readFileSync(input);
const report=await validator.validateBytes(new Uint8Array(bytes),{uri:path.basename(input),maxIssues:1000,externalResourceFunction:async uri=>{throw Error("Self-contained GLB must not request "+uri);}});
report.validated_sha256=crypto.createHash("sha256").update(bytes).digest("hex");
report.validation_library="KhronosGroup/glTF-Validator";
report.status=report.issues.numErrors===0?"PASS_KHRONOS_GLTF_VALIDATOR":"FAIL_KHRONOS_GLTF_VALIDATOR";
fs.writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({status:report.status,sha256:report.validated_sha256,issues:report.issues},null,2));
assert.equal(report.issues.numErrors,0,"Khronos validator reported errors");

