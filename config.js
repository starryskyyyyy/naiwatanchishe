// GitHub Pages使用已部署的Cloudflare排行榜。本地运行仍使用本地数据库，
// 避免开发和自动测试写入正式榜单。这里只放公开地址，不放密码或令牌。
globalThis.SnakeConfig = {
  apiBaseUrl: location.hostname.endsWith('.github.io')
    ? 'https://fancy-meadow-3bf8naiwatanchishe-api.linstarryskyyy.workers.dev'
    : '',
};
