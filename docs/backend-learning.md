# 从浏览器到数据库：这次增加了什么

以前，页面上的分数只是浏览器中的一个变量，关闭页面就会消失。现在，浏览器可以把一局的成绩交给一直运行的Node.js程序，由它写进SQLite数据库。

当前游戏是贪吃蛇：每吃一个水果得1分，后端接受0～397的整数，成绩文件是data/snake.sqlite。

## 先亲眼看到请求

1. 在项目目录运行 `npm start`，浏览器打开 `http://localhost:3000`。
2. 按F12，打开开发者工具的“网络 / Network”标签。
3. 刷新排行榜，会看到 `GET /api/leaderboard`：浏览器向服务器索取数据。
4. 玩到结束，填写昵称并提交，会看到 `POST /api/scores`：浏览器把昵称、分数和本局UUID放在JSON正文里发给服务器。
5. 点击这个请求查看“响应 / Response”。`qualified`表示是否入榜，`rank`是当前排名，`entries`是更新后的榜单。

网页显示和数据库存储是两个不同动作。页面说“已保存”，必须建立在服务器已经成功返回结果的基础上。

## 顺着一次提交读代码

打开 `leaderboard.js`，从表单的 `submit` 事件开始读：

```js
fetch('/api/scores', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ submissionId, nickname, score })
});
```

这是解释流程的简化示例，实际代码还处理超时、失败重试和旧局请求。`JSON.stringify()`把JavaScript对象变成可以传输的文字；服务器再用`JSON.parse()`还原。

然后打开 `server.js`，寻找 `pathname === '/api/scores'`。这个分支检查提交频率和JSON正文，再调用 `board.submit()`。

最后打开 `backend/leaderboard.cjs`，阅读 `submit()`：

1. 检查昵称、分数、本局UUID，拒绝非法内容。
2. 开启事务：可以理解为“这一组数据库操作，要么一起完成，要么全部撤回”。
3. 查询本局是否已经保存。若已经保存，返回现有结果，避免网络重试产生重复成绩。
4. 查询第20名。新成绩不足以入榜时，直接返回，没有写入动作。
5. 能入榜时插入成绩，再删除20名以外的记录。
6. 提交事务，返回新榜单。

事务很重要：如果两位玩家几乎同时提交，不能都按同一份旧榜单判断后各自插入，最后留下21条。SQLite写事 务会把这段操作串起来。

## 为什么SQL里使用问号

```js
db.prepare('SELECT id FROM scores WHERE submission_id=?').get(submissionId);
```

问号是参数的位置，参数和SQL语句分开传入。用户输入的内容会作为数据处理，避免被误当成数据库命令。页面渲染昵称使用`textContent`也是同样的思路：昵称作为文字显示，不作为HTML执行。

## 你可以做的三个练习

- 打开 `/api/leaderboard`，比较JSON中的排名和页面显示是否一致。
- 用同一个昵称玩两局并提交，观察两局可以分别入榜，昵称不等于账号。
- 停止服务器再运行 `npm start`，确认榜单没有消失。游戏分数在浏览器内存里，榜单在数据库文件里，这就是它们生命周期的区别。

当前是本机后端。发布互联网时，需要让Node.js在服务器上持续运行，并为SQLite提供不会因重新部署而丢失的存储目录。
