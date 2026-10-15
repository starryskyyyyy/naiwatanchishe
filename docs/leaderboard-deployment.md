# GitHub Pages 与全站排行榜

游戏页面：https://starryskyyyyy.github.io/naiwatanchishe/

当前生产环境使用 Cloudflare Workers + D1，已连接上述游戏页面，无需购买或维护自己的服务器。控制台部署与后续迁移步骤见 [Cloudflare说明](../cloudflare/README.md)。下面的 Node.js + 持久磁盘方案保留作为可选替代方案。

## 这次修正

- 上传自动放大的棋盘布局及响应式画布分辨率。
- 恢复贪吃蛇入口页面，给修改的样式和脚本添加版本参数，防止继续读旧缓存。
- 新增公开配置 config.js，可以把排行榜请求发送给独立后端。
- 后端支持允许来源的跨域请求和 OPTIONS 预检，新增 /api/health 健康检查。
- GitHub Pages 尚未填写后端地址时，显示“排行榜服务尚未连接”，不再向不存在的 Pages API 请求成绩。

## 仍需一个后端服务

GitHub Pages 不运行 Node.js，上传 server.js 不会启动服务。需要服务器或支持 Node.js 24+ 的托管平台，并为 SQLite 挂载持久磁盘。没有运行中的后端网址时，无法在互联网上保存全站成绩。游戏本身仍可正常游玩。

服务端环境变量：

| 名称 | 值 |
| --- | --- |
| HOST | 0.0.0.0 |
| PORT | 使用托管平台提供的端口；自己部署可用3000 |
| DATA_DIR | 持久磁盘内的目录，例如 /data |
| ALLOWED_ORIGINS | https://starryskyyyyy.github.io |

ALLOWED_ORIGINS 填来源，不包含 /naiwatanchishe/ 路径，也不要在末尾加斜杠。多个来源用逗号分隔。数据库保存在 DATA_DIR/snake.sqlite，不能仅放临时文件系统。

仓库已提供 Dockerfile，可用于支持容器和持久卷的服务器：

```sh
docker build -t naiwa-snake .
docker run -d --name naiwa-snake --restart unless-stopped \
  -p 3000:3000 -v naiwa-snake-data:/data \
  -e ALLOWED_ORIGINS=https://starryskyyyyy.github.io naiwa-snake
```

此命令用于装有 Docker 的服务器，不是在 GitHub Pages 中执行。公开访问还需要平台提供的 HTTPS 域名，或自行配置 HTTPS 反向代理。当前 Windows 环境未构建 Docker 镜像；Node.js 后端和跨域请求已通过测试。

也可以在 Render 等支持 Node.js 的平台关联此仓库，使用 Node.js 24、启动命令 npm start，并设置上面的环境变量和持久磁盘。Render 的持久磁盘需付费服务，创建前确认费用；免费临时磁盘不能可靠保留 SQLite 榜单。本文没有创建任何付费资源。

## 接上前端

1. 后端启动后，访问 https://你的后端域名/api/health，应该返回 {"ok":true}。
2. 修改 config.js：

```js
globalThis.SnakeConfig = { apiBaseUrl: 'https://你的后端域名' };
```

3. 提交并 push 到 main，等待 GitHub Pages 部署完成。
4. 在游戏中结束一局、填写昵称提交，在另一个浏览器读取排行榜验证共享成绩。只保留前20名，低于榜单门槛的成绩不会写入。

只在 config.js 填公开的服务网址；密码、平台令牌和数据库凭据不要放前端。分数由客户端上报，格式校验和重试去重并不是完整防作弊。

## 官方文档

- GitHub Pages 限制：https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- Render Node.js 部署：https://render.com/docs/deploy-node-express-app
- Render 持久磁盘：https://render.com/docs/disks
