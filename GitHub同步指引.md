# GitHub 同步指引（在有网络的设备上执行）

> 背景：打包设备网络受限，GitHub 授权/推送无法在本机完成。本包内的 `v2` 上层目录已是**完整 git 仓库**（含首次提交，分支 `main`，127+ 文件，node_modules 已被 .gitignore 排除）。到有网络的设备后，按下面任一路线操作即可。

## 路线 A：命令行（推荐，5 分钟）

```bash
# 0) 进入仓库根（即本包解压后的文件夹，含 .git 的那一层）
cd <包根目录>

# 1) 配置你的身份（仅需一次）
git config user.name  "<你的GitHub用户名>"
git config user.email "<你的GitHub邮箱>"

# 2) 可选：把首次提交的作者改为你的身份
git commit --amend --reset-author --no-edit

# 3) 在 github.com 网页上新建空仓库
#    右上角 + → New repository → 名称建议 zhiyuan-workbench
#    → 选 Private（私有，推荐）→ 不要勾选任何初始化选项（README/.gitignore/License 都不要）

# 4) 关联远程并推送（推送时浏览器会弹出 GitHub 登录，授权即可）
git remote add origin https://github.com/<你的GitHub用户名>/zhiyuan-workbench.git
git push -u origin main
```

> 推送认证说明：Windows 上推送时 Git Credential Manager 会自动弹出浏览器完成登录，令牌存入凭据管理器，之后 push/pull 免登录。若设备没有弹窗，安装 [GitHub CLI](https://cli.github.com) 后执行 `gh auth login` 再推。

## 路线 B：GitHub Desktop（纯图形界面）

1. 安装 [GitHub Desktop](https://desktop.github.com) 并登录
2. File → Add local repository → 选择本包根目录（含 .git）
3. Repository → Push——若提示无远程：GitHub Desktop 可直接 File → New repository 时选择 Publish，或先在网页建仓再 Repository → Repository settings → Remote 填入地址后 Push

## 之后的日常同步（任何设备）

```bash
git pull --rebase           # 开始工作前
# ……正常迭代（遵守《打包迁移说明》第四节开发铁律）……
git add -A && git commit -m "feat: 第XX轮 <内容>"
git push                    # 结束工作后
```

多设备协作注意：

- **node_modules 不入库**：新设备克隆后先 `cd v2 && npm install`
- **dist 已入库**：仓库携带 V2.8.2 可直接加载的成品；每次发新版随提交一起更新（`npm run build` 后 `git add -A` 会自然包含）
- 版本号唯一来源 `v2/src/manifest.ts`；发版时同步 `package.json`、关于页、手册页版本号与回归断言
