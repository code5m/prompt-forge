// Prompt Forge's pure, testable prompt/revision helpers. No secrets or network calls.
const WORDS = /\s+|[\u3400-\u9fff]|[A-Za-z0-9]+|[^\s]/gu;
export const LIMITS = Object.freeze({ draft: 3000, batch: 5 });

export function escapeHtml(input) {
  return String(input ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

export function uuid() {
  return globalThis.crypto?.randomUUID?.() ||
    "pf-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

export function hasCjk(text) {
  return /[\u3400-\u9fff]/u.test(String(text));
}

export function buildDraft(fields) {
  const subject = String(fields.subject || "").trim() || "一个独特而鲜明的视觉创意";
  const image = [
    subject, fields.style?.zh || "电影感写实",
    fields.composition?.zh || "中景、三分构图",
    fields.lighting?.zh || "柔和的电影光",
    fields.detail || "丰富细节、自然材质",
    fields.ratio?.zh || "16:9 横幅"
  ];
  const english = [
    subject, fields.style?.en || "cinematic photographic still",
    fields.composition?.en || "medium shot, rule of thirds",
    fields.lighting?.en || "soft cinematic lighting",
    fields.detail || "highly detailed, natural texture"
  ];
  if (fields.mode === "video") {
    image.push(fields.motion?.zh || "缓慢推进", fields.action || "自然细微动作", fields.duration?.zh || "5 秒", "保持时间连续性");
    english.push(fields.motion?.en || "slow push-in", fields.action || "subtle natural movement", fields.duration?.en || "5 seconds", "smooth temporal consistency");
  }
  english.push(fields.ratio?.en || "16:9");
  return {
    zh: image.filter(Boolean).join("，"),
    en: english.filter(Boolean).join(", "),
    translationPending: hasCjk(english.join(" "))
  };
}

export function newRecord(title, zh, en, reason = "初始版本", source = "manual") {
  const id = uuid();
  return {
    id,
    title: String(title || "未命名方案").slice(0, 80),
    versions: [{ id: uuid(), number: 1, zh: String(zh || ""), en: String(en || ""), reason, source, at: new Date().toISOString() }],
    comparisons: []
  };
}

export function appendVersion(record, zh, en, reason, source = "manual") {
  if (!record || !Array.isArray(record.versions) || !record.versions.length) throw new Error("方案不存在");
  const newest = record.versions[record.versions.length - 1];
  if (newest.zh === zh && newest.en === en) return newest;
  if (record.versions.length >= 100) throw new Error("单个方案最多保留 100 个版本，请先导出备份");
  const version = {
    id: uuid(), number: newest.number + 1, zh: String(zh).slice(0, LIMITS.draft),
    en: String(en).slice(0, LIMITS.draft), reason: String(reason || "手工修改").slice(0, 250),
    source, at: new Date().toISOString()
  };
  record.versions.push(version);
  return version;
}

export function tokenize(value) {
  return String(value || "").match(WORDS) || [];
}

// LCS diff of words/Chinese characters. Escapes all content before adding markup.
export function renderDiff(before, after) {
  const a = tokenize(before), b = tokenize(after);
  if (a.length === 0 && b.length === 0) return '<span class="quiet">暂无内容</span>';
  if (a.length > 350 || b.length > 350) {
    return '<del class="diff-del">' + escapeHtml(before) + '</del><ins class="diff-ins">' + escapeHtml(after) + '</ins>';
  }
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0, j = 0, html = "";
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      html += escapeHtml(a[i++]); j++;
    } else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      html += '<ins class="diff-ins">' + escapeHtml(b[j++]) + '</ins>';
    } else {
      html += '<del class="diff-del">' + escapeHtml(a[i++]) + '</del>';
    }
  }
  return html;
}

export function validateReview(review, base) {
  if (!review || typeof review !== "object" || review.id !== base.id) throw new Error("审核结果的 ID 不对应");
  const zh = String(review.zh || "").trim(), en = String(review.en || "").trim();
  if (!zh || !en || zh.length > LIMITS.draft || en.length > LIMITS.draft) throw new Error("审核后的双语内容不完整");
  const issues = Array.isArray(review.issues) ? review.issues.slice(0, 6).map(String) : [];
  const changes = Array.isArray(review.changes) ? review.changes.slice(0, 6).map(String) : [];
  return {
    id: base.id, zh, en, issues, changes,
    score: Math.round(Math.max(0, Math.min(100, Number(review.score) || 0))),
    reason: String(review.reason || "优化表达、构图和模型可执行性").slice(0, 250)
  };
}

export function imageSizeForRatio(ratio) {
  const sizes = {
    "16:9": "1536x864",
    "9:16": "864x1536",
    "1:1": "1024x1024",
    "4:5": "1024x1280",
    "21:9": "1792x768"
  };
  return sizes[ratio] || "1024x1024";
}

export function validBackup(data) {
  return !!data && Array.isArray(data.records) && data.records.length <= 200 &&
    data.records.every(r => typeof r.id === "string" && typeof r.title === "string" &&
      Array.isArray(r.versions) && r.versions.length >= 1 && r.versions.length <= 100 &&
      r.versions.every(v => typeof v.zh === "string" && typeof v.en === "string" &&
        v.zh.length <= LIMITS.draft && v.en.length <= LIMITS.draft));
}
