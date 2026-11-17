## 0.1.3 更新

- AI 翻译与润色时，网址、邮箱、常见路径和明显编号使用临时占位符；结果恢复为原文，缺失或被修改时保留可用的机器翻译。
- 特殊内容在建议中显示为可展开的小标签，让表达本身更醒目；复制、应用和历史保留完整内容。
- 机器翻译继续接收原始文本；混合内容按正文语言选择方向，避免长网址干扰中英判断。
- 增加占位符校验、隐私边界、真实扩展交互与长内容输入性能回归测试。

## Changes in 0.1.3

- Protect websites, emails, common paths and clear IDs with temporary placeholders during AI translation and polishing. Restore exact originals and retain available MT if validation fails.
- Show special content as compact expandable tags. Copy, Apply and history retain the full text.
- Keep original-source MT and use prose language for mixed-content routing, so long references do not distort translation direction.
- Add placeholder validation, privacy, real-extension interaction and long-input performance regressions.

下载 Assets 中的 `saywell-0.1.3.zip`，解压后在 Chrome / Edge 扩展管理页选择「加载已解压的扩展程序」。首次使用在欢迎页同意并授权，无需填写免费 AI 密钥。GitHub 自动生成的 Source code 压缩包不是安装包。

Download `saywell-0.1.3.zip` from Assets, extract it, then choose **Load unpacked** in Chrome / Edge. Accept the first-use permission prompt. Included free AI needs no API key. Source code archives are not extension installation packages.

使用说明 / User guide: https://github.com/ider-zh/saywell#readme

免费 AI 有共享额度。默认历史仅保留当前浏览器会话；跨重启保留请先创建本地保险库。更新或重新加载会清除会话数据，并锁定已有保险库。

Free AI has shared limits. Private history is session-only unless you create a local vault. Updating/reloading clears session data and locks existing vaults.

此 GitHub Release 不代表已上架 Chrome Web Store；独立流水线提交审核，上线以商店实际状态为准。

GitHub Release availability and Chrome Web Store approval/publication are separate states. The enabled store workflow submits this tagged package for review.
