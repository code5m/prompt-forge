import {escapeHtml,renderDiff} from './core.js';
const $=s=>document.querySelector(s);
const pane=document.createElement('section');pane.className='studio';pane.id='asset-gallery';
pane.innerHTML='<p class="eyebrow">ASSET LIBRARY</p><h2>分类资产画廊 · 图文同屏审核</h2><p>左边选择分类与素材，右边同屏预览原始提示词、图片/视频和评分。公共目录提示词不等于单图原始提示词。</p><div class="ag-layout"><aside><label>分类<select id="agCategory"><option value="all">全部分类</option></select></label><label>类型<select id="agKind"><option value="all">全部</option><option value="image">图片</option><option value="video">视频</option><option value="prompt">提示词</option></select></label><label>名称/提示词搜索<input id="agSearch" placeholder="文件、提示词、目录"></label><div id="agSummary"></div><div id="agList" class="ag-list"></div><button id="agMore">加载更多</button></aside><div class="ag-main"><h3 id="agTitle">选择资产，查看图文与评分</h3><div id="agCompare" class="ag-compare"><div id="agOriginal" class="ag-frame">原始图片/视频</div><div id="agGenerated" class="ag-frame">生成图片/视频（选择或登记实际文件）</div></div><div id="agSources"></div><div class="ag-bilingual"><label>英文原文 · English<textarea id="agPrompt" rows="8" maxlength="3000" placeholder="原始英文提示词"></textarea></label><label>对应中文 · 中文翻译<textarea id="agZh" rows="8" maxlength="3000" placeholder="尚无中文译文，可点击下方翻译按钮"></textarea></label></div><p id="agTranslateStatus" aria-live="polite">中文来源待确认</p><button id="agTranslate">AI 翻译英文 → 中文并保存</button><button id="agSaveBilingual">保存当前中英文对应版本</button><label>生成结果文件（本地相对路径，必须位于 images/）<input id="agOutputPath" placeholder="images/ceshi/xxx.png 或 .mp4"></label><button id="agLoadOutput">预览生成结果</button><button id="agSaveOutput">登记生成结果到资产</button><h4>分项评分（人工评价，0–10）</h4><div id="agScoreFields" class="ag-scores"></div><label>评分理由<textarea id="agScoreReason" rows="3" placeholder="写清楚画面和提示词的对应程度、主要问题"></textarea></label><button id="agSaveScore">保存评分及历史</button><div id="agScoreHistory"></div><p id="agStatus" aria-live="polite"></p><button id="agOpenAsset">到资产中心管理版本及审核</button></div></div>';
document.querySelector('#asset-center')?.before(pane);
const metrics=[['match','图文一致性'],['quality','画面质量'],['style','风格一致性'],['composition','构图'],['detail','细节表现']];
$('#agScoreFields').innerHTML=metrics.map(([key,label])=>'<label>'+label+'<input type="number" min="0" max="10" step="1" data-score="'+key+'" value="5"></label>').join('');
let entries=[],states={},selected=null,visible=48;
const api=async(path,body)=>{const r=await fetch(path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined);const d=await r.json();if(!r.ok)throw Error(d.error||'请求失败');return d};
const media=(path,kind)=>{const el=document.createElement(kind==='video'?'video':'img');el.src='/api/local-media?path='+encodeURIComponent(path);if(kind==='video'){el.controls=true;el.preload='metadata'}else el.loading='lazy';el.onerror=()=>{el.replaceWith(document.createTextNode('媒体文件不可用：'+path))};return el};
const caption=(where,title)=>{const p=document.createElement('p');p.textContent=title;where.prepend(p)};
const group=x=>x.category||'未分类';
function paint(){const c=$('#agCategory').value,k=$('#agKind').value,q=$('#agSearch').value.trim().toLowerCase();const all=entries.filter(x=>(c==='all'||group(x)===c)&&(k==='all'||x.kind===k)&&(!q||[x.title,x.path,x.category,x.en,...(x.sidecars||[])].some(y=>String(y||'').toLowerCase().includes(q))));$('#agSummary').textContent='匹配 '+all.length+' 项 · 当前显示 '+Math.min(visible,all.length)+' 项';$('#agList').replaceChildren(...all.slice(0,visible).map(x=>{const b=document.createElement('button');b.className='ag-item';b.onclick=()=>openAsset(x.id);if(x.kind==='image'){b.append(media(x.path,'image'))}const t=document.createElement('span');t.textContent=x.title+' · '+x.kind;b.append(t);return b;}));$('#agMore').hidden=all.length<=visible}
async function openAsset(id){selected=entries.find(x=>x.id===id);if(!selected)return;const item=selected;$('#agTitle').textContent=item.title+' · '+group(item);const original=$('#agOriginal');original.replaceChildren();if(item.kind==='image'||item.kind==='video')original.append(media(item.path,item.kind));else original.textContent='文本资产：无原始图像';caption(original,'原始素材');const s=states[id]||{};$('#agGenerated').replaceChildren();$('#agGenerated').textContent='尚未登记生成结果';if(s.outputs?.length)showOutput(s.outputs.at(-1).path);$('#agOutputPath').value=s.outputs?.at(-1)?.path||'';const english=s.versions?.at(-1)?.en||item.en||'';
 $('#agPrompt').value=english;
 const cached=(s.translations||[]).slice().reverse().find(t=>t.en===english);
 $('#agZh').value=cached?.zh||s.versions?.at(-1)?.zh||item.zh||'';
 $('#agTranslateStatus').textContent=cached?'中文已保存 · '+(cached.source==='ai'?'AI 翻译':'手工译文'):'暂无已保存的对应中文（不自动伪造）';$('#agSources').textContent='读取来源中…';$('#agScoreHistory').innerHTML=(s.scores||[]).slice(-12).reverse().map(x=>'<p>'+escapeHtml(x.at)+' · 总评 '+x.overall+'/10 · '+escapeHtml(x.reason)+'</p>').join('')||'暂无评分';for(const x of document.querySelectorAll('[data-score]'))x.value=s.scores?.at(-1)?.values?.[x.dataset.score]??5;$('#agScoreReason').value='';$('#agStatus').textContent='';
 if(item.kind==='prompt'){$('#agSources').textContent='提示词来源：hot_prompts.json，分类：'+group(item);return;}
 try{const d=await api('/api/evidence?path='+encodeURIComponent(id));const sources=(d.sources||[]).filter(x=>x.status==='ok');$('#agSources').replaceChildren();const caution=document.createElement('p');caution.textContent=d.message;$('#agSources').append(caution);for(const x of sources){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre'),b=document.createElement('button');summary.textContent=x.path+' · '+x.scope;pre.textContent=x.text;pre.className='ag-evidence';b.textContent='复制此来源到提示词框';b.onclick=()=>{$('#agPrompt').value=x.text.slice(0,3000);$('#agZh').value='';$('#agTranslateStatus').textContent='英文来源已改变，请重新翻译并核对';};details.append(summary,pre,b);$('#agSources').append(details);}}catch(e){$('#agSources').textContent='来源读取失败：'+e.message}}
function showOutput(path){const k=/\.(mp4|webm|mov|mkv)$/i.test(path)?'video':'image';const el=$('#agGenerated');el.replaceChildren(media(path,k));caption(el,'已登记生成结果')}
$('#agLoadOutput').onclick=()=>{const p=$('#agOutputPath').value.trim();if(!p.startsWith('images/'))return $('#agStatus').textContent='路径必须在 images/ 下';showOutput(p)};
async function record(action,payload){if(!selected)return;try{const result=await api('/api/assets/update',{id:selected.id,action,payload});states[selected.id]=result;await openAsset(selected.id);$('#agStatus').textContent='已持久化保存，不修改原始媒体文件'}catch(e){$('#agStatus').textContent='保存失败：'+e.message}}
$('#agSaveOutput').onclick=()=>record('output',{path:$('#agOutputPath').value.trim(),note:$('#agScoreReason').value});
$('#agSaveScore').onclick=()=>record('score',{values:Object.fromEntries([...document.querySelectorAll('[data-score]')].map(x=>[x.dataset.score,Number(x.value)])),reason:$('#agScoreReason').value,prompt:$('#agPrompt').value});
$('#agOpenAsset').onclick=()=>{if(!selected)return;const q=$('#acSearch');q.value=selected.path||selected.title;q.dispatchEvent(new Event('input'));document.querySelector('#asset-center')?.scrollIntoView({behavior:'smooth'})};
$('#agCategory').onchange=()=>{visible=48;paint()};$('#agKind').onchange=()=>{visible=48;paint()};$('#agSearch').oninput=()=>{visible=48;paint()};$('#agMore').onclick=()=>{visible+=48;paint()};
Promise.all([api('/api/assets/catalog'),api('/api/assets/state')]).then(([c,s])=>{entries=c.records||[];states=s.assets||{};const cats=[...new Set(entries.map(group))].sort((a,b)=>a.localeCompare(b,'zh'));$('#agCategory').insertAdjacentHTML('beforeend',cats.map(x=>'<option value="'+escapeHtml(x)+'">'+escapeHtml(x)+'</option>').join(''));paint()}).catch(e=>$('#agSummary').textContent=e.message);

$('#agPrompt').addEventListener('input',()=>{$('#agTranslateStatus').textContent='英文已修改，旧中文可能不再对应，请重新翻译';});
$('#agTranslate').onclick=async()=>{
 if(!selected)return;const en=$('#agPrompt').value.trim();if(!en)return $('#agTranslateStatus').textContent='请先填写英文提示词';
 const button=$('#agTranslate');button.disabled=true;$('#agTranslateStatus').textContent='正在通过日日新翻译，请稍候…';
 try{const d=await api('/api/assets/translate',{id:selected.id,en});
  states[selected.id]={...states[selected.id],translations:[...(states[selected.id]?.translations||[]),d.translation]};
  $('#agZh').value=d.translation.zh;
  $('#agTranslateStatus').textContent='中文译文已保存到当前资产。翻译可能有误，请对照英文核查。';
 }catch(e){$('#agTranslateStatus').textContent='翻译失败：'+e.message}
 finally{button.disabled=false}
};
$('#agSaveBilingual').onclick=async()=>{
 if(!selected)return;const en=$('#agPrompt').value.trim(),zh=$('#agZh').value.trim();
 if(!en||!zh)return $('#agTranslateStatus').textContent='请填写完整的英文和对应中文';
 try{const d=await api('/api/assets/update',{id:selected.id,action:'translation',payload:{en,zh,source:'manual'}});
 states[selected.id]=d;$('#agTranslateStatus').textContent='已保存双语对应版本（保留历史），原始提示词未覆盖';
 }catch(e){$('#agTranslateStatus').textContent='保存失败：'+e.message}
};
