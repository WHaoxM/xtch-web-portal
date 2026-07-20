# 子代理角色：前端关键流程

> 发放要求：必须同时提供本目录 `README.md`。本任务不授权部署、访问真实生产数据、修改真实 env 或推送代码。跨出 `Owns` 前必须提交 Blocking Request。

## 任务目标

修复 BrowserRouter 导航和支付取消回流的确定性故障，并处理两个直接影响键盘用户的交互问题。不得借此重做视觉或产品流程。

## 文件边界

**Owns**

- `app/src/pages/DestinationDetail.tsx`
- `app/src/components/Navbar.tsx`：仅搜索结果导航和移动菜单可访问性
- `app/src/components/ChinaTripsMobile.tsx`：仅 Checkout 返回处理与草稿恢复
- `app/src/pages/Account.tsx`：仅订单卡片交互语义
- 与上述行为直接对应的新测试

**May Touch**

- `app/src/lib/checkoutClient.ts`
- `app/src/lib/hashLegacyRedirect.ts`：仅补充兼容测试，不新增旧 hash 链接
- `app/src/components/chinaTripsMobile.css`：仅恢复提示或可访问性所需最小样式

**Must Not Touch**

- 支付后端、订单状态、SEO 预渲染
- Navbar 断点、视觉方向、About/Home 其他区域
- 新依赖或新的账户强制登录流程

## 必修问题

### 1. BrowserRouter 下仍生成旧 Hash 内链

`DestinationDetail` 路线卡和 Navbar 搜索结果会生成 `#/tours/...` 等链接。当前应用使用 BrowserRouter，点击仅改变 hash 时可能不触发 pathname 路由。

完成要求：

- 所有应用内导航统一使用 React Router `Link` / `navigate` 或无 `#` 的 path。
- 静态资源和 PDF 外链继续按普通 `<a>` 处理。
- 保留开机时对旧书签的迁移兼容，但禁止新 UI 继续生成旧 hash URL。
- 全仓搜索确认不再有业务代码拼接 `#${internalPath}`。

### 2. Stripe 取消返回丢失预订上下文

当前只处理 `checkout=success`。访客取消 Stripe 后回到 Mini-App 首页，没有取消提示，已填写的旅客、日期和联系方式也未恢复。

完成要求：

- 实现前列出拟保存字段并请求用户确认：默认只允许 `sessionStorage`、TTL 不超过 30 分钟，禁止 `localStorage`、卡数据、access token、订单访问 token 和服务端 secret。
- 若用户不批准暂存姓名、邮箱、电话等个人信息，只恢复非敏感行程选择，并让用户重新填写个人信息；子代理不得自行放宽隐私边界。
- 经确认后，跳转 Stripe 前保存最小必要、短期有效的本地草稿。
- 处理 `checkout=cancelled`，清理 URL 参数，恢复到确认/审核步骤并显示清晰提示。
- 成功、取消、过期或用户主动放弃后按规则清理草稿。
- 草稿不得保存支付卡数据、access token 或其他敏感凭据。
- 多次刷新和浏览器返回不得重复弹提示或进入错误状态。

### 3. 订单卡片无法键盘操作

`Account` 中订单 Card 只有 `onClick`，不具备链接或按钮语义。

完成要求：

- 优先改成真实 `Link`；若确实不能，则提供完整 button 语义、焦点样式和 Enter/Space 操作。
- 鼠标、键盘和屏幕阅读器获得一致行为。

### 4. 关闭的移动菜单仍可聚焦

当前菜单关闭时仅位移并设置 `aria-hidden`，子链接仍可能进入 Tab 顺序。

完成要求：

- 关闭时不渲染或使用可靠的 `inert`/焦点管理。
- 打开后焦点进入菜单，关闭后回到触发按钮。
- Escape 可关闭；不得让焦点停留在屏幕外元素。

## 非阻断优化

首屏 bundle 当前包含低频页面和 Admin。若不改变已有行为，可按路由做懒加载；如范围明显扩大，单独提交建议，不与上述 P1 修复混在一起。

## 验收

- 目的地路线卡、桌面和移动搜索结果均进入正确 pathname。
- 旧 `#/...` 书签仍能迁移一次，但新链接不再生成 hash。
- Stripe cancel 返回恢复草稿、显示提示并清理查询参数。
- 成功返回不读取过期/错误草稿。
- 键盘可操作订单卡和移动菜单。
- 检查桌面、320px、375px 和 390px，不得引入横向溢出或 Mini-App 产品流变化。

执行并记录：

```text
npm run typecheck
npm run lint
npm run build
相关组件测试
浏览器手工或自动化回归
```

## 完成定义

- 四项行为均有可复现验证结果。
- 未修改支付后端、产品文案或视觉方向。
- 新代码不生成旧 HashRouter 风格内链。

