# Prompt Forge 工作台

一个无依赖的静态网页工作台，用于将图片与视频创意组合为可复制提示词。

## 能力

- 图片 / 视频模式：视频模式额外提供镜头运动、动作与时长字段。
- 优先使用父目录（在原素材仓库中运行）或当前目录（独立 GitHub 仓库）下的 `hot_prompts.json` 加载现有提示词灵感库；加载失败时自动使用内置示例。
- 分类浏览、随机起点、复制、浏览器本地收藏与 JSON 导出。
- `media-index.json` 记录本地图片/视频的相对路径、类型、大小、提示词关联文件和审核状态；不包含媒体本体。审核状态保存在浏览器本地。
- 生成结果为模型无关的英文提示词底稿，适配图片或视频模型时可按各服务商语法微调。

## 本地运行

在 `workbench/` 目录运行：

```bash
python3 -m http.server 8080
```

然后打开 `http://localhost:8080/`。独立版仓库将提示词数据置于同一目录；原素材仓库中的工作台也可从根目录启动并打开 `/workbench/`。

素材增删后，在仓库根目录运行 `python3 workbench/build-media-index.py` 更新索引。AI 审核时先读取 `media-index.json`，再按 `path` 回到工作区读取图片、视频或关联提示词文件。


## 本地素材读取：MCP 与工作台桥接

公开 GitHub 仓库只有 `media-index.json`（991 项素材路径），**不包含媒体二进制**。AI 能看到索引，不意味着能实际观察素材画面；原始工作区需从本机授权读取。

在拥有原始 `images/` 的电脑上启动（示例原工作区 `/home/ainfinit/hot-prompts`）：

```bash
cd /path/to/cloned/prompt-forge
export PROMPT_FORGE_WORKSPACE_ROOT=/home/ainfinit/hot-prompts
PROMPT_FORGE_MOCK_AI=1 npm start
```

浏览器打开 `http://127.0.0.1:8080/`，找到「本地图片与视频索引」，点击「本地预览」。图片和视频从本机只读接口 `GET /api/local-media?path=images%2F...` 获取。工作台默认只绑定本机地址，并且只允许 `images/` 下的常见图片/视频扩展名；已禁止相对目录穿越、符号链接逃逸和非媒体文件读取。视频采用分段读取；目前网页预览对超大视频不提供完整流媒体播放器保证。若没有相应本地文件，页面会明确说明不可用，不会把索引伪装成实际媒体。

`npm test` 将验证索引、图片访问限制、路径绕过和令牌限制。若要从 ChatGPT 直接让 AI 审图，可另行连接已授权的 Desktop Commander MCP 或其他带文件读取功能的本地 MCP 服务（需保持电脑在线）。**本地网页预览功能不等同于 ChatGPT 会话获得了电脑文件权限。**

安全提醒：原图可能涉及个人信息，不要直接在公网开放媒体服务。项目无多用户登录和图片持久化后端。云端运行需要独立的权限和存储设计。
