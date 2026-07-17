# Agent Verification

本文件定义不同类型改动的验证方式。目标是让“做完了”变成可检查结论。

## 验证矩阵

| 改动类型 | 最小验证 | 追加验证 |
|---|---|---|
| 文案或小样式 | 检查受影响页面显示 | 检查内容来源是否可靠 |
| TS/TSX 逻辑 | `npm run build` | 针对改动路径做交互检查 |
| 组件、hooks、路由、共享工具 | `npm run build` + `npm run lint` | 检查调用页面 |
| 视觉改动 | 桌面和移动端布局检查 | 截图或浏览器测量 |
| `ChinaTripsMobile` | 320px、375px、390px | 检查横向溢出、按钮触控、文字裁切 |
| 路由或导航 | hash 路由跳转、刷新、返回顶部 | 检查导航和页脚入口 |
| 内容、图片、路线数据 | 查 `docs/content-resource-map.md` | 对照 `CONTEXT.md` 业务语言 |
| 文档改动 | UTF-8 读取确认格式 | 检查链接和范围声明 |

## 常用命令

在 `app/` 目录执行：

```bash
npm run build
npm run lint
npm run preview
```

## 移动端检查

`ChinaTripsMobile` 或移动端视觉改动至少检查：

- 320px
- 375px
- 390px

重点：

- `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
- 标题、按钮、标签不裁切。
- 图片裁切符合设计意图。
- 底部导航和安全区不遮挡内容。

## 不能验证时

最终回复必须说明：

- 没验证什么。
- 为什么没验证。
- 剩余风险是什么。
- 用户或下一个 Agent 应该如何补验。

## 自动化候选

后续可以把稳定、低歧义的检查脚本化：

- build 检查。
- lint 检查。
- 横向溢出检查。
- 移动端宽度检查。
- 关键页面截图检查。
- 路由链接检查。
