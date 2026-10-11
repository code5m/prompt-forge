import {escapeHtml} from './core.js';
const section=document.createElement('section');section.className='studio';section.id='audit';
section.innerHTML='<p class="eyebrow">EVIDENCE AUDIT</p><h2>素材关联质量核验</h2><p>自动扫描仅检查路径和文本来源，人工确认前不得标记一对一匹配。私有审核报告保留在本机，不上传原素材。</p><div id="auditCounts" class="knowledge-stats">正在读取本地扫描结果…</div><label>筛选状态<select id="auditFilter"><option value="all">全部</option><option value="candidate">同目录候选</option><option value="shared">公共提示词</option><option value="missing">无关联文本</option><option value="error">异常</option></select></label><label>搜索素材<input id="auditSearch" placeholder="名称或路径"></label><div id="auditList" class="research-matches"></div><p id="auditMessage" aria-live="polite"></p><button id="auditExport">导出完整审计报告 JSON</button>';
document.querySelector('#research')?.after(section);
let report=null;
const $=s=>document.querySelector(s);
function counts(){const t=report?.totals||{},all=report?.checked||0;$('#auditCounts').innerHTML='<div>已扫描 <strong>'+all+'</strong></div><div>同目录候选 <strong>'+(t.candidate||0)+'</strong></div><div>公共文本关联 <strong>'+(t.shared||0)+'</strong></div><div>无关联 <strong>'+(t.missing||0)+'</strong></div>'}
function render(){if(!report)return;const q=$('#auditSearch').value.trim().toLowerCase(),filter=$('#auditFilter').value;
 const rows=report.results.filter(x=>(filter==='all'||x.status===filter)&&(!q||x.path.toLowerCase().includes(q))).slice(0,100);
 $('#auditList').innerHTML=rows.map(x=>'<article class="research-row"><strong>'+escapeHtml(x.path.split('/').at(-1))+'</strong><small>'+escapeHtml(x.path)+'</small><small>'+escapeHtml(x.reason)+' · '+escapeHtml(x.status)+'</small><button data-audit="'+encodeURIComponent(x.id)+'">前往素材研究</button></article>').join('')||'没有符合条件的素材';
 document.querySelectorAll('[data-audit]').forEach(b=>b.onclick=()=>{const path=decodeURIComponent(b.dataset.audit);const search=document.querySelector('#researchSearch');if(search){search.value=path;search.dispatchEvent(new Event('input'));document.querySelector('#research')?.scrollIntoView({behavior:'smooth'})}});
}
$('#auditSearch').oninput=render;$('#auditFilter').onchange=render;
$('#auditExport').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='prompt-forge-evidence-audit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
fetch('/api/audit-report').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'读取失败');report=d;counts();render();$('#auditMessage').textContent=d.disclaimer}).catch(e=>$('#auditCounts').textContent='审核报告未生成：'+e.message+'。请在本地执行 npm run audit');
