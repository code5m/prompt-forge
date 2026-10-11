import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,writeFile,rm,symlink} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createAppServer} from "../server.mjs";

test("local media serves only images directory, supports ranges and rejects traversal",async()=>{
 const root=await mkdtemp(join(tmpdir(),"pf-media-"));
 await mkdir(join(root,"images"));
 await writeFile(join(root,"images","cat.png"),Buffer.from("fake-image-bytes"));
 await writeFile(join(root,"private.txt"),"secret-value");
 const server=createAppServer({env:{PROMPT_FORGE_WORKSPACE_ROOT:root,PROMPT_FORGE_MOCK_AI:"1"}});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const base="http://127.0.0.1:"+server.address().port;
 try {
  const media=await fetch(base+"/api/local-media?path=images%2Fcat.png");
  assert.equal(media.status,200);
  assert.equal(await media.text(),"fake-image-bytes");
  const partial=await fetch(base+"/api/local-media?path=images%2Fcat.png",{headers:{Range:"bytes=2-5"}});
  assert.equal(partial.status,206);assert.equal(await partial.text(),"ke-i");
  const blocked=await fetch(base+"/api/local-media?path=images%2F..%2Fprivate.txt");
  assert.equal(blocked.status,400);
  await symlink(join(root,"private.txt"),join(root,"images","outside.png"));
  const symlinked=await fetch(base+"/api/local-media?path=images%2Foutside.png");
  assert.equal(symlinked.status,403);
  const missing=await fetch(base+"/api/local-media?path=images%2Fmissing.jpg");
  assert.equal(missing.status,404);
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});

test("local media can require access token",async()=>{
 const root=await mkdtemp(join(tmpdir(),"pf-media-auth-"));await mkdir(join(root,"images"));await writeFile(join(root,"images","cat.png"),"cat");
 const server=createAppServer({env:{PROMPT_FORGE_WORKSPACE_ROOT:root,WORKBENCH_ACCESS_TOKEN:"local-only"}});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port+"/api/local-media?path=images%2Fcat.png";
 try{assert.equal((await fetch(url)).status,401);assert.equal((await fetch(url,{headers:{"x-workbench-access":"local-only"}})).status,200);}
 finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
});
