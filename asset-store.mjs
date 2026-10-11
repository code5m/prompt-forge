// Local-only state: append-only versions and reviews, atomic rename, restricted JSON schema.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
const defaultState=()=>({schema:1,assets:{}});
export function createAssetStore(statePath){
 const target=resolve(statePath);let gate=Promise.resolve();
 async function read(){try{const d=JSON.parse(await readFile(target,'utf8'));return d?.schema===1&&d.assets&&typeof d.assets==='object'?d:defaultState()}catch(e){if(e.code==='ENOENT')return defaultState();throw e;}}
 async function update(fn){const next=gate.then(async()=>{const data=await read(),value=fn(data);await mkdir(dirname(target),{recursive:true});const temp=target+'.tmp-'+process.pid+'-'+randomUUID();await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});await rename(temp,target);return value;});gate=next.catch(()=>{});return next;}
 const validId=id=>typeof id==='string'&&id.length>0&&id.length<=550&&!['__proto__','constructor','prototype'].includes(id);
 const name=val=>String(val||'').slice(0,250);
 return {
  read,
  get:async id=>validId(id)?(await read()).assets[id]||null:null,
  mutate:async (id,action,payload={})=>{
   if(!validId(id))throw new Error('非法资产 ID');
   return update(db=>{
    const asset=db.assets[id]||={id,versions:[],reviews:[],tags:[],association:'unverified',approval:'pending',events:[]};
    const at=new Date().toISOString();
    if(action==='version'){
     const zh=String(payload.zh||'').slice(0,3000),en=String(payload.en||'').slice(0,3000);
     if(!zh&&!en)throw Error('至少填写一门语言');
     if(asset.versions.length>=100)throw Error('版本数量已达到上限');
     const v={id:randomUUID(),number:asset.versions.length+1,zh,en,reason:name(payload.reason),source:name(payload.source)||'manual',at};asset.versions.push(v);
    }else if(action==='review'){
     if(!['approved','needs-attention','rejected','pending'].includes(payload.status))throw Error('无效审核状态');
     if(payload.status==='approved'&&!name(payload.evidence))throw Error('通过审核必须提供依据');
     asset.approval=payload.status;asset.reviews.push({id:randomUUID(),status:payload.status,evidence:name(payload.evidence),reviewType:payload.reviewType==='visual'?'visual':'manual',at});
    }else if(action==='association'){
     if(!['unverified','verified','rejected'].includes(payload.status))throw Error('无效关联状态');
     if(payload.status==='verified'&&!name(payload.evidence))throw Error('确认关联必须提供证据');
     asset.association=payload.status;asset.events.push({action:'association',status:payload.status,evidence:name(payload.evidence),at});
    }else if(action==='tags'){
     asset.tags=[...new Set((Array.isArray(payload.tags)?payload.tags:[]).map(x=>name(x).trim()).filter(Boolean))].slice(0,20);
    }else throw Error('未知动作');
    asset.updatedAt=at;db.assets[id]=asset;return structuredClone(asset);
   });
  }
 };
}
