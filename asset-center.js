import {escapeHtml,renderDiff} from './core.js';
const $=s=>document.querySelector(s);
const section=document.createElement('section');section.className='studio';section.id='asset-center';
section.innerHTML='<p class="eyebrow">UNIFIED ASSET MANAGEMENT</p><h2>统一资产中心</h2><p>提示词、图片、视频、来源、版本与审核在同一个资产档案中管理。原始素材保持只读。</p><div id="acCount" class="knowledge-stats">加载资产中…</div><div class="studio-grid"><label>搜索<input id="acSearch" placeholder="资产名、类别、提示词或路径"></label><label>类型<select id="acType"><option value="all">全部资产</option><option value="prompt">提示词</option><option value="image">图片</option><option value="video">视频</option></select></label></div><div id="acList" class="research-matches"></div><article class="studio-part" id="acDetail"><h3 id="acTitle">请选择资产</h3><div id="acMedia"></div><p id="acOrigin"></p><p id="acEvidence"></p><label>标签（逗号分隔）<input id="acTags" placeholder="动漫,角色,电影感"></label><button id="acSaveTags">保存标签</button><h4>提示词历史（永远保留 V1）</h4><div id="acHistory"></div><div class="studio-grid"><label>中文提示词<textarea id="acZh" rows="5" maxlength="3000"></textarea></label><label>English prompt<textarea id="acEn" rows="5" maxlength="3000"></textarea></label></div><label>版本修改原因<input id="acReason" placeholder="为什么改变？"></label><button id="acSaveVersion">保存为新版本</button><div class="studio-grid"><label>对比旧版<select id="acOld"></select></label><label>对比新版<select id="acNew"></select></label></div><button id="acCompare">比较版本差异</button><div class="studio-grid"><div id="acDiffZh"></div><div id="acDiffEn"></div></div><h4>审核记录（原文件不受影响）</h4><label>审核结论<select id="acReviewStatus"><option value="pending">待审核</option><option value="needs-attention">需要处理</option><option value="approved">通过审核</option><option value="rejected">拒绝</option></select></label><label>审核依据<input id="acReviewNote" placeholder="具体观察和证据"></label><button id="acSaveReview">保存审核及历史</button><label>图文关联<select id="acAssociation"><option value="unverified">未确认</option><option value="verified">已人工核实</option><option value="rejected">不对应</option></select></label><button id="acSaveAssociation">保存关联结论</button><div id="acReviewHistory"></div><h4>图片 + 提示词联合审核</h4><button id="acVision">用日日新审核当前图片与提示词</button><div id="acVisualHistory"></div><h4>A/B 实验归档</h4><div id="acExperiments"></div><button id="acSendExperiment">将此资产送入 A/B 实验</button><h4>迁移旧浏览器案例</h4><p>迁移已有提示词历史与实验，重复执行不会重复导入。</p><button id="acMigrate">迁移旧案例到统一资产数据库</button><p id="acMessage" aria-live="polite"></p></article>';
document.querySelector('#research')?.before(section);
let catalog=[],states={},selected=null;
function state(){return states[selected?.id]||{versions:[],reviews:[],tags:[],association:'unverified',approval:'pending'};}
async function reload(){const [c,s]=await Promise.all([fetch('/api/assets/catalog').then(x=>x.json()),fetch('/api/assets/state').then(x=>x.json())]);catalog=c.records||[];states=s.assets||{};$('#acCount').innerHTML='<div>提示词 <strong>'+c.promptCount+'</strong></div><div>图片与视频 <strong>'+c.mediaCount+'</strong></div><div>全部资产 <strong>'+c.totalCount+'</strong></div>';render();}
function render(){const q=$('#acSearch').value.trim().toLowerCase(),kind=$('#acType').value;const rows=catalog.filter(x=>(kind==='all'||x.kind===kind)&&(!q||[x.title,x.category,x.path,x.en].some(v=>String(v||'').toLowerCase().includes(q)))).slice(0,100);$('#acList').innerHTML=rows.map(x=>'<button class="research-row" data-ac="'+encodeURIComponent(x.id)+'">'+escapeHtml(x.title)+'<small>'+escapeHtml(x.category||'')+' · '+escapeHtml(x.kind)+' · '+escapeHtml(x.path||x.organizedPath||'')+'</small></button>').join('')||'无匹配资产';document.querySelectorAll('[data-ac]').forEach(b=>b.onclick=()=>openAsset(decodeURIComponent(b.dataset.ac)));}
async function openAsset(id){selected=catalog.find(x=>x.id===id);if(!selected)return;let s=state();$('#acTitle').textContent=selected.title;$('#acOrigin').textContent='分类：'+(selected.category||'')+' · 来源：'+(selected.source||'')+' · '+(selected.path||selected.organizedPath||'');$('#acTags').value=s.tags.join(',');$('#acAssociation').value=s.association;$('#acReviewStatus').value=s.approval;$('#acReviewNote').value='';$('#acReason').value='';const m=$('#acMedia');m.replaceChildren();if(selected.kind==='image'||selected.kind==='video'){const e=document.createElement(selected.kind==='image'?'img':'video');e.src='/api/local-media?path='+encodeURIComponent(selected.path);e.style.maxWidth='100%';e.style.maxHeight='300px';if(e.tagName==='VIDEO')e.controls=true;m.append(e);}$('#acEvidence').textContent=(selected.sidecars||[]).length?'关联提示词文件：'+selected.sidecars.join('，')+'；仍需核对':'无关联文字文件';if(selected.kind==='prompt')$('#acEvidence').textContent='原始提示词来源于 hot_prompts.json，整理本保留 SHA256 与来源索引';
$('#acZh').value=s.versions.at(-1)?.zh||selected.zh||'';$('#acEn').value=s.versions.at(-1)?.en||selected.en||'';
if(!s.versions.length&&selected.kind==='prompt')$('#acHistory').textContent='尚未写入版本库：当前显示从原始来源整理出的英文 V1 内容。点击「保存为新版本」建立历史。';else $('#acHistory').innerHTML=s.versions.map(v=>'<p>V'+v.number+' · '+escapeHtml(v.source)+' · '+escapeHtml(v.at)+' · '+escapeHtml(v.reason)+'</p>').join('')||'尚无版本';
const opts=s.versions.map(v=>'<option value="'+escapeHtml(v.id)+'">V'+v.number+'</option>').join('');$('#acOld').innerHTML=opts;$('#acNew').innerHTML=opts;if(s.versions.length){$('#acOld').value=s.versions[Math.max(0,s.versions.length-2)].id;$('#acNew').value=s.versions.at(-1).id;}
$('#acDiffZh').replaceChildren();$('#acDiffEn').replaceChildren();$('#acVisualHistory').innerHTML=(s.visualReviews||[]).map(v=>'<p>'+escapeHtml(v.at)+' · 图文匹配：'+(v.matched?'模型认为匹配':'模型认为不匹配')+' · '+escapeHtml((v.observations||[]).join('，'))+' · '+escapeHtml((v.issues||[]).join('，'))+'</p>').join('')||'尚无视觉审核';
$('#acExperiments').innerHTML=(s.experiments||[]).map(e=>'<p>'+escapeHtml(e.at)+' · '+escapeHtml(e.winner)+' 更好 · '+escapeHtml(e.note||'')+'</p>').join('')||'尚无关联实验';
$('#acReviewHistory').innerHTML=(s.reviews||[]).map(r=>'<p>'+escapeHtml(r.at)+' · '+escapeHtml(r.status)+'：'+escapeHtml(r.evidence)+'</p>').join('')||'尚无审核记录';}
async function action(type,payload){if(!selected)return;try{const r=await fetch('/api/assets/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,action:type,payload})});const d=await r.json();if(!r.ok)throw Error(d.error||'保存失败');states[selected.id]=d;await openAsset(selected.id);$('#acMessage').textContent='已保存到本地资产数据库（不会覆盖原始素材）';}catch(e){$('#acMessage').textContent='失败：'+e.message;}}
$('#acSearch').oninput=render;$('#acType').onchange=render;
$('#acSaveTags').onclick=()=>action('tags',{tags:$('#acTags').value.split(',').map(x=>x.trim())});
$('#acSaveVersion').onclick=()=>action('version',{zh:$('#acZh').value,en:$('#acEn').value,reason:$('#acReason').value,source:'asset-center'});
$('#acSaveReview').onclick=()=>action('review',{status:$('#acReviewStatus').value,evidence:$('#acReviewNote').value});
$('#acSaveAssociation').onclick=()=>action('association',{status:$('#acAssociation').value,evidence:$('#acReviewNote').value});
$('#acCompare').onclick=()=>{const s=state(),a=s.versions.find(v=>v.id===$('#acOld').value),b=s.versions.find(v=>v.id===$('#acNew').value);if(!a||!b)return;$('#acDiffZh').innerHTML=renderDiff(a.zh,b.zh);$('#acDiffEn').innerHTML=renderDiff(a.en,b.en);};
reload().catch(e=>$('#acCount').textContent='请执行 npm run organize 并重启本地工作台：'+e.message);

$('#acVision').onclick=async()=>{
 if(!selected||selected.kind!=='image')return alert('请先选择真实图片资产');
 const prompt=$('#acEn').value.trim()||$('#acZh').value.trim();
 if(!prompt)return alert('请先填写待核实的原始提示词');
 $('#acVision').disabled=true;$('#acMessage').textContent='正在进行真实图文审核（可能产生费用）...';
 try{const res=await fetch('/api/assets/visual-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:selected.id,prompt})});
 const d=await res.json();if(!res.ok)throw Error(d.error||'视觉审核失败');await reload();await openAsset(selected.id);$('#acMessage').textContent='视觉审核报告已保存，但尚需人工确认，不会自动标记通过';
 }catch(e){$('#acMessage').textContent='视觉审核未完成：'+e.message}finally{$('#acVision').disabled=false}
};
$('#acMigrate').onclick=async()=>{
 const raw=localStorage.getItem('prompt-forge-studio-v1');if(!raw)return alert('本浏览器没有旧版实验记录');
 try{const d=JSON.parse(raw),records=(d.records||[]).filter(x=>x.sourceAsset?.id).map(x=>({
  id:x.sourceAsset.id,versions:x.versions||[],experiments:(d.experiments||[]).filter(e=>e.recordId===x.id).map(e=>({...e,id:e.id||e.recordId+'-'+e.at}))
 }));
 const resp=await fetch('/api/assets/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({records})});const result=await resp.json();if(!resp.ok)throw Error(result.error||'导入失败');await reload();$('#acMessage').textContent='迁移完成：新记录 '+result.imported+' 条，旧浏览器数据保留';
 }catch(e){$('#acMessage').textContent='迁移失败：'+e.message}
};
$('#acSendExperiment').onclick=()=>{
 if(!selected)return;
 const r={id:crypto.randomUUID(),title:selected.title,sourceAsset:{id:selected.id,path:selected.path||'',association:'unverified'},versions:state().versions.length?state().versions.map(x=>({...x})):[{id:crypto.randomUUID(),number:1,zh:$('#acZh').value,en:$('#acEn').value,reason:'资产来源',source:'asset-center',at:new Date().toISOString()}]};
 window.dispatchEvent(new CustomEvent('prompt-forge:adopt',{detail:r}));document.querySelector('#studio')?.scrollIntoView({behavior:'smooth'});
};
