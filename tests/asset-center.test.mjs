import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createAssetStore} from '../asset-store.mjs';
test('persistent versions preserve V1 and no unsubstantiated approval',async()=>{
 const root=await mkdtemp(join(tmpdir(),'asset-center-'));
 try{
 const s=createAssetStore(join(root,'state.json'));
 await s.mutate('media.png','version',{en:'A cat',zh:'一只猫',reason:'source'});
 await s.mutate('media.png','version',{en:'An orange cat',zh:'橘猫',reason:'refined'});
 const data=await s.get('media.png');assert.equal(data.versions.length,2);
 assert.equal(data.versions[0].en,'A cat');
 await assert.rejects(s.mutate('media.png','review',{status:'approved'}));
 await s.mutate('media.png','review',{status:'approved',evidence:'visually checked'});
 await s.mutate('media.png','association',{status:'verified',evidence:'same image'});
 assert.equal((await createAssetStore(join(root,'state.json')).get('media.png')).reviews.length,1);
 assert.equal((await s.get('media.png')).association,'verified');
 } finally{await rm(root,{recursive:true,force:true})}
});
test('asset persistence concurrent requests are serialized',async()=>{
 const root=await mkdtemp(join(tmpdir(),'asset-lock-'));
 try{
 const s=createAssetStore(join(root,'state.json'));
 await Promise.all(Array.from({length:8},(_,i)=>s.mutate('x','version',{en:'variant '+i})));
 assert.equal((await s.get('x')).versions.length,8);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('legacy migration is idempotent and preserves experiment association',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pf-legacy-'));
 try{const s=createAssetStore(join(root,'state.json'));
 const records=[{id:'images/cat.png',versions:[{id:'v1',zh:'一只猫',en:'cat'}],experiments:[{id:'e1',a:'v1',b:'v2',winner:'B',mock:false}]}];
 assert.equal((await s.importLegacy(records)).imported,2);
 assert.equal((await s.importLegacy(records)).imported,0);
 assert.equal((await s.get('images/cat.png')).experiments.length,1);
 await s.mutate('images/cat.png','visual-review',{matched:true,observations:['橘色毛发'],issues:[],prompt:'cat',model:'vision'});
 assert.equal((await s.get('images/cat.png')).approval,'needs-attention');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('visual review never grants automatic human approval',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pf-vision-'));
 try{const store=createAssetStore(join(root,'state.json'));
 await store.mutate('images/cat.png','visual-review',{matched:true,confidence:95,observations:['橘猫'],issues:[],prompt:'orange cat',model:'sense'});
 const v=await store.get('images/cat.png');
 assert.equal(v.approval,'needs-attention');assert.equal(v.visualReviews.length,1);assert.equal(v.visualReviews[0].matched,true);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('scores are bounded, persisted, and maintain history',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pf-score-'));
 try{const s=createAssetStore(join(root,'state.json'));
 const values={match:8,quality:9,style:7,composition:6,detail:10};
 await s.mutate('images/cat.png','score',{values,reason:'good illustration',prompt:'cat'});
 assert.equal((await s.get('images/cat.png')).scores[0].overall,8);
 await assert.rejects(s.mutate('images/cat.png','score',{values:{...values,match:22}}));
 assert.equal((await createAssetStore(join(root,'state.json')).get('images/cat.png')).scores.length,1);
 await s.mutate('images/cat.png','output',{path:'images/results/cat.png'});
 await assert.rejects(s.mutate('images/cat.png','output',{path:'../.env'}));
 assert.equal((await s.get('images/cat.png')).outputs.length,1);
 }finally{await rm(root,{recursive:true,force:true})}
});
test('translation preserves original English and caches exact bilingual source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'pf-bilingual-'));
 try{const store=createAssetStore(join(root,'state.json'));
 await store.mutate('prompt-1','translation',{en:'a cat',zh:'一只猫',source:'ai',model:'review-model'});
 await store.mutate('prompt-1','translation',{en:'an orange cat',zh:'一只橘猫',source:'manual'});
 const entry=await createAssetStore(join(root,'state.json')).get('prompt-1');
 assert.equal(entry.translations.length,2);
 assert.equal(entry.translations[0].en,'a cat');assert.equal(entry.translations[1].zh,'一只橘猫');
 await assert.rejects(store.mutate('prompt-1','translation',{en:'hello',zh:''}));
 }finally{await rm(root,{recursive:true,force:true})}
});
