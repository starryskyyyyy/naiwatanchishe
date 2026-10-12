# 素材生成记录

工具：内置 imagegen。参考图：用户提供的黄色角色。所有图片均要求透明背景、单张正方形贴图。

蛇头提示：取参考角色的头部，保留大绿眼睛、黑瞳孔、小嘴与黄色圆润轮廓；仅头部，朝右，柔和3D玩具风格，禁止身体、四肢、文字和背景。

## body

Create ONE square transparent game sprite of a straight snake BODY segment. Solid plain golden yellow approximately #F4C542, no patterns, markings, scales, eyes or black areas. Smooth soft 3D toy style matching the attached yellow character head. A continuous horizontal tube connects the exact LEFT and RIGHT canvas edges, occupying the middle 70 percent of canvas height, with transparent space above and below. End cross sections must NOT be visible: the tube continues past left/right edges without rounded caps or seams. Consistent thickness from left to right, subtle soft highlight along upper surface and gentle yellow shading below. No ground, cast shadows, labels or other objects. TRUE transparent background. Single sprite only.

## corner

Create ONE square transparent game sprite of a curved snake BODY CORNER segment. Solid plain golden yellow approximately #F4C542, no markings, scales, eyes or black areas. Smooth soft 3D toy rendering matching the attached yellow character head. A thick continuous smooth 90 degree elbow tube connects LEFT canvas edge at vertical center to BOTTOM canvas edge at horizontal center. Tube diameter 70 percent of square canvas side. The tube continues outside both edges: no end caps, no visible cut cross sections. Leave remaining space transparent, especially upper right corner. Same yellow material everywhere, modest soft lighting from upper left. No ground, shadows outside silhouette, text or other objects. Single sprite only. TRUE transparent background.

## tail

Create ONE square transparent game sprite of a snake TAIL. Smooth soft 3D toy style matching the attached yellow character head. Tail is horizontal: connection to body at exact LEFT canvas edge, pointed tail tip near RIGHT canvas edge. At left the tube is centered vertically and 70 percent of canvas height in diameter, without visible end cap, connecting seamlessly to a yellow snake body. Smoothly taper to a rounded narrow tip pointing RIGHT. Color is bright golden yellow #F4C542 at left, gradually transitions through dark yellow/brown to near BLACK at the rightmost tip. One continuous smooth gradient, no stripes, markings, scales or eyes. Minimal padding, full tail tip visible. Modest lighting from upper left, no ground, cast shadow, labels or other objects. TRUE transparent background. Single isolated sprite only.

后续调整：加粗直线蛇身；要求转弯块的左侧和下侧连接口居中，以便在方格中拼接。
