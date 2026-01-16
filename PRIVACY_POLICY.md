# 隐私权政策部署说明

## 重要提示

扩展程序商店要求隐私权政策必须托管在一个可公开访问的网站上，不能只是项目文件夹中的文件。

## 部署步骤

### 方法 1：使用 GitHub Pages（推荐）

1. **将项目推送到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/X_Translator.git
   git push -u origin main
   ```

2. **启用 GitHub Pages**
   - 进入 GitHub 仓库设置
   - 找到 "Pages" 选项
   - 选择 "Source" 为 "main" 分支
   - 选择 "/ (root)" 文件夹
   - 点击 "Save"

3. **更新 manifest.json**
   - 将 `privacy_policy` 字段更新为：
     ```json
     "privacy_policy": "https://your-username.github.io/X_Translator/privacy-policy.html"
     ```
   - 将 `homepage_url` 也更新为你的 GitHub 仓库地址

4. **访问验证**
   - 等待几分钟后，访问 `https://your-username.github.io/X_Translator/privacy-policy.html`
   - 确认页面可以正常访问

### 方法 2：使用其他托管服务

你也可以使用其他静态网站托管服务：
- Netlify
- Vercel
- Cloudflare Pages
- 你自己的网站

只需将 `privacy-policy.html` 上传到你的网站，然后更新 `manifest.json` 中的链接。

### 方法 3：使用项目网站

如果你有自己的项目网站，可以将隐私权政策页面放在那里。

## 注意事项

1. **链接必须是 HTTPS**：扩展程序商店要求隐私权政策链接必须是 HTTPS
2. **必须可公开访问**：不能是本地文件或需要登录才能访问的页面
3. **直接链接**：链接必须直接指向隐私权政策页面，不能是重定向
4. **更新 manifest.json**：部署后记得更新 `manifest.json` 中的 `privacy_policy` 字段

## 当前配置

在部署之前，`manifest.json` 中的 `privacy_policy` 字段需要更新为你的实际 URL。

请将以下内容替换为你的实际 URL：
- `https://your-username.github.io/X_Translator/privacy-policy.html`

## 验证清单

提交到商店前，请确认：
- [ ] 隐私权政策页面可以公开访问
- [ ] 链接使用 HTTPS
- [ ] manifest.json 中的 privacy_policy 字段已更新
- [ ] 隐私权政策内容完整且准确
- [ ] 页面在移动设备上也能正常显示
