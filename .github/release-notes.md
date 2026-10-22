## 0.1.2 更新

- 纯网址、邮箱、数字、日期、金额及明显编号跳过自动翻译和进度圈；手动快捷键仍可触发。
- 修复设置跨页面覆盖、忘记密钥后被自动保存恢复，以及新开启 AI 后漏掉输入的问题。
- 修复输入法/伪造快捷键误触发、嵌套敏感输入框排除和请求准备期间撤销授权的问题。
- 大型词汇库可正常读取；存储超限保留原记录。限制接口响应内存占用，并优化保险库编码。

## Changes in 0.1.2

- Skip automatic translation and progress for address, numeric and clear identifier content; manual shortcuts remain available.
- Preserve settings across windows, prevent autosave from restoring forgotten keys, and retain input while newly enabled AI settings arrive.
- Fix IME/synthetic shortcut triggers, nested sensitive editor exclusions and consent revocation during request preparation.
- Keep large vocabularies readable and preserve records on storage overflow. Bound response memory and speed up vault encoding.

下载 Assets 中的 `saywell-0.1.2.zip`，解压后在 Chrome / Edge 扩展管理页选择「加载已解压的扩展程序」。首次使用在欢迎页同意并授权，无需填写免费 AI 密钥。GitHub 自动生成的 Source code 压缩包不是安装包。

Download `saywell-VERSION.zip` from Assets, extract it, then choose **Load unpacked** in Chrome / Edge. Read and accept the first-use permission prompt. The included free AI needs no API key. GitHub's automatically generated Source code archives are not extension installation packages.

使用说明 / User guide: https://github.com/ider-zh/saywell#readme

免费 AI 有共享额度，浏览器本地翻译取决于可用性。默认历史仅保留当前浏览器会话；跨重启保留请先创建本地保险库。更新或重新加载会清除会话数据，并锁定已有保险库。

Free AI has shared limits; local translation depends on browser availability. Private history is session-only unless you create a local vault. Updating/reloading clears session data and locks existing vaults.

此 GitHub Release 不代表已上架 Chrome Web Store。启用独立商店自动化后，版本标签可另行触发提交审核；上线以商店审核与实际状态为准。

This GitHub Release does not establish Chrome Web Store availability. When the separate store automation is enabled, the version tag can also submit a package for review. Store approval and actual publication remain separate states.
