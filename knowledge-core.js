// Pure experiment evidence and reusable learning helpers.
export function analyzeExperiments(db) {
 const experiments=(db?.experiments||[]).filter(e=>!e.mock&&e.winner&&(e.winner==='A'||e.winner==='B')&&typeof e.recordId==='string');
 const summary={total:experiments.length,improvements:experiments.filter(e=>e.winner==='B').length,regressions:experiments.filter(e=>e.winner==='A').length,results:[]};
 const byRecord=new Map();
 for(const e of experiments){
  const list=byRecord.get(e.recordId)||[];list.push(e);byRecord.set(e.recordId,list);
 }
 for(const [id,runs] of byRecord){
  const record=(db.records||[]).find(r=>r.id===id);
  summary.results.push({id,title:record?.title||'已删除的案例',source:record?.sourceAsset?.path||'',count:runs.length,improvements:runs.filter(e=>e.winner==='B').length,regressions:runs.filter(e=>e.winner==='A').length,notes:runs.map(e=>({at:e.at||'',note:String(e.note||'').slice(0,500),winner:e.winner,model:e.model||'',a:e.a,b:e.b})).slice(0,15)});
 }
 summary.results.sort((a,b)=>b.count-a.count);
 return summary;
}
export function makeExperiment(record,a,b,settings,images,winner,note=''){
 if(!record||!a||!b||a.id===b.id||!['A','B','tie'].includes(winner))throw Error('实验数据不完整');
 if(!Array.isArray(images)||images.length!==2||!images.every(x=>x?.bytes&&x.mime==='image/png'&&!x.mock))throw Error('真实实验必须有两张图片');
 return {schema:2,id:crypto.randomUUID(),recordId:record.id,a:a.id,b:b.id,model:settings.model,ratio:settings.ratio,language:settings.language,mock:false,winner,note:String(note).slice(0,500),at:new Date().toISOString(),imageDigests:images.map(x=>x.digest),imagesSaved:false};
}
export function exportResearch(db){
 const data={schema:2,exportedAt:new Date().toISOString(),records:db.records,experiments:db.experiments,knowledge:analyzeExperiments(db)};
 return JSON.stringify(data,null,2);
}
