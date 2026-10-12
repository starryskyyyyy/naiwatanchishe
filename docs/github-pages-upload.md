# 把贪吃蛇网页上传到 GitHub Pages

GitHub 是保存代码的平台，GitHub Pages 是它的静态网站托管功能，网址通常是 https://你的用户名.github.io/ 。之前参考的游戏地址属于其作者，不是你的站点；使用你自己的 GitHub 账号即可。

## 先理解发布范围

`snake-github-pages.zip` 是可上传的前端文件包，解压后包含 index.html、CSS、JavaScript 和 assets 图片目录。不要直接上传 ZIP；需要上传解压后的内容。

仅用 GitHub Pages 可以玩游戏、显示贴图、计算本局分数，但不能运行 Node.js 和 SQLite，所以现在的全站排行榜读取与成绩提交在 Pages 上不可用，可能提示请求错误。它们在本地 npm start 服务中仍然正常，排行榜后端没有删除，也没有改成本机榜单。

完整上线需要：GitHub Pages 托管前端，另一台支持 Node.js 24+ 和持久磁盘的服务运行 server.js；之后配置前端 API 地址、后端 HTTPS 和跨域请求规则。当前代码仍请求同站点 /api/...，直接上传后端文件到 Pages 不能解决这个问题。

## 用浏览器上传，不需要先学 Git 命令

1. 注册并登录 https://github.com/ ，确认自己的用户名，例如 myname。
2. 点击右上角 + → New repository，仓库名填 myname.github.io，必须把 myname 换成你的实际用户名。
3. 选择 Public，勾选 Add README，然后 Create repository。若该仓库已存在，直接打开它，保留原有文件并按需更新。
4. 在电脑上解压 D:\myweb\snake-github-pages.zip。打开解压目录，确认能直接看到 index.html。
5. 仓库页面点击 Add file → Upload files，把解压目录内的文件和 assets 文件夹拖进去。index.html 必须在仓库最外层，不要连同外层 publish 文件夹一起上传。写提交说明，例如“发布贪吃蛇网页”，然后提交更改。
6. 进入 Settings → Pages，Source 选择 Deploy from a branch，Branch 选择 main，目录选择 / (root)，点击 Save。
7. 等待发布完成，打开 Pages 页面显示的网址，通常是 https://myname.github.io/ 。GitHub 说明更改发布最多可能需要约10分钟。失败时查看仓库 Actions 中的运行记录。
8. 实际打开网页检查三种水果、方向控制、移动端布局。此阶段排行榜未连接后端，不能作为完整成绩保存验收。

若不想使用主页仓库，也可建立名为 snake-game 的公开仓库，同样操作后网址通常是 https://myname.github.io/snake-game/ 。当前图片和脚本使用相对路径，支持这种子目录地址。

## 以后更新

在本地修改后，更新发布包内的对应前端文件，再到仓库上传替换并提交。发布包是当前代码的快照，不会随源码修改自动更新。数据库、backend、server.js、测试、开发文档和预览截图都不需要上传到这个前端仓库。

## 官方资料

- https://docs.github.com/en/pages/quickstart
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
