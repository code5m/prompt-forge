import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';import {tmpdir} from 'node:os';
import {auditIndex,classifyEvidence,writeAuditSnapshot} from '../audit-core.mjs';
test('audit classifies shared vs candidate vs missing without falsely confirming',async()=>{
 assert.equal(classifyEvidence({},[]).status,'missing');
 assert.equal(classifyEvidence({},[{status:'ok',scope:'ancestor-directory',text:'hello'}]).status,'shared');
 assert.equal(classifyEvidence({},[{status:'ok',scope:'same-directory',text:'hello'}]).status,'candidate');
 assert.equal(classifyEvidence({},[{status:'missing'}]).status,'unreadable');
});
test('audit creates durable independent results and works with partial errors',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pf-audit-'));const path=join(dir,'index.json');
 await writeFile(path,JSON.stringify({records:[{id:'a',path:'images/a.png',kind:'image'},{id:'b',path:'images/b.png',kind:'image'}]}));
 try{
  const report=await auditIndex({indexPath:path,workspaceRoot:dir,readEvidence:async(_,id)=>{if(id==='b')throw Error('missing');return {sources:[{status:'ok',scope:'same-directory',text:'text',path:'images/info.md'}]};}});
  assert.equal(report.checked,2);assert.equal(report.totals.candidate,1);assert.equal(report.totals.error,1);
  await writeAuditSnapshot(join(dir,'report.json'),report);
  assert.deepEqual((await readFile(join(dir,'report.json'),'utf8')).includes('自动扫描'),true);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('audit report endpoint does not leak arbitrary workspace files',async()=>{
 const {createAppServer}=await import('../server.mjs');
 const server=createAppServer({env:{PROMPT_FORGE_MOCK_AI:'1'}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 try{
  const origin='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(origin+'/audit.js')).status,200);
  const res=await fetch(origin+'/api/audit-report');
  assert.ok([200,404].includes(res.status));
 }finally{await new Promise(ok=>server.close(ok));}
});
