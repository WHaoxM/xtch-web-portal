# Admin 侧栏分组中文化设计

日期：2026-07-17  
状态：已落地  
计划：`.cursor/plans/admin_侧栏分组中文化_62ef59a7.plan.md`

## 问题

整页编辑壳落地后，运营仍反映「不知道该干哪些」——侧栏七项扁平，交易与内容混在一起。公网面向外国人保持英文；管理端面向中文运营，侧栏可用中文。

## 决策

- **做**：侧栏切成「交易 / 产品内容 / 配置」三组，始终全部展开；组名 + 七个入口 + 当前页标题改中文；默认仍为订单（`orders`）；桌面侧栏与移动抽屉共用 `AdminNav`。
- **不做**：Panel 表单字段/按钮/报错中文化；询盘列表；URL 深链；可折叠分组。

## 信息架构

```text
交易
  订单          orders
  班期          departures

产品内容
  目的地        destinations
  路线          routes
  分类          categories
  素材          media

配置
  定制行程表单  custom-trip-form
```

`value`（tab id）保持英文；只改展示 `label` 与分组。

## 实现

文件：`app/src/pages/Admin.tsx`

1. `ADMIN_NAV_GROUPS` 为唯一导航数据源；派生 `AdminNavItem` / `AdminTab` / 扁平 `ADMIN_NAV_ITEMS`
2. `AdminNav` 按组渲染：小号 muted 组标题 + 既有 button 样式
3. 壳层 `activeLabel` 仍从 `ADMIN_NAV_ITEMS.find(...).label` 取，自动中文

## 下一优先（未做）

- 「交易」组增加「询盘」入口 + 列表/详情
- 更后：表单层中文化（若运营仍卡术语）
