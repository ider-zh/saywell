# Saywell Chrome Web Store 提交材料

状态：维护者已于 2026-10-22 授权配置自动发布和首次提交。邮箱验证、商店服务账号/WIF 认证及只读状态检查已完成，扩展 ID 为 `ofofhnaikohfnbgbckghgccobafkfeig`。0.1.0 用于创建草稿；首次 CI 交付 0.1.1 已成功提交，后台确认 Pending review，尚未上架，审核通过后自动发布。英文表单文案见 [submission.en.md](submission.en.md)。

## 商店文案

名称：Saywell

简短说明：在网页输入框中随写随译、润色中英文，并通过句子练习和词汇收藏改善表达。

完整说明：

Saywell 在你正在使用的网页输入框旁提供中英翻译、润色和词汇提示。停顿一下即可获得建议；只有主动点击 Apply 才会替换原文，也可以复制结果。

- 一步授权即可使用开发者提供的免费 AI，无需注册或填写 API Key。共享每日额度有限，可能调整或结束。
- 浏览器支持时可使用本地机器翻译；还可自行连接 MyMemory、LibreTranslate、Google Cloud、Azure 或多组 AI 服务。自选服务可能需要账号、密钥或付费。
- 连接机器翻译和 AI 后可并行获取结果；开启回退时仅尝试已授权服务。
- 支持中英文控制台、目标语言、网站黑白名单、专属配置、临时暂停和可拖动的浮窗。
- 在浮窗内重输建议句子，查看字符差异；练习输入不发送给远程服务。
- 最近 100 条翻译默认仅在当前浏览器会话保留，可搜索、清理、导出或调整数量。创建本地密码保险库后可跨重启加密保留历史、词汇与统计。
- API Key 默认仅存在会话内存中；记住密钥需要已解锁的加密保险库。

数据处理说明：授权后，输入停顿可自动将当前输入框的完整草稿发送给连接的服务；远程 MT/AI 可并行，失败回退可能涉及多家已授权服务。默认免费 AI 由 Cloudflare Workers AI 处理。浏览器本地翻译不上传文本。普通文本框里的敏感内容无法全部识别，请暂停或屏蔽敏感网站。默认记录包含原文与结果的会话历史，以及数字汇总和网站域名的本地统计；可分别关闭和清理。没有广告、遥测服务器或云端历史同步。

边界：仅支持中英文；本地翻译取决于浏览器及语言模型可用性。部分复杂富文本输入框使用复制回退。浏览器内置页、扩展商店及其他受限页面不可用。没有无限或永久免费的服务承诺。

单一用途：在网页输入框中辅助中英表达，通过翻译、润色以及与结果直接相关的词汇和句子练习改善写作。

已选类别：Productivity → Tools。主语言：Chinese (China)；当前无包内商店元数据本地化，说明字段使用中文在前、英文在后的双语文案。

## 隐私和支持链接

- 中文隐私政策：https://github.com/ider-zh/saywell/blob/main/docs/privacy-policy.zh-CN.md
- 英文隐私政策：https://github.com/ider-zh/saywell/blob/main/docs/privacy-policy.en.md
- 项目：https://github.com/ider-zh/saywell
- 支持：https://github.com/ider-zh/saywell/issues

这些公开链接仅在对应文件推送到 main 后生效；提交前请在退出登录的浏览器中逐一打开。扩展内也附带离线政策页面 privacy.html / privacy.en.html。不要将 chrome-extension:// 地址填入商店的公开隐私政策 URL。

## 隐私表单和权限说明

已按后台九个类别披露：Website content、Personal communications、Personally identifiable information、Health information、Financial and payment information、Authentication information、Location、Web history、User activity。普通输入草稿可能包含个人、医疗、财务或通讯文字；常见敏感字段排除不能保证识别这些普通文字。Authentication information 包括用户自配 API Key；Location 对应远程服务接收的连接 IP，不代表申请 GPS；Web history 对应本地域名记录；User activity 对应本地输入数字汇总和交互处理。没有新增健康、支付、定位或浏览历史 API。即使仅在本地处理也要披露，不能选择“不处理用户数据”。三项限定用途认证与代码及政策一致。若未来收窄真实处理范围，再同时更新表单和政策。

远程代码选 No：所有扩展逻辑在包内，API 和 AI 输出仅作为数据校验并显示，不执行输出代码。服务器处理文本不等于扩展执行远程脚本。实验性 Google/Bing/Edge 网页接口在此版关闭，原有授权也不会重新启用它们。

权限说明英文版可直接用于后台，见下一份材料。所有网站授权为可选；说明它服务于跨网站自动输入辅助，拒绝后可按当前网站授权。不要新增 tabs、history、cookies、webRequest、downloads 或其他无关权限。

## 图片和审查说明

- assets/icon-128.png（来自包内 icons/128.png）：128×128 PNG，96×96 主体及透明留白；保持工具栏小图标清晰。
- assets/promo-440x280.png：商店小宣传图，440×280。
- assets/screenshot-translation-zh.png：真实扩展浮窗，合成示例文本，1280×800。
- assets/screenshot-settings-zh.png：设置与网站配置，1280×800。
- assets/screenshot-history-en.png：历史与加密提示，1280×800。
- GitHub 横幅另见 ../assets/branding/saywell-github-banner.jpg，不替代商店小宣传图。

审核备注：无需登录；安装后点击同意并启用，批准浏览器网站权限，在普通 HTTPS 页的文本框输入“我们可以把这段说明写得更清楚。”并停顿。应出现翻译或润色结果；原文保持到点击 Apply。结果随模型变化。可从浮窗进入句子练习、网站设置、暂停和设置页。审核免费额度耗尽时会显示重置提示；本地 MT 依赖浏览器准备情况，自选服务需单独配置，不应假装主服务正常。建议在有免费额度时送审，提供当次测试录像作补充。

## 维护者提交前核对

- 确认开发者账号、联系邮箱、2-Step Verification、发布者/交易者身份等后台要求；这里不代填身份信息。
- 核对公开政策、数据类别、服务接收方、支持链接和图片均与最终 ZIP 一致。
- 核对 Cloudflare 部署、模型使用条款及额度/运营安排；配置任意第三方服务的用户仍需遵守该服务条款。未核实的实验性网页接口不得重新开放。
- 验证一次真实的无账号初次使用；自动化测试只使用合成文本和模拟 API，不代表线上额度或服务 SLA。
- 首次草稿已上传 release/saywell-0.1.0.zip；API 交付使用经过测试的新版本 release/saywell-0.1.1.zip。内部 manifest.json 在 ZIP 根目录。不要上传整个源码目录或带外层目录的 GitHub 下载压缩包。
- 0.1.1 已通过标签流水线提交审核，勿重复提交或覆盖同版本。后续涉及云端访问权限或后台正式提交的 Computer Use 操作仍遵守执行前确认要求。
