import {analyzeExperiments,exportResearch} from './knowledge-core.js';
import {escapeHtml} from './core.js';
const section=document.createElement('section');section.className='studio';section.id='knowledge';
section.innerHTML='<p class="eyebrow">LEARNING LIBRARY</p><h2>实验经验与知识沉淀</h2><p>只有实际生成并记录优胜结果的 A/B 实验才参与统计。模拟结果、缺失证据不会伪装成真实规律。</p><div id="knowledgeStats" class="knowledge-stats"></div><div id="knowledgeCases"></div><button id="knowledgeExport">导出知识与实验数据</button><p class="tip">实验评价是个体观察，不代表模型结论。建议不同提示词与场景反复验证。</p>';
document.querySelector('#saved')?.before(section);
const $=s=>document.querySelector(s);
const storeKey='prompt-forge-studio-v1';
function data(){try{return JSON.parse(localStorage.getItem(storeKey))||{records:[],experiments:[]}}catch{return {records:[],experiments:[]}}}
function render(){
 const knowledge=analyzeExperiments(data());
 $('#knowledgeStats').innerHTML='<div>已验证实验 <strong>'+knowledge.total+'</strong></div><div>新版更好 <strong>'+knowledge.improvements+'</strong></div><div>旧版更好 <strong>'+knowledge.regressions+'</strong></div>';
 $('#knowledgeCases').innerHTML=knowledge.results.length?knowledge.results.map(r=>'<details class="studio-part"><summary>'+escapeHtml(r.title)+' · '+r.count+' 次实测，B 胜 '+r.improvements+' 次</summary><p>'+escapeHtml(r.source)+'</p>'+r.notes.map(n=>'<p><strong>'+escapeHtml(n.winner)+' 胜 · '+escapeHtml(n.at)+'</strong> · '+escapeHtml(n.model)+' · '+escapeHtml(n.note)+'</p>').join('')+'</details>').join(''):'<div class="empty-state">还没有真实实验。请先在双语工作台生成 A/B、选择优胜结果并保存实验评价。</div>';
}
$('#knowledgeExport').onclick=()=>{const blob=new Blob([exportResearch(data())],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='prompt-forge-research-knowledge.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.addEventListener('prompt-forge:experiment-saved',render);
window.addEventListener('storage',e=>{if(e.key===storeKey)render()});
render();
