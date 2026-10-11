const $ = (selector) => document.querySelector(selector);
const state = { mode: 'image', library: [], saved: JSON.parse(localStorage.getItem('prompt-forge-saved') || '[]'), cursor: 0 };
const assetState = { records: [], overrides: JSON.parse(localStorage.getItem('prompt-forge-asset-reviews') || '{}') };
const fallback = [
  {category:'科幻', heat:71, prompt:'highly detailed futuristic architecture, floating buildings, reflective lighting, lush alien vegetation, cinematic, epic lighting, octane render'},
  {category:'人物肖像', heat:62, prompt:'editorial portrait of a young woman in soft window light, natural skin texture, 85mm lens, cinematic color grading'},
  {category:'风景建筑', heat:58, prompt:'misty mountain village at sunrise, warm light breaking through clouds, cinematic wide shot, highly detailed'},
  {category:'二次元', heat:51, prompt:'anime key visual, lone traveler at a quiet train platform, rain reflections, luminous sky, emotional atmosphere'},
  {category:'写实摄影', heat:48, prompt:'documentary street photography, lively night market, rain soaked pavement, candid moment, rich natural color'}
];
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
function selectedText(id) { return $(id).selectedOptions[0].textContent; }
function promptText() {
  const subject = $('#subject').value.trim() || 'a striking original visual concept';
  const base = [subject, $('#style').value, $('#composition').value, $('#lighting').value, $('#detail').value];
  if (state.mode === 'video') base.push($('#motion').value, $('#action').value.trim() || 'subtle natural movement', $('#duration').value, 'smooth temporal consistency');
  return `${base.filter(Boolean).join(', ')} ${$('#ratio').value}`;
}
function updateResult() { $('#promptOutput').textContent = promptText(); $('#negativeOutput').textContent = $('#negative').value.trim() || 'none'; }
function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.mode').forEach((button) => { const active = button.dataset.mode === mode; button.classList.toggle('active', active); button.setAttribute('aria-selected', String(active)); });
  $('#videoFields').classList.toggle('hidden', mode !== 'video');
  $('#resultTitle').textContent = mode === 'video' ? '视频生成指令' : '图片生成指令';
  updateResult();
}
function renderLibrary() {
  const category = $('#categorySelect').value;
  const filtered = category === 'all' ? state.library : state.library.filter((item) => item.category === category);
  const batch = (filtered.length ? filtered : fallback).slice(state.cursor, state.cursor + 6);
  const cards = batch.length ? batch : (filtered.length ? filtered.slice(0, 6) : fallback);
  $('#inspirationCards').innerHTML = cards.map((item) => `<article class="prompt-card"><div class="card-meta"><span>${escapeHtml(item.category)}</span><span class="heat">✦ ${item.heat}</span></div><p>${escapeHtml(item.prompt)}</p><div class="card-actions"><button class="text-button use-prompt" data-prompt="${encodeURIComponent(item.prompt)}">用作起点 →</button><button class="text-button copy-library" data-prompt="${encodeURIComponent(item.prompt)}">复制</button></div></article>`).join('');
  document.querySelectorAll('.use-prompt').forEach((button) => button.addEventListener('click', () => { $('#subject').value = decodeURIComponent(button.dataset.prompt); location.hash = 'composer'; updateResult(); }));
  document.querySelectorAll('.copy-library').forEach((button) => button.addEventListener('click', () => copyText(decodeURIComponent(button.dataset.prompt), button)));
}
function renderSaved() {
  $('#savedCount').textContent = `${state.saved.length} 条`;
  $('#savedList').className = state.saved.length ? 'saved-list' : 'empty-state';
  $('#savedList').innerHTML = state.saved.length ? state.saved.map((item, index) => `<div class="saved-item"><p>${escapeHtml(item.prompt)}</p><button class="remove" data-index="${index}" aria-label="删除收藏">删除</button></div>`).join('') : '你收藏的提示词会保存在此浏览器中。';
  document.querySelectorAll('.remove').forEach((button) => button.addEventListener('click', () => { state.saved.splice(Number(button.dataset.index), 1); persistSaved(); renderSaved(); }));
}
function formatBytes(bytes) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function renderAssets() {
  const query = $('#assetSearch').value.toLowerCase().trim(); const kind = $('#assetKind').value; const review = $('#assetReview').value;
  const visible = assetState.records.filter((item) => { const current = assetState.overrides[item.id] || item.review; const haystack = `${item.name} ${item.path} ${item.promptFiles.join(' ')}`.toLowerCase(); return (!query || haystack.includes(query)) && (kind === 'all' || item.kind === kind) && (review === 'all' || current === review); });
  $('#assetCount').textContent = `${visible.length} / ${assetState.records.length} 项`;
  $('#assetList').innerHTML = visible.length ? visible.slice(0, 100).map((item) => { const current = assetState.overrides[item.id] || item.review; return `<div class="asset-row"><span class="asset-icon">${item.kind === 'video' ? '▷' : '▧'}</span><div class="asset-name" title="${escapeHtml(item.path)}">${escapeHtml(item.name)}<span class="asset-path">${escapeHtml(item.path)}${item.promptFiles.length ? ` · 关联：${escapeHtml(item.promptFiles.join(', '))}` : ''}</span></div><span class="asset-type">${item.kind === 'video' ? '视频' : '图片'} · ${formatBytes(item.bytes)}</span><select class="asset-status" data-asset="${encodeURIComponent(item.id)}"><option value="pending" ${current === 'pending' ? 'selected' : ''}>待审核</option><option value="approved" ${current === 'approved' ? 'selected' : ''}>已通过</option><option value="needs-attention" ${current === 'needs-attention' ? 'selected' : ''}>需关注</option><option value="rejected" ${current === 'rejected' ? 'selected' : ''}>已拒绝</option></select><a class="asset-open" href="../${encodeURI(item.path)}" target="_blank" rel="noreferrer">打开原文件 ↗</a></div>`; }).join('') : '<div class="empty-state">没有匹配的本地素材。</div>';
  document.querySelectorAll('.asset-status').forEach((select) => select.addEventListener('change', () => { assetState.overrides[decodeURIComponent(select.dataset.asset)] = select.value; localStorage.setItem('prompt-forge-asset-reviews', JSON.stringify(assetState.overrides)); renderAssets(); }));
}
async function loadAssets() { try { const response = await fetch('./media-index.json'); assetState.records = (await response.json()).records || []; } catch (_) { assetState.records = []; } renderAssets(); }
function persistSaved() { localStorage.setItem('prompt-forge-saved', JSON.stringify(state.saved)); }
async function copyText(value, button = $('#copyButton')) { await navigator.clipboard.writeText(value); const label = button.textContent; button.textContent = '已复制 ✓'; setTimeout(() => { button.textContent = label; }, 1200); }
function saveCurrent() { const prompt = promptText(); if (!state.saved.some((item) => item.prompt === prompt)) { state.saved.unshift({ prompt, mode: state.mode, createdAt: new Date().toISOString() }); persistSaved(); renderSaved(); } $('#saveButton').textContent = '♥'; }
function randomPrompt() { const source = state.library.length ? state.library : fallback; const item = source[Math.floor(Math.random() * source.length)]; $('#subject').value = item.prompt; updateResult(); }
async function loadLibrary() {
  try {
    let response = await fetch('../hot_prompts.json');
    if (!response.ok) response = await fetch('./hot_prompts.json');
    const data = await response.json();
    state.library = Object.entries(data.categories).flatMap(([category, prompts]) => prompts.map((item) => ({...item, category})));
    $('#promptCount').textContent = `${state.library.length.toLocaleString()}+`;
  } catch (_) { state.library = fallback; }
  const categories = [...new Set(state.library.map((item) => item.category))]; $('#categorySelect').insertAdjacentHTML('beforeend', categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join(''));
  renderLibrary();
}
$('.mode-switch').addEventListener('click', (event) => { const button = event.target.closest('.mode'); if (button) setMode(button.dataset.mode); });
$('#promptForm').addEventListener('submit', (event) => { event.preventDefault(); updateResult(); });
$('#randomButton').addEventListener('click', randomPrompt); $('#copyButton').addEventListener('click', () => copyText(promptText())); $('#saveButton').addEventListener('click', saveCurrent);
$('#refreshLibrary').addEventListener('click', () => { state.cursor += 6; if (state.cursor >= state.library.length) state.cursor = 0; renderLibrary(); }); $('#categorySelect').addEventListener('change', () => { state.cursor = 0; renderLibrary(); });
$('#assetSearch').addEventListener('input', renderAssets); $('#assetKind').addEventListener('change', renderAssets); $('#assetReview').addEventListener('change', renderAssets);
$('#exportButton').addEventListener('click', () => { const blob = new Blob([JSON.stringify(state.saved, null, 2)], {type:'application/json'}); const link = Object.assign(document.createElement('a'), {href:URL.createObjectURL(blob), download:'prompt-forge-favorites.json'}); link.click(); URL.revokeObjectURL(link.href); });
renderSaved(); updateResult(); loadLibrary(); loadAssets();
