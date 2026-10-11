import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
export function classifyEvidence(asset,sources){
 if(!sources?.length)return {status:'missing',reason:'未找到关联提示词'};
 const valid=sources.filter(s=>s.status==='ok');
 if(!valid.length)return {status:'unreadable',reason:'关联文字不可读取'};
 const known=valid.filter(s=>s.scope==='same-directory');
 if(!known.length)return {status:'shared',reason:'仅有上级目录的公共提示词，不能当作一对一匹配'};
 if(valid.some(s=>s.text.length>5000))return {status:'needs-review',reason:'提示词较长，需定位对应段落'};
 return {status:'candidate',reason:'同目录文本候选；仍须核对图文是否匹配'};
}
export async function auditIndex({indexPath,workspaceRoot,readEvidence,limit=991,onProgress=()=>{}}){
 const data=JSON.parse(await readFile(indexPath,'utf8'));const records=data.records||[];
 const bounded=Math.min(Math.max(Number(limit)||1,1),records.length);
 const results=[];const totals={candidate:0,shared:0,missing:0,unreadable:0,'needs-review':0,error:0};
 for(const item of records.slice(0,bounded)){
  try{
   const r=await readEvidence(workspaceRoot,item.id,indexPath);
   const state=classifyEvidence(item,r.sources||[]);
   totals[state.status]++;
   results.push({id:item.id,path:item.path,kind:item.kind,sourceCount:r.sources?.length||0,status:state.status,reason:state.reason,sources:(r.sources||[]).map(x=>({path:x.path,status:x.status,scope:x.scope}))});
  }catch{
   totals.error++;results.push({id:item.id,path:item.path,status:'error',reason:'无法验证文件路径或索引'});
  }
  onProgress(results.length,bounded);
 }
 return {schema:1,generatedAt:new Date().toISOString(),totalIndexed:records.length,checked:results.length,totals,results,disclaimer:'自动扫描只验证路径与文本，不证明原图和提示词语义匹配；必须由人/视觉审核确认'};
}
export async function writeAuditSnapshot(file,data){
 const path=resolve(file);await mkdir(dirname(path),{recursive:true});
 const temp=path+'.tmp-'+process.pid;
 await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});
 await rename(temp,path);
}
