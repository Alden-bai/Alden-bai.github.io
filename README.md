# 布吉熊的小窝

个人学习主页与 Markdown 笔记站，使用 VitePress 1.6.4。目标地址：<https://alden-bai.github.io/>。

保留 VitePress 稳定版，同时将构建依赖 Vite 和 xmldom 固定到包含安全修复的版本；依赖锁定在 `package-lock.json`。

## 本地预览

需要 Node.js 22 或更新版本。在本目录打开终端：

```sh
npm ci
npm run dev
```

生产构建与预览：

```sh
npm run build
npm run preview
```

打开终端显示的本地地址。添加或重命名笔记后，重启开发服务以刷新侧边栏；正式构建会自动重新扫描。

## 添加笔记

1. 在 `docs/notes/` 中添加 UTF-8 编码的 `.md` 文件（扩展名使用小写），例如 `first-note.md`。支持子目录，无需修改导航配置。
2. 用一个一级标题作为笔记标题；没有一级标题时使用文件名。
3. 提交并推送到 `main`，GitHub Actions 会自动发布。列表按标题排序，不依赖日期或分类。

示例（仅用于说明，不会作为文章发布）：

````md
# 我的第一篇学习笔记

## 核心概念

在这里写自己的理解。

行内公式：$E = mc^2$。

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$

## 代码示例

```python
print("保持好奇")
```
````

`docs/notes/index.md` 是笔记列表入口，请保留。导航和列表共用 `.vitepress/note-index.mjs`。标题中的常见 Markdown 标记会被去掉；文件路径可使用中文或空格，推荐用简短英文文件名，便于分享链接。

## 插入图片与链接

把图片放在笔记旁边的 `images` 子目录，用相对路径引用：

```md
![示意图的文字说明](./images/example.png)
[另一篇笔记](./another-note.md)
```

也可以把公共图片放在 `docs/public/images/`，用 `/images/文件名.png` 引用。不要直接链接电脑上的绝对路径。普通文字中包含 `<`、`>` 或 `{{ }}` 时，使用行内代码包裹，避免被当作 HTML/Vue 模板。

## GitHub Pages 发布

1. GitHub 仓库名称必须为 `Alden-bai.github.io`（从原 `bjx.github.io` 改名），对应账号根地址。
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 本目录作为独立 Git 仓库，远程地址为 `https://github.com/Alden-bai/Alden-bai.github.io.git`。
4. 推送 `main` 后，在 **Actions** 查看部署结果；成功后访问 <https://alden-bai.github.io/>。

工作流位于 `.github/workflows/deploy.yml`，支持手动运行。仅上传 `docs/.vitepress/dist` 静态产物。失败时线上仍保留上一次成功版本；修复后重新推送即可。

## 内容边界

只有放入本项目的内容会进入网站仓库。父目录的现有学习笔记不会被复制、读取或发布；上传笔记需另行决定。本站公开访问，不包含后台、评论、统计或上传功能。暂未为个人笔记授予开源许可证。
