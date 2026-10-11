import {newRecord,appendVersion,renderDiff,escapeHtml,imageSizeForRatio,validBackup} from "./core.js";
const $=s=>document.querySelector(s),KEY="prompt-forge-studio-v1";
let db;try{db=JSON.parse(localStorage.getItem(KEY));if(!validBackup(db))throw Error()}catch{db={records:[],experiments:[]}}
if(!db.records.length)db.records.push(newRecord("首个画面","一位宇航员站在雨夜霓虹街头","An astronaut stands on a neon street on a rainy night"));
let current=db.records[0].id,queue=new Set(),proposals=new Map(),run=null,winner="";
const rec=()=>db.records.find(x=>x.id===current),last=r=>r.versions[r.versions.length-1],save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const section=document.createElement("section");section.className="studio";section.id="studio";
section.innerHTML='<p class="eyebrow">PROMPT EVOLUTION STUDIO</p><h2>双语优化 · 批量审核 · 版本差异 · 图片对比</h2><p>每次优化均保留旧版。AI 建议不会自动覆盖；中文、英文都可编辑。</p>'+
'<div class="studio-part"><h3>① 中英文提示词</h3><label>选择方案<select id="pfRecords"></select></label><label>名称<input id="pfTitle" maxlength="80"></label><div class="studio-grid"><label>中文提示词<textarea id="pfZh" rows="6" maxlength="3000"></textarea></label><label>English prompt<textarea id="pfEn" rows="6" maxlength="3000"></textarea></label></div><p id="pfTranslation"></p><button id="pfNew">新建方案</button><button id="pfImport">从上方生成器创建方案</button><button id="pfSave">保存为新版本</button><span id="pfVersion"></span></div>'+
'<div class="studio-part"><h3>② AI 批量审核（最多 5 条）</h3><div id="pfQueue"></div><button id="pfReview">审核选中方案</button><p id="pfReviewState"></p><div id="pfProposals"></div></div>'+
'<div class="studio-part"><h3>③ 版本变化</h3><div class="studio-grid"><label>优化前<select id="pfBefore"></select></label><label>优化后<select id="pfAfter"></select></label></div><button id="pfRestore">恢复优化前版本（生成新版本）</button><div class="studio-grid"><article><h4>中文变化</h4><div id="pfDiffZh" class="studio-diff"></div></article><article><h4>英文变化</h4><div id="pfDiffEn" class="studio-diff"></div></article></div><p id="pfReason"></p></div>'+
'<div class="studio-part"><h3>④ 日日新图片 A/B 实验</h3><p>固定相同模型、语言、尺寸。关闭提示词自动扩写。调用真实模型可能产生费用。</p><div class="studio-grid"><label>语言<select id="pfLang"><option value="en">英文</option><option value="zh">中文</option></select></label><label>画幅<select id="pfRatio"><option>1:1</option><option>16:9</option><option>9:16</option><option>4:5</option><option>21:9</option></select></label></div><button id="pfGenerate">生成前后两张图</button><p id="pfImageState"></p><div class="studio-grid"><article><h4>A 旧版</h4><div id="pfImageA" class="studio-image">尚未生成</div><button id="pfWinnerA">A 更好</button></article><article><h4>B 新版</h4><div id="pfImageB" class="studio-image">尚未生成</div><button id="pfWinnerB">B 更好</button></article></div><label>实验分析<textarea id="pfNote" rows="2"></textarea></label><button id="pfStoreExperiment">保存实验评价</button><div id="pfExperiments"></div></div>'+
'<div class="studio-part"><h3>⑤ 配置与备份</h3><p id="pfApiState">连接状态检测中</p><label>服务端访问口令（可选）<input type="password" id="pfAccess" autocomplete="off"></label><p>API Key 仅放在服务端环境变量 SENSENOVA_API_KEY，不要写入 GitHub 或此页面。</p><button id="pfExport">导出版本及实验 JSON</button><label>导入备份<input type="file" id="pfFile" accept=".json,application/json"></label><p>图片文件不放入浏览器备份，生成后请自行保存。浏览器缓存清除前请导出。</p></div>';
document.querySelector("#inspiration")?.before(section);
const show=(id,v)=>$(id).textContent=v,click=(id,fn)=>$(id).addEventListener("click",fn);
function view(){
 $("#pfRecords").innerHTML=db.records.map(r=>'<option value="'+escapeHtml(r.id)+'">'+escapeHtml(r.title)+' · V'+last(r).number+'</option>').join("");
 $("#pfRecords").value=current;
 const r=rec();$("#pfTitle").value=r.title;$("#pfZh").value=last(r).zh;$("#pfEn").value=last(r).en;
 show("#pfVersion","V"+last(r).number);show("#pfTranslation",r.versions.some(v=>!v.zh||!v.en)?"有版本缺少一门语言：可通过 AI 审核补全翻译":"双语已填写；是否一致需经过审核");
 $("#pfQueue").innerHTML=db.records.map(x=>'<label><input type="checkbox" data-pfid="'+escapeHtml(x.id)+'" '+(queue.has(x.id)?"checked":"")+'>'+escapeHtml(x.title)+'</label>').join("");
 document.querySelectorAll("[data-pfid]").forEach(x=>x.onchange=()=>{x.checked?queue.add(x.dataset.pfid):queue.delete(x.dataset.pfid)});
 const options=r.versions.map(v=>'<option value="'+escapeHtml(v.id)+'">V'+v.number+' · '+escapeHtml(v.reason)+'</option>').join("");
 $("#pfBefore").innerHTML=options;$("#pfAfter").innerHTML=options;$("#pfBefore").value=r.versions[Math.max(0,r.versions.length-2)].id;$("#pfAfter").value=last(r).id;diff();
}
function diff(){const r=rec(),a=r.versions.find(v=>v.id===$("#pfBefore").value),b=r.versions.find(v=>v.id===$("#pfAfter").value);if(!a||!b)return;
 $("#pfDiffZh").innerHTML=renderDiff(a.zh,b.zh);$("#pfDiffEn").innerHTML=renderDiff(a.en,b.en);show("#pfReason","V"+a.number+" → V"+b.number+"："+b.reason);}
$("#pfRecords").onchange=e=>{current=e.target.value;view()};$("#pfBefore").onchange=diff;$("#pfAfter").onchange=diff;
click("#pfNew",()=>{const r=newRecord("新方案","","");db.records.unshift(r);current=r.id;save();view()});
click("#pfImport",()=>{const zh=$("#subject").value.trim(),en=$("#promptOutput").textContent.trim();const r=newRecord(zh.slice(0,50)||"从生成器导入",zh,en,"导入上方生成器");db.records.unshift(r);current=r.id;save();view();show("#pfTranslation","注意：导入的中文仅为主体，不等于完整英文提示词的翻译，请核对！")});
click("#pfSave",()=>{const r=rec(),zh=$("#pfZh").value.trim(),en=$("#pfEn").value.trim();if(!zh&&!en)return alert("至少填写一门语言");r.title=$("#pfTitle").value.trim()||r.title;try{appendVersion(r,zh,en,"手工修改");save();view()}catch(e){alert(e.message)}});
click("#pfRestore",()=>{const r=rec(),v=r.versions.find(x=>x.id===$("#pfBefore").value);if(v){appendVersion(r,v.zh,v.en,"恢复 V"+v.number,"restore");save();view()}});
async function call(path,body){const headers={"Content-Type":"application/json"};if($("#pfAccess").value)headers["x-workbench-access"]=$("#pfAccess").value;const res=await fetch(path,{method:"POST",headers,body:JSON.stringify(body)});const d=await res.json();if(!res.ok)throw Error(d.error||"服务异常");return d}
click("#pfReview",async()=>{const items=db.records.filter(r=>queue.has(r.id)).map(r=>({id:r.id,zh:last(r).zh,en:last(r).en}));if(!items.length||items.length>5)return alert("选择 1 到 5 条提示词");$("#pfReview").disabled=true;show("#pfReviewState","正在审核...");
 try{const data=await call("/api/reviews/batch",{items});proposals=new Map(data.results.map(x=>[x.id,x]));show("#pfReviewState",data.mock?"模拟审核：这些不是真实 AI 意见":"已完成真实 AI 审核，请确认候选");
 $("#pfProposals").innerHTML=data.results.map(x=>{const r=db.records.find(z=>z.id===x.id);return '<article class="studio-suggestion"><h4>'+escapeHtml(r.title)+' / 参考分：'+x.score+'</h4><p>发现：'+escapeHtml(x.issues.join("；"))+'</p><p>改动：'+escapeHtml(x.changes.join("；"))+'</p><div class="studio-grid"><div>中文<div class="studio-diff">'+renderDiff(last(r).zh,x.zh)+'</div></div><div>英文<div class="studio-diff">'+renderDiff(last(r).en,x.en)+'</div></div></div><button data-accept="'+escapeHtml(x.id)+'">接受优化、保存新版本</button><button data-reject="'+escapeHtml(x.id)+'">拒绝候选</button></article>'}).join("");
 document.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>{const r=db.records.find(x=>x.id===b.dataset.accept),v=proposals.get(r.id);if(v){appendVersion(r,v.zh,v.en,v.reason,"ai-review");save();view();b.closest("article").remove();proposals.delete(r.id)}});
 document.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>{proposals.delete(b.dataset.reject);b.closest("article").remove()});
 }catch(e){show("#pfReviewState","审核失败："+e.message+"。原始数据未覆盖")}finally{$("#pfReview").disabled=false}});
click("#pfGenerate",async()=>{const r=rec(),a=r.versions.find(v=>v.id===$("#pfBefore").value),b=r.versions.find(v=>v.id===$("#pfAfter").value),lang=$("#pfLang").value;
 if(a.id===b.id)return alert("需先保存或接受 V2，并选择不同的前后版本");
 if(!a[lang]||!b[lang])return alert("所选语言的提示词为空");
 if(!confirm("确认调用两次日日新图片接口？真实请求可能产生费用。"))return;
 $("#pfGenerate").disabled=true;run=null;winner="";show("#pfImageState","开始生成，A 与 B 将依次执行");
 try{const rs=[];for(const [i,v] of [a,b].entries()){const z=await call("/api/images/generate",{prompt:v[lang],size:imageSizeForRatio($("#pfRatio").value),promptExtend:false});rs.push(z);
 const img=document.createElement("img");img.alt=(i?"B":"A")+(z.mock?" 模拟图片":" 日日新生成图片");img.src="data:"+z.mime+";base64,"+z.imageBase64;$(i?"#pfImageB":"#pfImageA").replaceChildren(img)}
 run={recordId:r.id,a:a.id,b:b.id,model:rs[0].model,ratio:$("#pfRatio").value,language:lang,mock:rs.some(x=>x.mock)};
 show("#pfImageState",run.mock?"模拟图已生成：这不代表实际绘图效果":"日日新已生成 A/B，两张图仅保留当前浏览器会话");
 }catch(e){show("#pfImageState","生成失败或不完整："+e.message+"；未记入完整实验")}finally{$("#pfGenerate").disabled=false}});
for(const side of ["A","B"]){const img=document.querySelector("#pfImage"+side);if(img){const b=document.createElement("button");b.type="button";b.textContent="保存"+side+"图片到电脑";b.addEventListener("click",()=>{const src=img.querySelector("img")?.src;if(!src||!src.startsWith("data:image/"))return alert("请先生成图片");const a=document.createElement("a");a.href=src;a.download="prompt-forge-"+side+"-"+Date.now()+".png";a.click()});img.after(b);}}
click("#pfWinnerA",()=>{winner="A";show("#pfImageState","已选 A，请保存评语")});click("#pfWinnerB",()=>{winner="B";show("#pfImageState","已选 B，请保存评语")});
click("#pfStoreExperiment",async()=>{if(!run||!winner)return alert("必须完成 A/B，并选择一张优胜图片");const evidence={...run,id:crypto.randomUUID(),winner,note:$("#pfNote").value.slice(0,500),at:new Date().toISOString()};db.experiments.unshift(evidence);
 const source=rec().sourceAsset?.id;
 if(source){try{const response=await fetch('/api/assets/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:source,action:'experiment',payload:evidence})});if(!response.ok)show('#pfImageState','实验已在浏览器保存，但写入资产档案失败：可使用资产中心迁移');}catch{show('#pfImageState','写入资产档案失败，请稍后迁移')}}db.experiments=db.experiments.slice(0,100);save();experiments();window.dispatchEvent(new Event("prompt-forge:experiment-saved"))});
function experiments(){$("#pfExperiments").innerHTML=db.experiments.slice(0,10).map(e=>'<p>'+escapeHtml(e.at)+'：'+(e.mock?"模拟":"真实")+'，赢家 '+escapeHtml(e.winner)+'。'+escapeHtml(e.note)+'</p>').join("")}
click("#pfExport",()=>{const blob=new Blob([JSON.stringify({...db,schema:1},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="prompt-forge-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$("#pfFile").onchange=async e=>{const f=e.target.files[0];if(!f||f.size>1000000)return alert("文件无效或超过 1MB");try{const d=JSON.parse(await f.text());if(!validBackup(d))throw Error("版本备份不完整");if(!confirm("将替换当前版本历史。请先备份，是否继续？"))return;db={records:d.records,experiments:Array.isArray(d.experiments)?d.experiments.slice(0,100):[]};current=db.records[0].id;save();view();experiments()}catch(err){alert("导入失败："+err.message)}};
fetch("/api/status").then(r=>r.json()).then(s=>show("#pfApiState",s.mode==="mock"?"模拟服务已连接：结果不是真实 AI":s.mode==="live"?"真实日日新连接已配置":"服务运行中，但缺少 SENSENOVA_API_KEY")).catch(()=>show("#pfApiState","静态预览：版本与差异可用。启动 node server.mjs 后可接入 AI"));
save();view();experiments();
window.addEventListener('prompt-forge:adopt',event=>{
 const r=event.detail;
 if(!r||!Array.isArray(r.versions))return;
 db.records.unshift(r);current=r.id;save();view();
 show('#pfTranslation','素材来源已保存到案例；关联状态：尚未人工确认，请校对完整双语提示词。');
});
