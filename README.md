# WebCraft · 网页版 Minecraft 1.12 风格（原创克隆）

从零构建的网页体素游戏：Vite + TypeScript + Three.js，程序化生成原创像素贴图（不含 Mojang 版权素材），
固定 256×256 世界，WebRTC 点对点联机（PeerJS 信令，房主权威），房主浏览器 localStorage 存档，纯静态部署到 Netlify。

## 功能（v1 创造模式 MVP）
- 确定性地形生成（山丘/海洋/沙滩/橡树），256×256×128 固定世界
- 创造模式飞行、放置/破坏方块、9 格热栏 + E 方块选择器
- WebRTC 点对点联机：建房（5 位房间码）或输入房间码加入，实时同步方块与玩家位置，聊天
- 房主本地存档：方块修改自动保存到浏览器 localStorage，重新建房可选载入

## 本地开发
```bash
pnpm install      # 依赖安装在项目内（node_modules 位于本项目，不占 C 盘）
pnpm dev          # 开发服务器
pnpm test         # vitest 单元测试
pnpm build        # 类型检查 + 产物到 dist/
pnpm preview      # 本地预览构建产物
```

## 部署到 Netlify（云端，不依赖你的电脑）
方案 A（推荐）：推送到 GitHub 后，在 Netlify 中 Import 该仓库：
- Build command: `pnpm build`
- Publish directory: `dist`
- `netlify.toml` 已配置好，含 SPA 回退

方案 B：本地执行 `pnpm build` 后，到 [app.netlify.com/drop](https://app.netlify.com/drop) 拖拽 `dist` 文件夹上传。

部署完成后：任何人打开你的 Netlify 网址即可访问游戏；你关机不影响网站与联机
（联机走 PeerJS 公共信令 + 玩家浏览器直连，只要有一个玩家在线建房即可）。

## 联机架构说明
- 星型拓扑：所有玩家直连房主，房主权威处理方块修改并转发
- 世界确定性生成：同 seed 每个玩家本地生成相同地形，联机只同步“修改”
- 存档在房主浏览器 localStorage；换房主即换存档（v1 不做云端存档/房主迁移）
- 严格 NAT 环境可能无法直连（v1 不接自建 TURN）

## 素材与版权
- 方块贴图：Minetest Game 默认贴图（[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)，© Minetest 贡献者），未修改使用，仅作属性署名；加载失败时自动回退到内置程序化贴图。
- 不含 Mojang/Minecraft 版权素材。
- 代码：本项目 MIT。

## 目录结构
```
src/world/    区块/地形/噪声/diff 编解码/存档
src/render/   程序化贴图/区块网格/渲染器
src/player/   控制/方块交互/远端玩家
src/net/      协议/房主/客户端
src/ui/       主菜单/HUD/聊天
src/game.ts   游戏编排与主循环
tests/        vitest 单元测试
```