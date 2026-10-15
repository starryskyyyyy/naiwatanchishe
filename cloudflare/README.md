# Cloudflare Workers + D1：最后三步

你的 Worker 地址：
https://fancy-meadow-3bf8naiwatanchishe-api.linstarryskyyy.workers.dev

目前该地址返回 Hello World!，表示 Worker 已创建，但尚未运行排行榜程序。

## 1. 在 D1 里建表

在 Cloudflare 控制台打开已绑定的 D1 数据库，进入 Console / 控制台，将本目录 schema.sql 的全部内容粘贴进去并执行。脚本只创建不存在的 scores 表和索引，不删除已有数据。

## 2. 确认绑定名称

打开你的 Worker → Bindings / 绑定，确认 D1 数据库的变量名为大写 DB，并选择刚刚建表的数据库。如果已有绑定名称不同，改成 DB；数据库本身的名称可以继续使用 naiwa-leaderboard。

## 3. 替换 Worker 代码并部署

打开 Worker → Edit code / 编辑代码。把默认 Hello World 代码全部替换成本目录 worker.mjs 的完整内容，点击 Deploy / 部署。

worker.mjs 是独立的 JavaScript 模块，没有外部依赖，可直接粘贴。默认允许来源 https://starryskyyyyy.github.io；不需要购买域名、服务器或填写任何前端密码。

## 部署后确认

打开下面两个地址：

- https://fancy-meadow-3bf8naiwatanchishe-api.linstarryskyyy.workers.dev/api/health
- https://fancy-meadow-3bf8naiwatanchishe-api.linstarryskyyy.workers.dev/api/leaderboard

第一个应返回 {"ok":true,"service":"naiwa-leaderboard"}。第二个在空榜时应返回 {"entries":[],"limit":20}。如果仍显示 Hello World!，说明新代码尚未部署；如果提示检查 DB，说明绑定变量名不正确；如果提示数据库尚未准备好，请检查是否在绑定的同一个数据库里执行了 schema.sql。

确认接口准备好后，在项目 config.js 将 apiBaseUrl 填为上面的 Worker 根地址，然后提交到 GitHub。当前没有提前启用前端地址，以免游戏请求仍是 Hello World 的接口。

## 保存规则

- 每一局独立保存，同昵称可以有多条入榜记录。
- 仅保留前20条；同分按提交先后排序。
- 低于或等于第20名门槛时不插入。更高成绩入榜时删除被挤出的旧记录。
- 检查、插入、淘汰在一个 D1 batch 事务中完成，避免并发时超过20条。
- 同一局 UUID 重试不会重复保存，改变已提交内容会被拒绝。
- 昵称1～20字符、分数0～397整数、正文最多2048字节。
- 每个 Worker 实例内限制同IP每分钟30次提交；不同边缘实例独立计数，此限流不是全局精确计数。分数由浏览器上报，目前没有完整防作弊。

## 验证范围

本地测试使用真实 SQLite 执行 Worker 的 SQL，并模拟 D1 原子 batch；覆盖60个并发请求、前20名、低分不插入、同分顺序、重试去重、参数校验与跨域。该测试不能代替部署后真实 D1 的检查，Cloudflare 上线后仍需验证接口和游戏提交。

官方 D1 batch 事务说明：https://developers.cloudflare.com/d1/worker-api/d1-database/
