# Agent Workflows

给 Agent 和新 Agent 使用的最小工作流。目标是少读错、少改多、能验证。

## 通用流程

1. 明确任务类型和成功标准。
2. 读取 `AGENTS.md` 和 `docs/agent-context.md`。
3. 只读取任务相关的页面、组件、数据源和专门文档。
4. 列出假设；不确定就问。
5. 用最小改动实现。
6. 按风险验证。
7. 最终回复说明改了什么、依据是什么、验证了什么、还有什么没验证。

## 改页面或组件

1. 找到页面路由：`app/src/App.tsx`。
2. 找到页面文件：`app/src/pages/`。
3. 找到相关共享组件：`app/src/components/`。
4. 找到数据来源：通常在 `app/src/lib/` 或专门文档里。
5. 改动前确认内容来源，必要时读 `docs/content-resource-map.md`。
6. 视觉改动后检查桌面和移动端。

## 改路由或导航

1. 先读 `app/src/main.tsx` 和 `app/src/App.tsx`。
2. 导航入口通常在 `app/src/components/Navbar.tsx`。
3. 页脚入口通常在 `app/src/components/Footer.tsx`。
4. 当前使用 `HashRouter`，内部链接要兼容 hash 路由。
5. 验证页面跳转、刷新和返回顶部行为。

## 改内容、图片或路线数据

1. 先读 `docs/content-resource-map.md`。
2. 业务词汇先对照 `CONTEXT.md`。
3. 路线事实不要从文件名或参考站点猜。
4. TOCN 只能作为结构和交互参考，不能当作 Syncing 事实来源。
5. 缺证据时标注不确定，不要编造。

## 改 China Trips Mobile

1. 先读 `docs/mobile-ios-front-end-context.md`。
2. 找到 `app/src/components/ChinaTripsMobile.tsx` 和 `app/src/components/chinaTripsMobile.css`。
3. 保持 iOS mini app 的产品流，不要改成普通长网页。
4. 验证 320px、375px、390px。
5. 检查是否有横向溢出、文字裁切、按钮过小和图片裁切。

## 修 bug

1. 先复现或定位触发条件。
2. 判断是页面、组件、数据、路由、样式还是接口问题。
3. 只改直接相关代码。
4. 清理本次改动造成的未使用代码。
5. 用能覆盖该 bug 的方式验证。

## 启动本地开发服务器

1. 本地 Vite 固定端口 `3000`（`app/vite.config.ts`，`strictPort: true`），URL 为 `http://127.0.0.1:3000`。生产 `deploy:serve` 固定默认 `3080`，可同机并行。
2. 若已有健康的 `3000` 服务，直接复用，不要再开第二个。
3. 必须新开时：在 `app/` 执行 `npm run dev`（会先释放占用 `3000` 的进程，再启动 Vite；不碰 `3080`）。
4. 不要接受或记录 Vite 的 `3001`/`3002` 等备用端口；端口被占且无法释放时，先查占用再处理，不要改 Vite 端口。
5. 仅在明确要保留现有监听时使用 `npm run dev:keep`。

## 写文档

1. 先确认读者、用途和边界。
2. 先写最小结构，不写大而全。
3. 链接到源头文档，不重复复制长内容。
4. 标注假设和未确认信息。
5. 文档要让下一个 Agent 知道下一步去哪里查、怎么判断、怎么行动。
