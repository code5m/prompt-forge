# Prompt Forge 991 项素材治理与执行规范

## 目标与不可触碰边界
对所有 937 张图片和 54 段视频建立可追溯的独立身份、媒体技术参数、SHA-256 摘要、关联提示词候选、证据级别、规范路径映射与复核记录；分离路径证据/文件中的直接双语内容/AI 模型的视觉猜测/人审。原目录不批量移动、不重命名、不覆盖。规范库生成在 .local/governance，任何调整先生成迁移计划并保留清单后由审批入口执行。禁止将单纯同目录或上级目录提示词标记为已验证关系。

## 交付
1. `npm run govern` 对索引 991 项全量建档，生成 manifest、候选关系、review records、rename map、taxonomy、治理统计，均存入 .local/governance。
2. 每条记录记录 sourcePath、suggestedPath、sha256、mime/ext、bytes、dimensions/duration、sidecars、候选 EN/中文（如源文件直接提供）、evidenceLevel、oneToOneStatus、issues。
3. 三档证据：无原文、共享上级目录提示词、同目录原文候选。真实双语原文可直接保存但只有人工复核后才能正式一对一确权。
4. 审核台同屏展示图片或可播放视频、EN/中文、候选来源、SHA、评分、状态；人工可以在本地数据库留下审查结论。AI 视觉审核独立于审批。
5. 不产生未验证的“匹配成功”。语义审核应基于图像/关键帧 + 候选文本进行多模态模型核验；视频至少关键帧抽样，模型不可用则明确待审。
6. 依次执行 `npm run govern`、`npm test`、GUI 烟雾测试、GitHub CI，并检查工作树；无证据不得宣称语义全通过。

## 文件规范
- 来源原路径不变，ID 不因展示分类或命名改变。
- 建议路径形如 `managed/image/<category>/PF-IMG-000001__<safe-slug>.png` 和 `managed/video/<category>/PF-VID-000001__<safe-slug>.mp4`，映射仅供规划和导出。
- 原始资产永远是权威源；规范库的副本、缩略图和人工审核数据允许删除后重建或独立备份。

## 可复用的 Agent 执行提示词
以本文件为唯一执行契约。核实每一条本地媒体是否存在并取得 SHA-256 和可解码参数；从源 sidecar 生成候选但不可暗中分配共享提示词。批次逐条多模态审核时保留原文及原图证据（视频至少 3 个关键帧），模型置信度和人工确认分开保存，失败需重试但不得虚构成功。先输出迁移计划与回滚映射，不直接改动 /home/ainfinit/hot-prompts。将所有结构、技术元数据、应用 UI 和测试提交到 code5m/prompt-forge 的特性分支，CI PASS 才能合并 main。最后汇报技术扫描 / 多模态审核 / 人工确认三种分母及剩余债务。
