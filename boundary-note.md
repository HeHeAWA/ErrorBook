# 个人错题集管理系统 · 边界异常场景处理说明

本文档逐条说明需求中列明的 16 个边界场景在服务端 / 前端的处理逻辑与对应代码位置。

---

### 1. JSON 文件损坏、格式错乱
- **处理**：服务启动钩子 `initAllDataFiles()` 遍历 `/data`，对无法 `JSON.parse` 的文件先备份为 `<文件名>.bak.<时间戳>`，再重置为空模板；运行中 `readJson/updateJson` 捕获 `SyntaxError` 同样备份重置，并返回标准 500 并记录日志。
- **代码**：`tools/fileOpt.js` → `ensureDataFile()` / `readJson()` / `updateJson()` / `logError()`。

### 2. Session 过期（30 分钟无操作）
- **处理**：`getSession()` 比对 `expireTime`，过期立即清除并返回 null；任何需登录接口经 `ensureAuth()` 鉴权，返回 401；前端 `getUserInfo` 返回 401 时导航显示未登录态，受保护页面 `requireLogin()` 自动跳转 `/login.html`。
- **代码**：`middleware/auth.js` → `getSession()` / `ensureAuth()` / `cleanExpiredSessions()`；`public/js/common.js` → `requireLogin()`。

### 3. 并发同时注册相同用户名
- **处理**：`readJson('user.json')` 与 `updateJson('user.json')` 均经文件读写锁（`fileLock.js` 互斥链）串行化，先到者写入成功，后到者在 `register()` 中查重命中返回 **409 冲突**，不会重复创建。
- **代码**：`tools/fileLock.js` / `tools/fileOpt.js` / `service/userService.js` register()。

### 4. 连续 5 次密码错误 → 锁定 10 分钟
- **处理**：`login()` 每次密码错误将 `wrongPwdCount+1`；达 5 次则 `lockTime = now+10min` 并清零计数；锁定期间登录返回 **403** 并携带 `remainMin`（剩余分钟数），前端弹窗提示。
- **代码**：`service/userService.js` login()；`public/js/login.js`。

### 5. 头像 URL 链接失效 / 404
- **处理**：保存时后端 `validateAvatar()` 强制以 http/https 开头；前端预览 `img.onerror` 自动回退到 `default-avatar.svg`；详情/设置页渲染均使用默认头像兜底。
- **代码**：`middleware/validator.js` validateAvatar()；`public/js/settings.js`(`avatarPreview.onerror`)。

### 6. 分页无数据 / 错题为空
- **处理**：`paginate()` 当 `totalPages<=1` 时不渲染分页条；列表为空时前端渲染蓝色空状态卡片（`empty.svg` + 文案）。
- **代码**：`service/errorService.js` paginate()；`public/js/index.js` / `myError.js` / `rank.js` 空状态分支。

### 7. 重复点赞 / 重复收藏同一错题
- **处理**：`toggleLike/toggleCollect` 先查 `(errorId,userId)` 是否已存在——已存在则取消（返回 liked/collected=false），不存在才新增；重复点击不新增重复记录。
- **代码**：`service/errorService.js` toggleLike()/toggleCollect()。

### 8. 用户删除自身错题 → 同步清除关联点赞/收藏
- **处理**：`deleteError()` 在事务 `updateMulti(['error.json','like.json','collect.json','user.json'])` 中：删错题、删其点赞、删其收藏、从所有用户 `ownErrorIds/collectErrorIds` 移除该 ID，原子完成。
- **代码**：`service/errorService.js` deleteError()。

### 9. autoId 自增 ID 丢失 / 数字错乱
- **处理**：启动钩子 `repairAutoId()` 扫描各业务表最大 ID，将 `nextXxxId` 重置为 `max+1`；`nextId()` 在 `autoId.json` 锁内原子 +1 落盘，杜绝并发重复。
- **代码**：`tools/idGenerator.js` repairAutoId()/nextId()。

### 10. 文件读写权限不足 / 磁盘无法写入
- **处理**：捕获 `EACCES` / 写失败异常，统一包装为 **500** 返回，并通过 `logError()` 写入 `logs/server.log` 记录详情，不泄露敏感堆栈给前端。
- **代码**：`tools/fileOpt.js` readJson()/updateJson()/writeJson()/logError()。

### 11. 表单超长文本输入
- **处理**：后端 `validateTitle/validateAnswer/validateAnalysis` 对超过上限（500/1000/2000）自动截断并标记 `truncated`，返回消息追加「部分内容超长已截断」；前端输入也实时限制并红字提示。
- **代码**：`middleware/validator.js`；`service/errorService.js` addError()/updateError()。

### 12. 未登录用户手动输入私有页面地址
- **处理**：服务端 `serveStatic` 前对 `add.html/myError.html/settings.html` 做会话校验，无有效 Cookie 直接 **302 跳转 /login.html**；前端 `requireLogin()` 二次拦截。
- **代码**：`server.js`（受保护页拦截）；`public/js/common.js` requireLogin()。

### 13. 传入不存在 / 非法年级文本参数
- **处理**：所有接收 grade 的接口经 `validateGrade()` 枚举强校验，非枚举值直接返回 **400 参数错误**，绝不写入或参与筛选。
- **代码**：`middleware/validator.js` validateGrade()；`service/errorService.js` listPublic()/listMine()/getRank()/addError()。

### 14. 指定年级下无任何错题
- **处理**：筛选后结果为空，`list/rank` 返回 `total:0`，前端渲染蓝色空状态卡片（首页/排行榜统一占位）。
- **代码**：`public/js/index.js` / `rank.js` 空状态分支；`service/errorService.js`。

### 15. 所有错题无任何点赞数据
- **处理**：`getRank()` 计算 `likeCount` 全为 0，排序后仍返回列表（或空），前端判断 `total===0` 展示空状态；若完全没有错题则整榜为空状态。
- **代码**：`service/errorService.js` getRank()；`public/js/rank.js`。

### 16. 榜单 TOP 名次不足 3 条
- **处理**：前端按返回数据的 `rank` 序号仅对 `rank===1/2/3` 的卡片添加 `.top1/.top2/.top3` 发光类，不足 3 条时仅对存在的排名卡片加特效，其余普通样式。
- **代码**：`public/js/rank.js` render()（`topClass` 判断）；`public/css/global.css` `.top1/.top2/.top3`。

---

## 补充：其他容错
- **请求体超大（>1MB）**：`server.js` readBody() 直接断开连接，防止滥用。
- **目录穿越攻击**：`serveStatic` 用 `path.normalize` + `startsWith(PUBLIC_DIR)` 校验，越界返回 **403**。
- **跨域非法来源**：`middleware/cross.js` 仅放行 localhost，其余返回 **403**。
- **未捕获异常**：`server.js` handle().catch 兜底返回 500 并写日志。

---

## 补充（二）：图片上传功能边界场景

### 17. 非图片 / 伪装类型上传（如改后缀的 exe、text）
- **处理**：后端 `imageService.uploadImages()` 仅按 **Content-Type（MIME）白名单** `image/jpeg|png|gif|webp` 判定，不看后缀；非白名单直接返回 **400「仅支持 JPG/PNG/GIF/WEBP 图片格式」**。前端 `add.js` / `detail.js` 也按 `file.type` 预筛，双重拦截。
- **代码**：`service/imageService.js` → `ALLOWED_TYPE` / `uploadImages()`；`public/js/add.js`、`public/js/detail.js`。

### 18. 单张图片超过 2MB
- **处理**：后端按 `buffer.length > 2MB` 返回 **400「单张图片不能超过 2MB」**；前端选择时即校验 `file.size`，超限即时红色提示并拒绝加入。
- **代码**：`service/imageService.js` → `MAX_SIZE`；`public/js/add.js`。

### 19. 同一错题图片数量超过 5 张
- **处理**：新增时前端限制 `selectedFiles.length ≤ 5`；**编辑时**后端 `uploadImages()` 读取该错题已有 `images` 数量，若「已有 + 新增 > 5」返回 **400** 并提示「还可上传 N 张」。最终落库的 `images` 数组经 `validator.validateImages()` 再次校验长度 ≤5。
- **代码**：`service/imageService.js` → `MAX_COUNT` / `uploadImages()`；`middleware/validator.js` → `validateImages()`。

### 20. 向他人错题 / 不存在的错题上传图片
- **处理**：编辑上传必须带 `errorId`，后端 `uploadImages()` 查 `error.json`：错题不存在返回 **400「错题不存在」**；`authorUserId !== 当前用户` 返回 **403「仅本人可上传本题图片」**。新增时不上传（先建错题再追加）。
- **代码**：`service/imageService.js` → `uploadImages()`；`route/errorRoute.js` → `upload()`。

### 21. 上传报文格式损坏 / 缺 boundary
- **处理**：`tools/multipart.js` parse() 在缺 `boundary`、无 boundary 段、空体时抛出 **400「multipart 格式非法...」**；`server.js` readMultipart() 捕获并统一返回 400。上传体超过 **12MB** 直接断开连接返回 400「上传文件过大」。
- **代码**：`tools/multipart.js` → `parse()`；`server.js` → `readMultipart()` / `MULTIPART_LIMIT`。

### 22. 删除错题 / 移除单张图片 → 磁盘文件清理
- **处理**：`deleteError()` 删除错题前记录 `images` 字段，事务成功后调用 `imageService.removeImageFiles()` 删除对应物理文件；编辑时若新 `images` 数组剔除了某些旧图，update 事务内对「被移除项」同步删除磁盘文件。删除前 `path.basename` 取文件名并 `startsWith(UPLOAD_DIR)` 二次校验，杜绝路径穿越删除。
- **代码**：`service/errorService.js` → `deleteError()` / `updateError()`；`service/imageService.js` → `removeImageFiles()`。

### 23. 上传成功但提交取消 / 新增未保存 → 孤立图片
- **处理**：新增错题时先调 `/api/error/upload` 落盘、再把返回的 URL 随 `/api/error/add` 一并提交；若用户中途放弃新增，已落盘图片成为「孤立文件」（不参与任何错题）。本系统采取**轻量策略**：不阻塞主流程，定期可手动清理 `public/img/uploads/`；如需严格零残留，可在新增页放弃时调用删除接口（当前未实现，见 check-list 备注）。
- **代码**：`public/js/add.js`（先上传后提交）；`service/imageService.js`。

### 24. 一次性提交大量图片导致请求超时
- **处理**：前端单张限制 2MB、总数 5 张，理论最大 ~10MB，服务端 `MULTIPART_LIMIT=12MB` 兜底；超限直接断开，返回 400，不会拖垮服务。
- **代码**：`server.js` → `MULTIPART_LIMIT`；`public/js/add.js` / `detail.js`。

### 25. 错题分析报告：未登录访问 `/api/error/report`
- **处理**：该接口在 `server.js` 路由表中标记 `auth: true`，`handle()` 经 `ensureAuth()` 校验会话，未登录 / Session 过期统一返回 **401「未登录或会话已过期」**；静态页 `/report.html` 在 PROTECTED_PAGES 中，未登录直接 **302 跳转 /login.html**。
- **代码**：`server.js` → ROUTES（report）/ PROTECTED_PAGES；`middleware/auth.js` → `ensureAuth()`。

### 26. 错题分析报告：当前用户尚未录入任何错题
- **处理**：`report()` 统计本人 `ownErrorIds` 为空，`total=0`、`byType=[]`、`byGrade=[]`；`buildSuggestions()` 返回引导式 `summary`（去"新增错题"积累数据），`list` 为空。前端 `report.js` 渲染**蓝色空状态卡片**并链接到 `add.html`，不绘制图表。
- **代码**：`service/errorService.js` → `report()` / `buildSuggestions()`；`public/js/report.js` → 空态分支。

### 27. 详情页「显示/隐藏答案」：隐藏态下的内容安全
- **处理**：答案始终以 HTML 转义后的文本渲染在 DOM 中（`App.escapeHtml`），仅通过 `style.display` 控制可见性；默认 `display:none` 隐藏。即使答案含 `<script>` 等字符，也只会作为文本显示且默认不可见，杜绝 XSS 与误渲染。
- **代码**：`public/js/detail.js` → render() 答案块 + toggleAnswer 切换逻辑。

### 28. 错题分析报告：某类型/年级占比为 0 或仅单一种类
- **处理**：饼图按实际 `byType` 绘制，仅一种类型时整圆为该色且中心显示总数；占比过小（扇区角度 < 0.25 rad）时不绘制百分比文字以免重叠。条形图按 `byGrade` 动态计算行高与最大刻度，单一/多种类均能正确渲染；`max` 为空时兜底为 1 避免除零。`bySubject` 复用同一 `drawBars()`，学科单一/多种类同理正确渲染。
- **代码**：`public/js/report.js` → `drawPie()`（角度阈值）/ `drawBars()`（max 兜底、行高自适应）。

### 29. 传入不存在 / 非法学科文本参数
- **处理**：所有接收 subject 的接口经 `validateSubject()` 枚举强校验，非枚举值直接返回 **400 参数错误**（与年级同理），绝不写入或参与筛选；统计接口对旧数据中缺失的 subject 兜底为「其他」。
- **代码**：`middleware/validator.js` → `validateSubject()`；`service/errorService.js` → listPublic()/listMine()/getRank()/addError()/updateError()/report()。

### 30. 详情页「显示/隐藏答案与解析」：二者始终联动
- **处理**：标准答案与解析被包在同一个 `#answerBox` 容器内，**只有一个**「显示答案」按钮控制其整体 `display`，不存在「只显答案不显解析」或反之的情况；默认 `display:none` 整体隐藏，点击后整体显示/隐藏，按钮文案同步切换。答案与解析内容均经 `App.escapeHtml` 转义，隐藏态下也不会被意外渲染执行（防 XSS）。
- **代码**：`public/js/detail.js` → render() 答案+解析同容器 + `toggleBtn.onclick` 切换逻辑。

---

## 补充（三）：AI 功能边界场景

### 31. AI 后端未启用（AI_ENABLED=false）
- **处理**：`getAiConfig()` 读取 `.env`，当 `AI_ENABLED` 非 true 时 `chatVision()` 直接抛出 **503「AI 功能未启用，请检查 .env 中的 AI_ENABLED」**；前端 toast 提示，不渲染结果。
- **代码**：`tools/env.js` getAiConfig()；`service/aiService.js` chatVision()。

### 32. AI 后端地址不可达 / Ollama 未启动
- **处理**：`fetch` 抛网络异常（连接拒绝 / DNS 失败等）→ catch 返回 **502「无法连接 AI 后端（<url>），请确认 Ollama 已启动或密钥/地址已正确配置」**；若 `AbortSignal.timeout`（>120s）触发则提示「请求超时」。服务整体不崩溃。
- **代码**：`service/aiService.js` chatVision()（fetch + try/catch + 超时控制）。

### 33. AI 后端返回非 2xx（401/429/500 等）
- **处理**：读取响应体前判断 `res.ok`，非 2xx 时取响应文本（截断 120 字）拼入 **502** 消息返回；前端 toast 展示具体原因（如 key 无效、额度用尽）。
- **代码**：`service/aiService.js` chatVision()（`if (!res.ok)` 分支）。

### 34. AI 返回非 JSON / 无法解析为结构化数据（find 场景）
- **处理**：`findWrong()` 先 `extractJson()` 稳健提取（兼容 ```json 包裹 / 前后多余文本 / 直接数组），提取失败抛出 **502「AI 返回内容无法解析为结构化数据，建议更换更强的视觉模型后重试」**；前端提示用户检查图片清晰度或更换模型。
- **代码**：`service/aiService.js` extractJson() / findWrong()。

### 35. 识别错题：上传非图片 / 不支持类型
- **处理**：`public/js/aiFind.js` addFiles() 仅接收 `f.type` 以 `image/` 开头的文件，非图片给出提示并跳过；张数上限 6 张（超出提示并停止添加）。识别本身在前端用 Tesseract.js 完成，无后端 AI 接口、无需密钥。
- **代码**：`public/js/aiFind.js` addFiles() / normalize / parsePaper。

### 36. 识别错题：一道题同时「打叉 + 扣分」只计一次
- **处理**：`parsePaper()` 先按题号把 OCR 文本分块，对同一题号的多次标记合并：任一信号含「错误/扣分/错字样」即判为 `wrong`，`wrongCount` 对每个题号只 +1，杜绝重复计数；跨页或 OCR 重复出现的同一题号也会合并为一条。这正对应需求中「既打叉又扣分只算一次错误」。
- **代码**：`public/js/aiFind.js` parsePaper()（Map 按题号分组 / 合并信号 / 排序），纯函数已用单测覆盖。

### 37. OCR 识别准确性与免责
- **处理**：OCR 为浏览器端文字识别，结果可能包含错误（尤其手写批改符号识别较弱）。页面顶部与结果区均有醒目声明「OCR 自动识别结果可能有误，仅供参考，请人工核对」；结果区提供「OCR 原始文字」可展开核对；提供「补充说明」文本框让用户输入明确批改信息提升准确率；「加入错题集」仅预填标题与 OCR 判断依据，答案 / 类型 / 年级 / 学科仍需用户人工补全。离线导致 OCR 引擎加载失败时自动切换为「手动添加」模式。
- **代码**：`public/aiFind.html` .ai-disclaimer；`public/js/aiFind.js` .ai-note / 原文 `<details>` / Tesseract 未定义分支 / 跳转预填逻辑。
