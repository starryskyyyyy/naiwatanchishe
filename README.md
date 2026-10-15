# naiwatanchishe
只是个奶娃贪吃蛇
用了codex闲的没事干做了一个
棋盘现在随窗口放大，苹果、梨和桃子随机出现，每个水果加1分。

GitHub Pages 运行游戏前端，排行榜已连接 Cloudflare Workers + D1。`config.js` 配置公开接口地址；只保存全站前20名，同昵称可保存多局，未入榜成绩不写入。

本地运行使用本地 Node.js + SQLite 排行榜，开发测试不会写入正式云端榜单。

本地运行：`npm start`；测试：`npm test` 和 `npm run test:browser`。

完整上线步骤见 [排行榜后端部署说明](docs/leaderboard-deployment.md)。

已创建 Cloudflare Worker 和 D1 的话，按 [Cloudflare最后三步](cloudflare/README.md) 部署即可，不必运行自己的 Node.js 服务器。
