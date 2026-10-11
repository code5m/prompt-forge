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
