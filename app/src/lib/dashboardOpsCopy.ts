import { DASHBOARD_CANCEL_CARD_DESCRIPTION } from '@/lib/orderOpsCopy';

/** Page tip above the four pending cards. */
export const DASHBOARD_PAGE_TIP =
  '点击卡片进入列表；数字为当前待处理量。';

export type DashboardCardKey =
  | 'cancellationRequestedOrders'
  | 'openInquiries'
  | 'draftRoutes'
  | 'reviewMedia';

/** Fixed urgency order: cancel → inquiries → draft routes → review media. */
export const DASHBOARD_CARD_COPY: Record<
  DashboardCardKey,
  { title: string; description: string }
> = {
  cancellationRequestedOrders: {
    title: '取消申请订单',
    description: DASHBOARD_CANCEL_CARD_DESCRIPTION,
  },
  openInquiries: {
    title: '待跟进询盘',
    description: '新询盘与跟进中；点进后按下一步指引处理。',
  },
  draftRoutes: {
    title: '未上架路线',
    description: '仍是草稿；完善后上架，旅客才能看到。',
  },
  reviewMedia: {
    title: '待确认素材',
    description: '素材库入库待确认；路线/目的地选图器上传不计在此。',
  },
};
