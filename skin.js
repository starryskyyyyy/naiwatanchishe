// 透明贴图按移动方向自动旋转；加载失败时继续显示几何占位。
globalThis.SnakeSkin = {
  head: 'assets/head.png?v=2',
  body: 'assets/body.png?v=2',
  corner: 'assets/corner.png?v=2',
  tail: 'assets/tail.png?v=2',
  apple: 'assets/apple.png',
  pear: 'assets/pear.png',
  peach: 'assets/peach.png',
};

// 图片内的连接口不一定居中。分段缩放把它们对齐到格子的25%～75%。
// 数字是原图像素位置除以图片尺寸；保留眼睛、嘴和尾巴的原始内容。
globalThis.SnakeSkinLayout = {
  head: { y: [0, 308/1254, 927/1254, 1] },
  body: { y: [0, 366/1254, 888/1254, 1] },
  tail: { y: [0, 297/1254, 946/1254, 1] },
  corner: {
    x: [0, 489/1254, 1026/1254, 1],
    y: [0, 267/1254, 812/1254, 1247/1254],
  },
};
