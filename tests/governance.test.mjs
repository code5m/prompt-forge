import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.mjs';
import {access} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
test('governance index route responds without touching source assets',async()=>{
 const server=createAppServer({env:{PROMPT_FORGE_MOCK_AI:'1'}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{const base='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(base+'/governance.js')).status,200);
  const res=await fetch(base+'/api/governance');
  let localReady=true;try{await access(join(dirname(fileURLToPath(import.meta.url)),'..','.local','governance','asset-manifest.json'))}catch{localReady=false}
  if(!localReady){assert.equal(res.status,404);return}
  assert.equal(res.status,200);
  const doc=await res.json();
  assert.equal(doc.count,991);
  assert.equal(doc.records.filter(x=>x.kind==='image').length,937);
  assert.equal(doc.records.filter(x=>x.kind==='video').length,54);
  assert.ok(doc.records.every(x=>x.oneToOneStatus==='unverified'));
  assert.ok(doc.records.every(x=>x.sha256.length===64));
  assert.equal(doc.records.filter(x=>x.evidenceLevel==='shared-directory-only').length,501);
 }finally{await new Promise(ok=>server.close(ok))}
});
