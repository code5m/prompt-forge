// Prompt Forge: dependency-free local server and authenticated SenseNova API proxy.
// Node >=20. Never expose SENSENOVA_API_KEY to browser, logs, or GitHub.
import http from "node:http";
import {serveLocalMedia} from "./local-media.mjs";
import {readPromptEvidence} from "./prompt-evidence.mjs";
import {createAssetStore} from "./asset-store.mjs";
import {visionPayload,visionPrompt} from "./visual-review.mjs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateReview, LIMITS } from "./core.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = "https://token.sensenova.cn/v1";
const IMAGE_MODEL = "sensenova-u1.5-lite";
const REVIEW_MODEL = "sensenova-6.8-flash-lite";
const ALLOWED_SIZES = new Set(["1024x1024", "1536x864", "864x1536", "1024x1280", "1792x768"]);
const STATIC = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/core.js", ["core.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/hot_prompts.json", ["hot_prompts.json", "application/json; charset=utf-8"]],
  ["/media-index.json", ["media-index.json", "application/json; charset=utf-8"]],
  ["/asset.css", ["asset.css", "text/css; charset=utf-8"]],
  ["/studio.css", ["studio.css", "text/css; charset=utf-8"]],
  ["/studio.js", ["studio.js", "text/javascript; charset=utf-8"]],
  ["/research.js", ["research.js", "text/javascript; charset=utf-8"]],
  ["/research.css", ["research.css", "text/css; charset=utf-8"]],
  ["/knowledge.js", ["knowledge.js", "text/javascript; charset=utf-8"]],
  ["/knowledge-core.js", ["knowledge-core.js", "text/javascript; charset=utf-8"]],
  ["/knowledge.css", ["knowledge.css", "text/css; charset=utf-8"]],
  ["/audit.js", ["audit.js", "text/javascript; charset=utf-8"]],
  ["/asset-center.js", ["asset-center.js", "text/javascript; charset=utf-8"]],
  ["/asset-center.css", ["asset-center.css", "text/css; charset=utf-8"]]
]);

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const clean = (value, max = LIMITS.draft) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeJson = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  res.end(JSON.stringify(body));
};
const isLoopback = host => ["127.0.0.1", "localhost", "::1"].includes(host);
const xmlEscape = text => String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]));

async function jsonBody(req, bytesMax = 60000) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > bytesMax) throw new ApiError(413, "提交内容过长");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ApiError(400, "JSON 格式不正确"); }
}

function readModelJson(text) {
  if (typeof text !== "string") throw new ApiError(502, "审核模型没有返回文本");
const stripped = text.trim().replace(/^`{3}(?:json)?\s*/i, "").replace(/\s*`{3}$/i, "");
  try { return JSON.parse(stripped); }
  catch {
    const start = stripped.indexOf("{"), end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) throw new ApiError(502, "AI 审核返回的不是 JSON，请重试较小批次");
    try { return JSON.parse(stripped.slice(start, end + 1)); }
    catch { throw new ApiError(502, "AI 审核结果格式异常，旧版提示词保持不变"); }
  }
}

function validateInputs(body) {
  const items = body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > LIMITS.batch)
    throw new ApiError(400, "单次审核必须选择 1—5 条");
  const ids = new Set();
  return items.map(item => {
    const id = clean(item?.id, 80), zh = clean(item?.zh), en = clean(item?.en);
    if (!id || ids.has(id) || !(zh || en) || (item?.zh?.length || 0) > LIMITS.draft || (item?.en?.length || 0) > LIMITS.draft)
      throw new ApiError(400, "待审核提示词为空、过长或 ID 重复");
    ids.add(id);
    return { id, zh, en };
  });
}

function mockReview(items) {
  return items.map(item => ({
    id: item.id, score: 70,
    zh: (item.zh || "演示中文释义：" + item.en).slice(0, 2700) + "，主体清晰，光线与主体保持一致（模拟建议）",
    en: (item.en || "Mock English version of: " + item.zh).slice(0, 2700) + ", coherent composition and consistent subject lighting (MOCK)",
    issues: ["模拟审核结果：尚未连接真实 AI，不代表实际评分"],
    changes: ["演示增加了光线一致性约束，检查双语差异面板"],
    reason: "模拟审核；配置日日新 Token 后再进行正式审查"
  }));
}

function mockImage(prompt) {
  const label = xmlEscape(prompt.slice(0, 62));
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">' +
    '<rect width="1024" height="1024" fill="#e6ebe6"/>' +
    '<rect x="52" y="52" width="920" height="920" rx="32" fill="#fff" stroke="#93a9a2" stroke-width="4"/>' +
    '<text x="512" y="400" text-anchor="middle" font-size="55" fill="#293f3b">模拟样张 / MOCK</text>' +
    '<text x="512" y="470" text-anchor="middle" font-size="29" fill="#526b65">不是日日新实际生成图片</text>' +
    '<foreignObject x="110" y="550" width="805" height="220"><div xmlns="http://www.w3.org/1999/xhtml" style="font:24px sans-serif;overflow-wrap:anywhere;color:#293f3b">' +
    label + '</div></foreignObject></svg>';
  return { imageBase64: Buffer.from(svg).toString("base64"), mime: "image/svg+xml", mock: true, model: IMAGE_MODEL };
}

async function providerCall(fetchImpl, key, path, payload) {
  let response;
  try {
    response = await fetchImpl(ORIGIN + path, {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError")
      throw new ApiError(504, "日日新接口超时，原版本已保留");
    throw new ApiError(502, "日日新网络请求失败，请检查网络");
  }
  if (!response.ok) {
    const message = response.status === 401 ? "日日新密钥无效或已过期" :
      response.status === 403 ? "账户尚未开通对应模型权限" :
      response.status === 429 ? "日日新接口限流，请稍后重试" :
      response.status >= 500 ? "日日新服务暂时不可用" :
      "日日新拒绝请求，请检查提示词与模型权限";
    throw new ApiError(response.status === 429 ? 429 : 502, message + "（HTTP " + response.status + "）");
  }
  const maxSize = path.includes("images") ? 35000000 : 1500000;
  const length = Number(response.headers?.get("content-length") || 0);
  if (length > maxSize) throw new ApiError(502, "日日新返回数据超过单图限制");
  const raw = await response.text();
  if (raw.length > maxSize) throw new ApiError(502, "日日新返回内容过大");
  try { return JSON.parse(raw); }
  catch { throw new ApiError(502, "日日新返回格式异常"); }
}

export function createAppServer({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const store=createAssetStore(join(ROOT,".local","asset-state.json"));
  const mock = env.PROMPT_FORGE_MOCK_AI === "1";
  const accessToken = env.WORKBENCH_ACCESS_TOKEN || "";
  const apiKey = env.SENSENOVA_API_KEY || "";
  const perMinute = Math.max(1, Math.min(60, Number(env.PROMPT_FORGE_REQUESTS_PER_MINUTE) || 12));
  let active = 0;
  const buckets = new Map();
  return http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'self'");
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    try {
      if ((req.method === "GET" || req.method === "HEAD") && pathname === "/api/local-media") {
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401, "访问口令错误");
        return await serveLocalMedia(req,res,{workspaceRoot:env.PROMPT_FORGE_WORKSPACE_ROOT});
      }
      if (pathname === "/api/assets/catalog" && req.method === "GET") {
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        try {return safeJson(res,200,JSON.parse(await readFile(join(ROOT,".local","organized","catalog.json"),"utf8")));}
        catch {throw new ApiError(404,"未建立资产目录，请执行 npm run organize");}
      }
      if (pathname === "/api/assets/state" && req.method === "GET"){
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        return safeJson(res,200,await store.read());
      }
      if (pathname === "/api/assets/import" && req.method === "POST"){
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        const body=await jsonBody(req,2500000);
        try {return safeJson(res,200,await store.importLegacy(body.records));}
        catch(e){throw new ApiError(400,String(e.message));}
      }
      if (pathname === "/api/assets/visual-review" && req.method === "POST"){
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        if(mock || !apiKey)throw new ApiError(503,"图文联合审核需要真实模型");
        const body=await jsonBody(req);
        if(typeof body.id!=="string"||typeof body.prompt!=="string"||!body.prompt.trim())throw new ApiError(400,"缺少图片或提示词");
        if(active>=1)throw new ApiError(429,"图文审核串行执行，请稍后重试");
        active++;
        try{
          const {image}=await visionPayload(env.PROMPT_FORGE_WORKSPACE_ROOT,body.id,join(ROOT,"media-index.json"));
          const result=await providerCall(fetchImpl,apiKey,"/chat/completions",{
            model:env.PROMPT_FORGE_VISION_MODEL||REVIEW_MODEL,max_tokens:1200,
            messages:[{role:"user",content:[{type:"text",text:visionPrompt(body.prompt)},{type:"image_url",image_url:{url:image}}]}]
          });
          const parsed=readModelJson(result?.choices?.[0]?.message?.content);
          if(typeof parsed.matched!=="boolean"||!Array.isArray(parsed.observations)||!Array.isArray(parsed.issues))throw new ApiError(502,"视觉审核返回数据不完整");
          const persisted=await store.mutate(body.id,"visual-review",{...parsed,prompt:body.prompt,model:env.PROMPT_FORGE_VISION_MODEL||REVIEW_MODEL});
          return safeJson(res,200,{review:persisted.visualReviews.at(-1),approvedAutomatically:false});
        }finally{active--;}
      }
      if (pathname === "/api/assets/update" && req.method === "POST"){
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        const body=await jsonBody(req);
        try{return safeJson(res,200,await store.mutate(body.id,body.action,body.payload));}
        catch(error){throw new ApiError(400,String(error.message).slice(0,180));}
      }
      if (req.method === "GET" && pathname === "/api/audit-report") {
        if(accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401,"访问口令错误");
        try {return safeJson(res,200,JSON.parse(await readFile(join(ROOT,".local","audit-report.json"),"utf8")));}
        catch {throw new ApiError(404,"请先在本地运行 npm run audit");}
      }
      if (req.method === "GET" && pathname === "/api/evidence") {
        if (accessToken && req.headers["x-workbench-access"] !== accessToken) throw new ApiError(401, "访问口令错误");
        const assetId = new URL(req.url || "/", "http://localhost").searchParams.get("path");
        try {
          const evidence = await readPromptEvidence(env.PROMPT_FORGE_WORKSPACE_ROOT,assetId,join(ROOT,"media-index.json"));
          return safeJson(res,200,evidence);
        } catch {throw new ApiError(400,"无法读取本地关联证据，请检查素材路径");}
      }
      if (req.method === "GET" && pathname === "/api/status") {
        return safeJson(res, 200, {
          mode: mock ? "mock" : apiKey ? "live" : "unconfigured",
          imageModel: IMAGE_MODEL, reviewModel: REVIEW_MODEL, accessTokenRequired: !!accessToken,
          requestLimitPerMinute: perMinute
        });
      }
      if (pathname.startsWith("/api/")) {
        if (req.method !== "POST") throw new ApiError(405, "仅支持 POST 请求");
        if (pathname !== "/api/reviews/batch" && pathname !== "/api/images/generate")
          throw new ApiError(404, "未知接口");
        if (accessToken && req.headers["x-workbench-access"] !== accessToken)
          throw new ApiError(401, "工作台访问口令不正确");
        if (!mock && !apiKey)
          throw new ApiError(503, "未配置 SENSENOVA_API_KEY，请在服务端设置环境变量");
        const now = Date.now();
        for (const [id, entry] of buckets) if (entry.until < now) buckets.delete(id);
        const client = req.socket.remoteAddress || "local";
        let bucket = buckets.get(client);
        if (!bucket) { bucket = { count: 0, until: now + 60000 }; buckets.set(client, bucket); }
        if (bucket.count >= perMinute) throw new ApiError(429, "已达到本机每分钟调用上限，防止意外消耗额度");
        if (active >= 2) throw new ApiError(429, "当前有 2 个请求正在进行，请稍后重试");
        const body = await jsonBody(req);
        active++;
        bucket.count++;
        try {
          if (pathname === "/api/reviews/batch") {
            const items = validateInputs(body);
            let results;
            if (mock) results = mockReview(items);
            else {
              const instruction = "你是专业中文导演和提示词质检专家。逐条审核下列图片或视频提示词，严格保留主体/场景/故事事实，不新增无依据角色。审查可执行性、光线、构图、动作连续性、术语以及中英文语义对齐；缺少中文或英文时提供完整的准确翻译。每条给出0-100评分、issues(中文缺陷)、changes(中文改动点)、reason(中文一句话)、zh(优化后完整中文)、en(优化后完整英文)。只能返回合法 JSON 对象 {\"results\":[...]}, 每条 id 必须与输入对应，不能输出 Markdown，也不要加入解释。双语内容务必等价，不能只把英文原文贴到中文字段。输入：" + JSON.stringify(items);
              const data = await providerCall(fetchImpl, apiKey, "/chat/completions", {
                model: REVIEW_MODEL, temperature: 0.5, max_tokens: 12000,
                messages: [{ role: "user", content: instruction }]
              });
              const parsed = readModelJson(data?.choices?.[0]?.message?.content);
              if (!Array.isArray(parsed?.results)) throw new ApiError(502, "审核模型缺少 results 数组");
              results = parsed.results;
            }
            const found = new Map(results.map(item => [item.id, item]));
            const checked = items.map(item => {
              if (!found.has(item.id)) throw new ApiError(502, "审核结果缺少方案：" + item.id);
              try { return validateReview(found.get(item.id), item); }
              catch { throw new ApiError(502, "双语审核结果不完整，已保留原文"); }
            });
            return safeJson(res, 200, { results: checked, mock, model: REVIEW_MODEL });
          }
          const prompt = clean(body?.prompt);
          if (!prompt || (body?.prompt?.length || 0) > LIMITS.draft)
            throw new ApiError(400, "图片提示词不能为空或超过 3000 字");
          if (!ALLOWED_SIZES.has(body?.size)) throw new ApiError(400, "不支持所选图片尺寸");
          if (body?.promptExtend !== false) throw new ApiError(400, "严谨 A/B 对比必须关闭模型自动扩写");
          if (mock) return safeJson(res, 200, mockImage(prompt));
          const data = await providerCall(fetchImpl, apiKey, "/images/generations", {
            model: IMAGE_MODEL, prompt, size: body.size, n: 1,
            watermark: true, prompt_extend: false, output_format: "png", response_format: "b64_json"
          });
          const first = data?.data?.[0];
          const image = first?.b64_json;
          if (typeof image !== "string" || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image) || image.length > 32000000)
            throw new ApiError(502, "日日新未返回有效 Base64 图片，无法保存对比结果");
          return safeJson(res, 200, { imageBase64: image, mime: "image/png", mock: false, model: IMAGE_MODEL });
        } finally { active--; }
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new ApiError(405, "仅支持 GET");
      const file = STATIC.get(pathname);
      if (!file) throw new ApiError(404, "页面不存在");
      const bytes = await readFile(join(ROOT, file[0]));
      res.writeHead(200, { "Content-Type": file[1], "Cache-Control": "no-cache" });
      return res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      safeJson(res, error instanceof ApiError ? error.status : 500,
        { error: error instanceof ApiError ? error.message : "服务器内部错误，请查看终端日志" });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 8080);
  if (!isLoopback(host) && !process.env.WORKBENCH_ACCESS_TOKEN) {
    console.error("拒绝公网启动：请先设置 WORKBENCH_ACCESS_TOKEN，并通过 HTTPS 反向代理提供服务。");
    process.exit(1);
  }
  createAppServer().listen(port, host, () => {
    console.log("Prompt Forge: http://" + host + ":" + port +
      (process.env.PROMPT_FORGE_MOCK_AI === "1" ? " [MOCK]" :
        process.env.SENSENOVA_API_KEY ? " [SenseNova ready]" : " [API key missing]"));
  });
}
