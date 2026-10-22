# Saywell 开发者指南

用户安装与使用说明见[中文 README](README.md)和[English README](README.en.md)。本页面向构建、测试、扩展维护及服务运维；商店材料见 [store/submission.zh-CN.md](store/submission.zh-CN.md)。

## 本地构建

使用 Node.js 24 和 npm：

```sh
npm ci
npx playwright install --with-deps chromium
npm run check
npm run package
```

`check` 依次运行功能单元测试、性能预算、构建和 Chromium 扩展测试。输出为 `dist/`；ZIP 为 `release/saywell-版本号.zip`，manifest 位于根目录。`package.json` 与 `manifest.json` 的版本必须一致。扩展无运行时 npm 依赖，脚本本地打包，不执行远程代码。

首次在扩展管理页加载固定的 `dist` 目录。之后运行 `npm run build`，点击扩展卡片 Reload，再刷新网页即可；无需重复解压或删除安装。**reload/update 会清除 storage.session**：若需要保留历史、词汇和统计，请先创建保险库，更新后重新解锁。固定目录维持安装身份；从其他目录切换安装前可导出设置，导入后恢复授权和凭据。

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 本地打包脚本、图标与双语离线隐私政策 |
| `npm run test` | 功能测试与独立性能预算 |
| `npm run test:browser` | Chromium 扩展及集成测试，先 build |
| `npm run test:performance` | 核心输入与练习比较计时 |
| `npm run preview` | 界面预览，无真实扩展处理或保存能力 |
| `npm run package` | 验证版本并打包 dist |
| `npm run worker:check` | Worker dry-run，不部署、不调用 AI |
| `npm run worker:deploy` | 仅明确授权后，由维护者手动部署 |

可将 `INPUT_COACH_BROWSER` 设为已有 Playwright 兼容 Chromium 的绝对路径。不要并行启动共享 test-results 目录的 Playwright 进程。

## 目录和安全边界

- `src/background.js`：可信消息、站点/端点权限、同意检查、提供商路由和私有存储。
- `src/content/`：输入、IME、浮窗、Apply 与局部练习；不得读取凭据或其他网站历史。
- `src/providers/`：HTTP 适配器和有界结果解析。生产 basic 模块不导入历史实验性网页适配器；后者仅保留协议测试。
- `src/core/private-storage.js`：AES-256-GCM、每次随机 IV、字段/保险库身份 AAD；PBKDF2-SHA-256 600,000 次包装随机数据密钥。
- `docs/privacy-policy.*.md`：公开政策的唯一内容来源，构建生成 dist/privacy.html 和 privacy.en.html。
- `store/`：双语商店描述、权限/隐私表单、审核步骤、宣传图和截图。
- `cloudflare/`：另行部署的匿名限额免费 AI 服务，不包含账户凭据。

网站权限和服务同意分别检查，回退不得扩大同意。提供商输出是不可信文本，不得 HTML 执行。只有 Apply 可以替换，替换前再次检查原文。密钥默认放受限 session 内存；持久密钥必须使用已解锁的密码保险库，不得把密码或明文数据密钥写磁盘。默认私有历史、词汇、统计也仅在加密 session 内存；配置偏好及网站名单仍是非密钥本地配置。

锁定或重启后暂停私有写入，并提高 history generation 拒绝迟到结果。已记住密钥的服务需解锁；不会自动切换 LLM。旧明文数据先迁入会话，成功后删除原字段；更新迁移时打开保险库提示，维护者不应误称迁移自动提供长期保留。遗忘密码只能删除私有数据；配置/原生网页权限保留。配置和练习导出排除密钥/保险库/历史；用户主动历史导出为明文。

## 验证和截图

所有浏览器测试只使用合成文本、模拟 API 和 localhost，禁止私人草稿或真实密钥。固定预算覆盖长输入、4× CPU 限速、IME、滚动布局、练习渲染以及圆环；证据保存在 performance-results 和 test-results。具体预算及方法见 [performance-review.md](docs/performance-review.md)。

保险库测试覆盖重启、锁定、错误密码、IV、AAD、篡改、迁移失败不丢源数据、作用域和清空后的迟到写入。不能用静态扫描代替安全边界测试，也不要用“密钥和密文同目录”作为加密保护方案。

生成商店素材（先构建）：

```powershell
$env:SAYWELL_STORE_ASSETS="1"
npx playwright test tests/browser/store-assets.spec.js
Remove-Item Env:SAYWELL_STORE_ASSETS
```

普通 check 将素材预览写入 test-results/store-assets；显式素材模式才更新 store/assets，避免每次测试改动已选定图片。截图使用真实扩展 UI、合成示例与 localhost 服务；它们不证明线上服务有额度。GitHub 横幅位于 assets/branding，上传 JPEG 为1280×640，原始 PNG 和生成提示同时保留。

## CI 与发布边界

[GitHub Actions](.github/workflows/build.yml) 在 push、PR 或手动运行时执行测试、构建、Worker dry-run、ZIP 打包，保留安装包 14 天、测试/性能证据 7 天。不需要 Cloudflare 密钥，不自动部署后端。普通分支构建不提交 Chrome Web Store；版本标签在完成商店接入并开启专用开关后才调用独立发布流程。

推送与 package/manifest 版本一致的 `v<版本号>` 标签时，检查成功后由独立 job 发布 GitHub Release，附同次构建的 ZIP 并核对 SHA-256。0.x 标记预发布；普通分支构建不会生成 Release。版本、标签和商店 API 账号准备详见[发布指南](docs/releasing.md)。agent 维护与交付约定见 [AGENTS.md](AGENTS.md)。

Chrome 商店使用独立 `chrome-store.yml`，经维护者授权接入 WIF 短期身份。`CWS_ENABLED=true` 已配置；匹配版本标签在完整检查和 GitHub Release 成功后调用商店交付。手动运行只读状态，真实认证检查见 [39766610592](https://github.com/ider-zh/saywell/actions/runs/39766610592)。首次 [v0.1.1 交付 39771550482](https://github.com/ider-zh/saywell/actions/runs/39771550482) 的三个 job 均成功，GitHub 安装包已验证，商店后台确认 0.1.1 为 Pending review。审核通过后由 Google 自动发布；等待审核不等于上线。商店条目、变量和后台状态入口见发布指南。

政策文件推送到 main 后，公开 GitHub 文件链接可用作隐私政策 URL；提交前用退出登录的浏览器验证可达性。账户注册、联系邮箱、2FA、发布者身份、服务和模型使用条件、实际线上初次使用仍由维护者核对。未获明确授权不得提交审核、发布或部署。

Cloudflare 登录、配置、额度及部署操作见 [cloudflare-deployment.md](docs/cloudflare-deployment.md)。Workers Free 的共享限额不等于无限请求，状态检查不执行推理，自动化测试不消耗真实额度。

## 进一步阅读

[架构](docs/architecture.md) · [兼容性与手动测试](docs/compatibility.md) · [验证记录](docs/technical-validation.md) · [开发计划](docs/development-plan.md) · [模型评估](docs/model-evaluation.md) · [开发约定](AGENTS.md)
