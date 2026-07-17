# Featured Services / Traveler Stories 页面实施计划

## Context

`/featured-services` 是当前站点一级导航 "Featured Services" 的落地页，但它在 `App.tsx` 里复用了 `TravelGuide.tsx`，实际展示的是签证、支付、交通等旅行指南内容。这与 `CONTEXT.md` 对 Featured Services 的定义（"服务优势、规划支持、旅行指南价值"）不符，也没有利用已有的真实体验视频素材。

本次变更目标：
- 为 `/featured-services` 创建独立的 `FeaturedServices.tsx` 页面。
- 以 "Traveler Stories" 为核心定位，用真实旅行视频向外国游客展示 Syncing Travel 能安排的独特体验。
- 页面结构简洁、快速浏览、强 CTA 导向 `/custom-trip`。

## Recommended Approach

### 页面定位

- **页面标题**：Traveler Stories
- **副标题**：Real moments, local access, planned for you.
- **目标用户**：对中国旅行有兴趣、但不确定能体验到什么的外国游客。
- **页面目标**：快速展示 Syncing 能安排的体验 → 建立信任 → 点击进入 `/custom-trip`。

### 页面结构

```
FeaturedServices
├── HeroVideoSection          # 全宽背景视频 + 标题
├── StorySection x3           # 横向滚动视频带
│   ├── Hands-On Culture
│   ├── Landscapes & Adventure
│   └── Local Life, Food & Shows
├── ServiceCapabilitiesSection # 与故事区一一对应的具体服务说明
└── CtaSection                # Plan My Trip → /custom-trip
```

### 三个故事区及视频

| 故事区 | 精选视频（原始文件名） | 公开路径 |
|--------|----------------------|---------|
| **Hands-On Culture** | 西安陶俑制作 | `/videos/experiences/xian-terracotta-workshop.mp4` |
| | 西安汉服体验 | `/videos/experiences/xian-hanfu-experience.mp4` |
| | 上海非遗拓印体验 | `/videos/experiences/shanghai-rubbing-experience.mp4` |
| **Landscapes & Adventure** | 川西外国人 | `/videos/experiences/western-sichuan-foreigner.mp4` |
| | 西藏1 | `/videos/experiences/tibet-scenery-1.mp4` |
| | 特色沙漠越野 | `/videos/experiences/desert-offroad.mp4` |
| **Local Life, Food & Shows** | 变脸喷火 | `/videos/experiences/face-changing-fire.mp4` |
| | 演出唐乐宫1 | `/videos/experiences/tang-palace-show-1.mp4` |
| | 城墙骑行 | `/videos/experiences/city-wall-cycling.mp4` |

Hero 视频复用 `川西外国人`。

## Files to Modify

### 1. `app/src/App.tsx`

- 导入新的 `FeaturedServices` 组件。
- 将 `/featured-services` 路由从 `<TravelGuide />` 改为 `<FeaturedServices />`。
- 保持 `/travel-guide` 路由不变。

### 2. `app/src/pages/FeaturedServices.tsx`（新建）

主要页面组件，包含：
- Hero 视频区：全宽、自动播放、静音、循环，带标题叠加。
- 三个 `StorySection`：每个包含 `SectionIntro` + `VideoStrip`。
- `ServiceCapabilitiesSection`：与故事区一一对应。
- CTA 区：单一 "Plan My Trip" 按钮。

### 3. `app/src/components/VideoStrip.tsx`（新建）

横向滚动视频带组件：
- 桌面端：横向滚动 + 左右箭头按钮。
- 移动端：原生横向滑动，箭头隐藏。
- 复用 `index.css` 中已有的 `.scrollbar-hide` 和 scroll-snap 工具类。

### 4. `app/src/components/VideoCard.tsx`（新建）

单个视频卡片：
- 桌面端：hover 时静音自动播放，移开暂停。
- 移动端：点击打开 lightbox 播放。
- 显示标题、一句话描述、地点标签。

### 5. `app/src/components/VideoLightbox.tsx`（新建）

视频弹窗：
- 点击卡片后全屏播放。
- 支持 Escape 关闭、点击背景关闭。
- 移动端显示原生 controls。

### 6. `app/src/lib/featuredServicesData.ts`（新建）

集中管理页面数据：
- `heroVideo`
- `storySections`（含每个视频的 `id`, `title`, `description`, `src`, `poster`, `location`）
- `serviceCapabilities`
- `cta`

### 7. `app/src/components/CtaBand.tsx`（修改）

当前 `CtaBand` 强制渲染两个按钮。需调整为 secondary 按钮可选：
- 当 `secondaryLabel` 未提供时，只渲染 primary 按钮。
- 保持现有调用方不受影响。

### 8. `app/src/lib/searchIndex.ts`

新增搜索条目：
- `id: 'service-featured-services'`
- `type: 'Service'`
- 标题、描述指向 `/featured-services`。

### 9. `app/src/components/Seo.tsx`

在 `routeMeta` 中添加 `/featured-services` 的 title、description、image。

### 10. `app/public/videos/experiences/`（新建目录 + 复制文件）

从原始素材目录复制选中的 10 条视频，使用上表中的稳定英文文件名。

## Reusable Assets

- `SectionIntro` from `app/src/components/SiteSections.tsx`：用于故事区标题。
- `useScrollAnimation` from `app/src/hooks/useScrollAnimation`：用于滚动淡入动画。
- Tailwind + 自定义 CSS in `app/src/index.css`：`.section-padding`, `.content-max-width`, `.scrollbar-hide`, scroll-snap 工具类。
- 品牌色：`#002A3A`（主深色）、`#379C8A` / `#6FD1D7`（强调色）。

## Key Decisions

| 决策 | 选择 | 原因 |
|------|------|------|
| 内容方向 | Traveler Stories + Problem-Solution | 用真实视频打动外国游客，同时回答 "Syncing 能帮我解决什么" |
| 视频组织 | 按游客偏好主题 | 符合外国游客浏览习惯 |
| 交互形式 | 横向滚动视频带 | 沉浸式、节省垂直空间、移动端自然 |
| 服务区 | 与故事区一一对应 | 避免空泛口号，具体可信 |
| CTA | 单一 "Plan My Trip" | 减少犹豫，快速转化 |
| 移动端播放 | 点击播放，无自动播放 | 节省流量，符合移动用户习惯 |
| Hero | 视频背景 | 强化 "真实旅程" 的第一印象 |
| 数据管理 | 独立 `featuredServicesData.ts` | 与现有 `siteData.ts` 模式一致，便于维护 |

## Open Questions / Blockers

1. 视频 poster 图片是否已有？若无，需要从视频帧生成或使用现有静态图片占位。
2. 原始视频文件较大，是否需要压缩/转码为更适合 web 的规格？
3. `prefers-reduced-motion` 用户的体验：应提供静态 poster 替代自动播放。

## Verification

1. **构建检查**：
   ```bash
   cd app && npm run build
   ```
   确保 TypeScript 无错误、无缺失导入。

2. **Lint 检查**：
   ```bash
   npm run lint
   ```

3. **路由检查**：
   - `/featured-services` 渲染新页面。
   - `/travel-guide` 仍渲染原 `TravelGuide` 页面。

4. **桌面端视觉检查**：
   - Hero 视频自动静音播放。
   - 三个故事区标题和视频带正确显示。
   - 横向滚动和左右箭头工作正常。
   - Hover 卡片时视频自动播放。
   - 点击卡片打开 lightbox，视频带 controls 播放。
   - Service Capabilities 与三个故事区对应。
   - CTA 按钮跳转 `/custom-trip`。

5. **移动端视觉检查**：
   - 视频带可横向滑动。
   - 点击卡片打开 lightbox 播放。
   - CTA 按钮可点击。

6. **搜索检查**：
   - 站内搜索 "traveler stories" 或 "featured services" 能出现新条目并正确跳转。

7. **SEO 检查**：
   - 页面 title、description、og 标签正确。
