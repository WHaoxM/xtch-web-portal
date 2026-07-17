# Admin 整页编辑壳设计

日期：2026-07-17  
状态：已落地  
计划：`.cursor/plans/admin_整页编辑壳_ba67ce98.plan.md`

## 问题

Admin 六个内容模块（Departures / Destinations / Routes / Categories / Media / Custom trip form）点 Edit/New 后，表单追加在列表下方。长表单（尤其 Routes）需要滚动很久才能看到，运营体验差。

Orders 已是正确模式：详情与列表互斥渲染，带「Back to list」。

## 决策

采用方案 2：共享 `AdminEditShell` + 各 Panel 互斥渲染。

- **做**：Edit / New 时整页只显示表单；顶部统一「← Back to list + 标题」；进入时 `window.scrollTo(0, 0)`。
- **不做**：URL 深链 / 路由（保持 `#/admin`）；不拆分 `Admin.tsx`；不加脏数据离开确认（与现有 Cancel 一致）。

## 实现

文件：`app/src/pages/Admin.tsx`

1. 内部组件 `AdminEditShell({ title, onBack, children })`
2. 六个 Panel：`if (editing) return <AdminEditShell>…表单…</AdminEditShell>`，否则返回列表
3. Categories 标题带 scope：`Edit destination category: …` / `New route category`
4. Media 编辑态保留 status 提示（上传成功文案）
5. Orders 未改（已有互斥模式）

## 行为约定

- Back / Cancel：放弃草稿，回列表（无确认）
- 保存成功：现有逻辑 `setEditing(null)` 回列表；status 消息仍在列表顶可见
- 保存失败：error 在编辑壳内可见，留在表单页

## 验证

- `app/` 下 `npm run build`、`npm run lint` 通过
- 浏览器：Destinations Edit/New/Back；Routes Edit（长表单顶部可见）；Categories New（标题含 scope）；375px 抽屉导航下 Destinations Edit/Back
