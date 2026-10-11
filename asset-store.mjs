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
  importLegacy:async records=>{
   if(!Array.isArray(records)||records.length>600)throw Error('迁移条目过多');
   return update(db=>{
    let imported=0;
    for(const row of records){
     const id=row?.id;if(!validId(id))continue;
     if(!db.assets[id])db.assets[id]={id,versions:[],reviews:[],experiments:[],visualReviews:[],tags:[],association:'unverified',approval:'pending',events:[]};
     const dest=db.assets[id];
     for(const v of (Array.isArray(row.versions)?row.versions:[]).slice(0,100)){
      if(!v||typeof v.id!=='string'||dest.versions.some(x=>x.id===v.id))continue;
      dest.versions.push({id:v.id,number:dest.versions.length+1,zh:String(v.zh||'').slice(0,3000),en:String(v.en||'').slice(0,3000),source:'legacy',reason:name(v.reason),at:String(v.at||'')});imported++;
     }
     for(const e of (Array.isArray(row.experiments)?row.experiments:[]).slice(0,100)){
      if(!e||!e.id||dest.experiments.some(x=>x.id===e.id))continue;
      dest.experiments.push({id:e.id,a:name(e.a),b:name(e.b),winner:e.winner,note:name(e.note),model:name(e.model),mock:!!e.mock,at:String(e.at||'')});imported++;
     }
    }
    return {imported};
   });
  },
  mutate:async (id,action,payload={})=>{
   if(!validId(id))throw new Error('非法资产 ID');
   return update(db=>{
    const asset=db.assets[id]||={id,versions:[],reviews:[],experiments:[],visualReviews:[],tags:[],association:'unverified',approval:'pending',events:[]};
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
    }else if(action==='experiment'){
     if(!['A','B','tie'].includes(payload.winner)||!payload.a||!payload.b)throw Error('实验资料不完整');
     if(asset.experiments.some(x=>x.id===payload.id))return structuredClone(asset);
     asset.experiments.push({id:typeof payload.id==='string'?payload.id:randomUUID(),a:name(payload.a),b:name(payload.b),winner:payload.winner,note:name(payload.note),model:name(payload.model),mock:!!payload.mock,at});
    }else if(action==='visual-review'){
     if(typeof payload.observations!=='object'||!Array.isArray(payload.observations))throw Error('缺少视觉证据');
     asset.visualReviews.push({id:randomUUID(),matched:payload.matched===true,confidence:Number(payload.confidence)||0,observations:payload.observations.slice(0,10).map(name),issues:(payload.issues||[]).slice(0,10).map(name),suggestions:(payload.suggestions||[]).slice(0,10).map(name),prompt:name(payload.prompt),model:name(payload.model),at});
     // AI's opinion is evidence to review, never automatic human approval.
     asset.approval='needs-attention';
    }else if(action==='score'){
     const keys=['match','quality','style','composition','detail'],values={};
     for(const k of keys){const v=Number(payload.values?.[k]);if(!Number.isFinite(v)||v<0||v>10)throw Error('评分必须在 0–10 之间');values[k]=v}
     const overall=Number((keys.reduce((sum,k)=>sum+values[k],0)/keys.length).toFixed(1));
     (asset.scores??=[]).push({id:randomUUID(),values,overall,reason:name(payload.reason),prompt:String(payload.prompt||'').slice(0,3000),at});
    }else if(action==='output'){
     const path=String(payload.path||'');
     if(!path.startsWith('images/')||path.includes(String.fromCharCode(92))||path.split('/').includes('..')||!/\.(png|jpe?g|webp|gif|mp4|webm|mov|mkv)$/i.test(path))throw Error('只允许 images/ 内的媒体文件相对路径');
     (asset.outputs??=[]).push({id:randomUUID(),path,note:name(payload.note),at});
    }else if(action==='tags'){
     asset.tags=[...new Set((Array.isArray(payload.tags)?payload.tags:[]).map(x=>name(x).trim()).filter(Boolean))].slice(0,20);
    }else throw Error('未知动作');
    asset.updatedAt=at;db.assets[id]=asset;return structuredClone(asset);
   });
  }
 };
}
