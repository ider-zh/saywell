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
3. 从 **Publisher → Settings** 取得 Publisher ID，并从扩展详情取得 Extension ID。发布者设置页 URL 不能替代扩展 ID。若尚无扩展条目，先在后台准备草稿及商店资料，完成身份验证和资料核对后按维护者的发布授权提交。
4. 为 GitHub Actions 配置服务账号认证。优先使用受仓库、分支/标签和发布环境约束的 Workload Identity Federation / 短期凭据；如果采用长期 JSON key 或 OAuth refresh token，只存 GitHub 的受保护 Secrets，不发到聊天、不提交到源码。

[服务账号官方说明](https://developer.chrome.com/docs/webstore/service-accounts)包含 Google Cloud 与后台关联步骤。使用 API 前还要核对两步验证、商店文案与隐私表单。

**上传包与提交审核是不同 API 操作。** `items:upload` 更新包；`items:publish` 通常提交审核并在通过后按发布方式上线。`STAGED_PUBLISH` 仍然会提交审核，只是通过后等待发布，不能用来满足“暂不提交审核”。自动化不能绕过 Google 审查。

维护者于 2026-10-22 明确要求自动发布 Chrome 商店，仓库已准备独立的 `chrome-store.yml`。普通 main/PR 构建不会上传；当仓库变量 `CWS_ENABLED=true` 且版本标签的完整构建与 GitHub Release 成功后，调用独立商店流程。它核对同次 ZIP 的 SHA-256/manifest，查询当前版本和待审状态，上传并等待处理成功，再用 `DEFAULT_PUBLISH`、`skipReview:false`、`blockOnWarnings:true` 提交审核。审核通过后由 Google 发布；CI 返回等待审核不能被称为已经上线。

手动运行 **Chrome Web Store delivery** 只检查账号/扩展状态，不上传和提交，用于验证接入。Google auth Action 使用 WIF 生成 600 秒访问令牌，不创建 JSON 密钥或凭据文件。身份授权只授予服务账号的 Workload Identity User，不授予项目 Owner/Editor；身份提供方应限定 GitHub owner ID `9734108`、repository ID `1426643821`、本仓库可信工作流及 main/版本标签，拒绝其他仓库和 PR。自动化使用 GitHub Environment `chrome-web-store`；不要为不可信分支开放发布。

需在 GitHub Repository / Environment Variables 设置以下非密钥配置：

| 变量 | 内容 |
| --- | --- |
| `CWS_SERVICE_ACCOUNT` | `saywell@ider-01.iam.gserviceaccount.com` |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | `projects/92552286779/locations/global/workloadIdentityPools/saywell-github/providers/github-actions` |
| `CWS_PUBLISHER_ID` | `9d6a0fe8-8300-4796-a4ab-443193dd814d` |
| `CWS_EXTENSION_ID` | `ofofhnaikohfnbgbckghgccobafkfeig` |
| `CWS_ENABLED` | 已完成只读认证验证并设为 `true`；关闭标签自动提交时改为 `false` |

当前接入状态：上述五项参数已在 GitHub 保存，商店服务账号、限定 WIF 信任和仓库身份连接已在维护者确认后完成，联系邮箱已验证，Chrome Web Store API 已启用。[只读认证检查 39766610592](https://github.com/ider-zh/saywell/actions/runs/39766610592) 实际通过了短期令牌交换与扩展状态读取。商店已接受 0.1.0 草稿；中英说明、三张截图、图标、宣传图、隐私声明及审核说明已保存，分发为免费、公开、所有地区。首次 API 交付使用 0.1.1，审核和上线结果以该标签流水线及[商店状态页](https://chrome.google.com/webstore/devconsole/9d6a0fe8-8300-4796-a4ab-443193dd814d/ofofhnaikohfnbgbckghgccobafkfeig/edit/status)为准。

服务账号的 Workload Identity User 成员限定为 `principalSet://iam.googleapis.com/projects/92552286779/locations/global/workloadIdentityPools/saywell-github/attribute.repository_id/1426643821`。提供方使用 GitHub issuer `https://token.actions.githubusercontent.com`，默认 audience，映射 `google.subject=assertion.sub` 和 `attribute.repository_id=assertion.repository_id`，并使用以下 CEL 条件：

```text
assertion.repository_id == '1426643821' && assertion.repository_owner_id == '9734108' && (assertion.ref == 'refs/heads/main' || assertion.ref.startsWith('refs/tags/v')) && (assertion.workflow_ref.startsWith('ider-zh/saywell/.github/workflows/build.yml@') || assertion.workflow_ref.startsWith('ider-zh/saywell/.github/workflows/chrome-store.yml@'))
```

项目数字编号是 `92552286779`，不要用服务账号 Unique ID 代替。草稿已经上传的版本不能通过 API 作为新包重复上传；增加经过验证的新版本后走标签流程，不能覆盖同版本安装包。已有其他待审版本时流程会停止，不自动撤回审核。

不部署 Cloudflare。商店材料见 [中文提交材料](../store/submission.zh-CN.md)和[英文提交材料](../store/submission.en.md)。
