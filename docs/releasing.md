# 构建、GitHub Release 与 Chrome 商店

这三个结果需要分别验证：Actions 构建成功只代表检查和打包通过；Artifacts 是临时构建下载；GitHub Release 是项目版本下载；Chrome 商店还有独立的上传、审查与发布流程。

## GitHub Release

普通 push、PR 和手动运行只执行 CI，不发布 Release。推送 `v<版本号>` 标签后，现有 build workflow 检查标签、package.json、package-lock.json 和 manifest.json 一致，完成全部测试、Worker dry-run 与打包，再进入独立发布 job。发布提交必须已经合入默认分支。

发布 job 下载同一次构建的 ZIP，保持压缩包原样并验证 SHA-256。先创建带安装包的草稿，再发布 GitHub Release。只有此 job 有 contents:write；构建和 PR 保持只读。0.x 版本标记为预发布。此流程只使用临时 GITHUB_TOKEN，不需要额外个人访问令牌或商店凭据。

版本发布由维护者明确授权后，agent 完成版本、验证、提交、推送和标签操作。版本号同时更新 package.json、package-lock.json 与 manifest.json；不复用已发布版本，也不移动标签或覆盖旧安装包。仅增加 workflow 不会自动创建版本标签，也不会补发历史 Release。

例如，确认发布 0.1.1 且三个文件已更新、变更已合并、验证完成后：

```sh
git tag -a v0.1.1 -m "Saywell v0.1.1"
git push origin v0.1.1
```

到 Actions 查看该标签的 workflow，确认两个 job 均成功，再验证 Releases 中的 `saywell-0.1.1.zip` 可下载。README 的 Actions 下载仍可用于未发布版本的测试，已发布版本优先从 [Releases](https://github.com/ider-zh/saywell/releases) 下载。自动生成的 Source code 压缩包不是可安装扩展。

发布中断可能留下草稿。不要自动删除草稿、重建标签或覆盖资产；先检查草稿对应提交和文件，再决定如何恢复。已发布 Release 的重新运行会拒绝重复创建，避免悄悄改变已交付的版本。

## Chrome Web Store 自动化的入口

Chrome 商店不在项目 Actions 中直接提供构建服务。自动化从 CI 调用 [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api)，后台用于关联账户、配置扩展和查看审查状态。

维护者需要准备：

1. 在 [Google Cloud Console](https://console.cloud.google.com/) 选择项目，启用 Chrome Web Store API，创建服务账号。
2. 在 Chrome Web Store Developer Dashboard 的 **Account** 区添加服务账号邮箱。当前官方文档说明每个发布者只能关联一个服务账号；如果已有配置，先核对，不覆盖。
3. 从 **Publisher → Settings** 取得 Publisher ID，并从扩展详情取得 Extension ID。发布者设置页 URL 不能替代扩展 ID。若尚无扩展条目，先在后台准备草稿及商店资料，仍不要提交审核。
4. 为 GitHub Actions 配置服务账号认证。优先使用受仓库、分支/标签和发布环境约束的 Workload Identity Federation / 短期凭据；如果采用长期 JSON key 或 OAuth refresh token，只存 GitHub 的受保护 Secrets，不发到聊天、不提交到源码。

[服务账号官方说明](https://developer.chrome.com/docs/webstore/service-accounts)包含 Google Cloud 与后台关联步骤。使用 API 前还要核对两步验证、商店文案与隐私表单。

**上传包与提交审核是不同 API 操作。** `items:upload` 更新包；`items:publish` 通常提交审核并在通过后按发布方式上线。`STAGED_PUBLISH` 仍然会提交审核，只是通过后等待发布，不能用来满足“暂不提交审核”。自动化不能绕过 Google 审查。

当前仓库未接入商店身份凭据、上传或 publish 操作；GitHub 标签发布不会触发商店审核，也不部署 Cloudflare。下一步接入需要维护者完成上述账号设置，再明确选择“仅上传草稿”还是“提交审核”。商店材料见 [中文提交材料](../store/submission.zh-CN.md)和[英文提交材料](../store/submission.en.md)。
