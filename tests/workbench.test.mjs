import test from "node:test";
import assert from "node:assert/strict";
import {newRecord, appendVersion, renderDiff, validateReview, imageSizeForRatio, validBackup} from "../core.js";
import {createAppServer} from "../server.mjs";
test("records never overwrite old prompt",()=>{
 const r=newRecord("Example","旧画面","old scene");
 const old=structuredClone(r.versions[0]);
 appendVersion(r,"新画面","new scene","review");
 assert.equal(r.versions.length,2);assert.deepEqual(r.versions[0],old);
 assert.equal(r.versions[1].number,2);
 assert.match(renderDiff("old scene","new scene"),/diff-ins/);
});
test("diff output cannot inject html",()=>{
 assert.match(renderDiff("<script>","<img>"),/&lt;/);
 assert.doesNotMatch(renderDiff("<script>","<img>"),/<script>/);
});
test("bilingual review id validation and backup",()=>{
 const original={id:"x"};
 assert.throws(()=>validateReview({id:"other",zh:"中文",en:"English"},original));
 assert.equal(validateReview({id:"x",zh:"中文",en:"English"},original).en,"English");
 assert.ok(validBackup({records:[newRecord("title","中文","English")]}));
 assert.equal(imageSizeForRatio("16:9"),"1536x864");
});
async function withServer(env,fn){
 const app=createAppServer({env});
 await new Promise(resolve=>app.listen(0,"127.0.0.1",resolve));
 try{await fn("http://127.0.0.1:"+app.address().port)}finally{await new Promise(resolve=>app.close(resolve))}
}
test("mock mode marks reviews and images as mock",async()=>{
 await withServer({PROMPT_FORGE_MOCK_AI:"1"},async base=>{
  const status=await (await fetch(base+"/api/status")).json();assert.equal(status.mode,"mock");
  const headers={"Content-Type":"application/json"};
  const review=await (await fetch(base+"/api/reviews/batch",{method:"POST",headers,body:JSON.stringify({items:[{id:"1",zh:"中文",en:"English"}]})})).json();
  assert.equal(review.mock,true);assert.equal(review.results[0].id,"1");
  const img=await (await fetch(base+"/api/images/generate",{method:"POST",headers,body:JSON.stringify({prompt:"a cat",size:"1024x1024",promptExtend:false})})).json();
  assert.equal(img.mock,true);assert.equal(img.mime,"image/svg+xml");
 });
});
test("live without key refuses writes; optional access token protects endpoint",async()=>{
 await withServer({},async base=>{
  const r=await fetch(base+"/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:"cat",size:"1024x1024",promptExtend:false})});assert.equal(r.status,503);
 });
 await withServer({PROMPT_FORGE_MOCK_AI:"1",WORKBENCH_ACCESS_TOKEN:"test-secret"},async base=>{
  const r=await fetch(base+"/api/reviews/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});assert.equal(r.status,401);
 });
});
test("disallow path traversal and arbitrary public files",async()=>{
 await withServer({PROMPT_FORGE_MOCK_AI:"1"},async base=>{
  const r=await fetch(base+"/.env");assert.equal(r.status,404);
 });
});