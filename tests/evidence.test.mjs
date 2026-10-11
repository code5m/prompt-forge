import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readPromptEvidence} from '../prompt-evidence.mjs';
import {createAppServer} from '../server.mjs';
test('evidence is read-only and never claims a confirmed one-to-one relationship',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pf-evidence-'));
 await mkdir(join(root,'images','cats'),{recursive:true});
 await writeFile(join(root,'images','cats','cat.png'),'test-image');
 await writeFile(join(root,'images','cats','提示词.md'),'**EN:**\na cat\n\n**中文:**\n一只猫');
 const index=join(root,'index.json');
 await writeFile(index,JSON.stringify({records:[{id:'images/cats/cat.png',path:'images/cats/cat.png',name:'cat.png',kind:'image',promptFiles:['images/cats/提示词.md']}]}));
 try{
  const evidence=await readPromptEvidence(root,'images/cats/cat.png',index);
  assert.equal(evidence.association,'unverified');
  assert.equal(evidence.sources[0].status,'ok');
  assert.match(evidence.sources[0].text,/一只猫/);
  await assert.rejects(readPromptEvidence(root,'images/../secrets.txt',index));
  await assert.rejects(readPromptEvidence(root,'not-indexed.png',index));
 } finally {await rm(root,{recursive:true,force:true});}
});
test('evidence endpoint requires workspace root; static assets are available',async()=>{
 const server=createAppServer({env:{PROMPT_FORGE_MOCK_AI:'1'}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const file of ['research.js','research.css','studio.js','media-index.json']){
   const r=await fetch(base+'/'+file);assert.equal(r.status,200,file);
  }
  const r=await fetch(base+'/api/evidence?path=images%2Funknown.png');
  const body=await r.json();assert.equal(body.status,'unavailable');
 }finally{await new Promise(ok=>server.close(ok));}
});
