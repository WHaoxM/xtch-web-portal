# 业务终审清单：目的地与路线

> **门禁用途**：本清单是产品/运营业务终审门禁。当前 **12 个目的地 + 20 条路线仅是技术候选**；仓库中的 `published` 只表示技术发布状态，`featured` / `featuredOnHome` 只表示展示位，**均不等于业务批准**。未完成逐条签字前，不应据此认定内容、价格、班期或可售性已经获批。

## 判读口径

- 核对基线：[SEO 构建快照](../../app/scripts/seo-build-content.json)（`sourceEnv: bootstrap-catalog`，导出时间 `2026-07-20T00:00:00.000Z`）、[公开路由 manifest](../../app/scripts/seo-public-route-manifest.json) 与 [backfill 候选](../../app/scripts/backfill-content.ts)。
- `E0`：只有 bootstrap/backfill 候选字段；已查文件中没有可供业务终审的内部来源追踪。
- `E1`：[routePdfDetails](../../app/src/lib/routePdfDetails.ts) 中有来源文件名线索和逐日草稿；**文件名不是业务批准，也不能替代原件核验、事实复核和审核签字**。
- `C0`：名称、简介、图片等基础卡片字段存在；更完整内容及事实仍待确认。
- `C1`：路线基础字段存在，`routePdfDetails` 草稿天数与候选时长一致；但 SEO 快照的 `itineraryDays` 仍为空，需确认运行库及公开页实际内容。
- `C2`：路线基础字段存在，但候选时长与 `routePdfDetails` 草稿天数冲突。
- `C3`：路线基础字段存在，但没有 `routePdfDetails` 对应项，逐日行程证据缺口明确。
- 所有路线快照均为 `priceMode: on-request`；未读取班期/库存数据，故交易与班期一律保守标为“仅询价技术态；班期待查”。
- 签字栏格式：`审核人 / 日期 / 备注`。业务决定须勾选一项；“待批准”表示尚未作出最终决定。

## 目的地（12/12）

| ✓ | slug / 当前名称 | 技术状态 / 展示位 | 来源证据 | 内容完整性 | 交易 / 班期完整性 | 业务决定 | 审核人 / 日期 / 备注 |
|---|---|---|---|---|---|---|---|
| ☐ | `beijing` / Beijing | published；首页推荐 #1 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `shanghai` / Shanghai | published；首页推荐 #2 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `chengdu` / Chengdu | published；首页推荐 #3 | E0 | C0 | 不直接交易；关联 3 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `western-sichuan` / Western Sichuan | published；首页推荐 #4 | E0 | C0 | 不直接交易；关联 3 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `chongqing` / Chongqing | published；首页推荐 #5 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `yunnan` / Yunnan | published；首页推荐 #6 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `guangxi` / Guangxi | published；非首页推荐；顺序 #7 | E0 | C0；导航称 Guilin，归属待确认 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `qinghai` / Qinghai | published；非首页推荐；顺序 #8 | E0 | C0 | 不直接交易；关联 3 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `gansu` / Gansu | published；非首页推荐；顺序 #9 | E0 | C0 | 不直接交易；关联 3 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `xinjiang` / Xinjiang | published；非首页推荐；顺序 #10 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `tibet` / Tibet | published；非首页推荐；顺序 #11 | E0 | C0 | 不直接交易；关联 2 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `xian` / Xi'an | published；非首页推荐；顺序 #12 | E0 | C0 | 不直接交易；关联 1 路线；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |

## 路线（20/20）

| ✓ | slug / 当前名称 | 技术状态 / 展示位 | 来源证据 | 内容完整性 | 交易 / 班期完整性 | 业务决定 | 审核人 / 日期 / 备注 |
|---|---|---|---|---|---|---|---|
| ☐ | `1-one-day-shanghai-city-tour` / One Day Shanghai City Tour | published；非 featured | E1 | C1：1/1 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `2-3-days-and-2-nights-in-shanghai` / 3 Days and 2 Nights in Shanghai | published；featured | E1 | C1：3/3 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `3-5-days-and-4-nights-in-beijing` / 5 Days and 4 Nights in Beijing | published；featured | E1 | C1：5/5 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `4-forbidden-city-and-temple-of-heaven-day-tour` / Forbidden City and Temple of Heaven Day Tour | published；非 featured | E1 | C1：1/1 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `5-chengdu-jiuzhaigou-and-huanglong` / Chengdu, Jiuzhaigou and Huanglong | published；featured | E1 | C1：5/5 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `6-where-yading-meets-jiuzhaigou` / Where Yading Meets Jiuzhaigou | published；featured | E1 | C1：8/8 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `7-panoramic-sichuan-and-chongqing` / Panoramic Sichuan and Chongqing | published；非 featured | E1 | C1：11/11 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `8-chongqing-custom-city-route` / Chongqing Custom City Route | published；非 featured | E1 | C1：5/5 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `9-lijiang-dali-and-shangri-la` / Lijiang, Dali and Shangri-La | published；featured | E1 | **C2：候选 8 日，草稿仅 6 日** | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `10-xishuangbanna-pure-travel-route` / Xishuangbanna Pure Travel Route | published；非 featured | E1 | C1：5/5 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `11-colorful-guilin` / Colorful Guilin | published；非 featured | **E0：无 routePdfDetails 项** | **C3：4 日逐日行程证据缺口** | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `12-guangxi-7-day-tour` / Guangxi 7-Day Tour | published；非 featured | **E0：无 routePdfDetails 项** | **C3：7 日逐日行程证据缺口** | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `13-encounter-qinghai-and-gansu-grand-circuit` / Encounter Qinghai and Gansu Grand Circuit | published；featured | E1 | C1：8/8 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `14-qinghai-lake-chaka-and-dunhuang-route` / Qinghai Lake, Chaka and Dunhuang Route | published；非 featured | E1 | C1：7/7 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `15-wild-ili-northern-xinjiang` / Wild Ili Northern Xinjiang | published；featured | E1 | C1：7/7 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `16-kashgar-and-ili-pure-travel-route` / Kashgar and Ili Pure Travel Route | published；非 featured | E1 | C1：10/10 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `17-xi-an-and-huashan-boutique-tour` / Xi'an and Huashan Boutique Tour | published；非 featured | E1 | **C2：候选 7 日，草稿仅 4 日** | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `18-tibet-ali-southern-line` / Tibet Ali Southern Line | published；非 featured | E1 | C1：7/7 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `19-northern-tibet-317-legend` / Northern Tibet 317 Legend | published；非 featured | E1 | C1：10/10 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |
| ☐ | `20-panoramic-gansu-qinghai-8-day-tour` / Panoramic Gansu-Qinghai 8-Day Tour | published；非 featured | E1 | C1：8/8 日；SEO 行程为空待核 | 仅询价技术态；班期待查 | ☐待批准 ☐暂缓 ☐下架 ☐仅询价 | ___ / ___ / ___ |

## 必须先解决的跨项问题

- **Zhangjiajie / Guilin 导航冲突**：当前业务语言要求桌面导航与移动热门区出现 Zhangjiajie、Guilin，但 12 条目的地候选中没有 `zhangjiajie` 或 `guilin`；只有 `guangxi`，其描述覆盖 Guilin。业务需决定新增、改名、映射或撤下入口，技术不得自行替代。
- **路线 11/12 证据缺口**：两条路线没有 `routePdfDetails` 对应项；在补齐原始材料、逐日行程和来源追踪前，不应因 `published` 或现有摘要而视为内容完整。
- **时长冲突**：路线 9 为候选 8 日 / 草稿 6 日，路线 17 为候选 7 日 / 草稿 4 日；需回到原始材料裁决。
- **路线类型漂移风险**：backfill 写入 `available_types=['customizable']`，bootstrap SEO 快照则列出 `private`、`group-tour`、`customizable`；业务需确认真实销售模式。
- **bootstrap 与运行库可能漂移**：当前快照明确来自 `bootstrap-catalog`，不是运行数据库导出；其 12/20 数量、状态、名称、展示位和内容都可能与 Admin/运行库不同。审批前应由授权操作员对目标环境做只读导出比对。

## 审批后的技术动作（仅清单，不在本文执行）

1. 在 Admin 按签字结果更新目的地/路线状态和展示位；未验证固定价格、保证出发、库存与班期的路线只能保留询价，不得开启在线售卖。
2. 在 `app/` 下从**已确认目标环境**导出运行库公开内容：  
   `npx tsx scripts/seo-export-build-content.mjs --env=<local|win11-home|cloud-vps>`  
   该动作会改写 `app/scripts/seo-build-content.json`；不得用 `seo-bootstrap-build-content.mjs` 代替业务批准或运行库导出。
3. 生成 sitemap 与公开路由 manifest：  
   `node scripts/generate-sitemap.mjs`  
   输出 `app/public/sitemap.xml` 和 `app/scripts/seo-public-route-manifest.json`。
4. 对部署目标构建并预渲染：  
   `npm run build:win11-home` 或 `npm run build:cloud-vps`。
5. 校验 sitemap / prerender 路径集合与 HTML：  
   `node scripts/seo-assert-prerender.mjs dist/<win11-home|cloud-vps>`。
6. 最后人工复核：仅批准项出现在 Admin published 集合、SEO 快照、sitemap、manifest 和预渲染目录；暂缓/下架项不得残留为可索引公开路径。

