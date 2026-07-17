import type { InquiryStatus, InquiryType } from '@/lib/inquiriesAdminClient';

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: '新询盘',
  in_progress: '跟进中',
  closed: '已关闭',
};

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  quick_contact: '快捷联系',
  custom_trip: '定制行程',
  route_private: '路线私人定制',
};

export const INQUIRY_STATUS_HINTS: Record<InquiryStatus, string> = {
  new: '先联系客人，确认意向后再标「跟进中」。',
  in_progress: '持续跟进；谈妥或无需跟进时标「已关闭」。',
  closed: '已关闭；需重开可再标「跟进中」。',
};

export type InquiryTypeOpsCopy = {
  label: string;
  summary: string;
  replyTips: string[];
};

export const INQUIRY_TYPE_OPS: Record<InquiryType, InquiryTypeOpsCopy> = {
  quick_contact: {
    label: '快捷联系',
    summary: '客人从站点快捷入口留言，通常想尽快被联系，未必已定路线。',
    replyTips: [
      '确认对方时区与方便接听/回信的时间',
      '问清出行人数、大致月份与感兴趣的城市或主题',
      '说明下一步：我们会按意向给建议行程或报价',
    ],
  },
  custom_trip: {
    label: '定制行程',
    summary: '客人填写了定制表单，已有目的地/天数/预算等偏好，适合做方案。',
    replyTips: [
      '核对目的地、天数与预算是否可落地',
      '确认酒店等级与旅行风格偏好',
      '约定何时发初版行程或报价区间',
    ],
  },
  route_private: {
    label: '路线私人定制',
    summary: '客人基于某条现有路线申请私人定制，优先围绕该路线谈改期与人数。',
    replyTips: [
      '确认意向路线是否正确、是否需微调天数/景点',
      '问清出发月份、人数与预算弹性',
      '说明私人团与拼团的差异及下一步报价',
    ],
  },
};

export function inquiryStatusLabel(status: string): string {
  return INQUIRY_STATUS_LABELS[status as InquiryStatus] ?? status;
}

export function inquiryTypeLabel(type: string): string {
  return INQUIRY_TYPE_LABELS[type as InquiryType] ?? type;
}

export function inquiryStatusHint(status: string): string {
  return INQUIRY_STATUS_HINTS[status as InquiryStatus] ?? '按实际跟进情况更新状态。';
}

export function inquiryTypeOps(type: string): InquiryTypeOpsCopy {
  return (
    INQUIRY_TYPE_OPS[type as InquiryType] ?? {
      label: type,
      summary: '未知询盘类型，请按留言与联系方式跟进。',
      replyTips: ['先联系客人确认需求', '记录内部备注', '谈妥后关闭询盘'],
    }
  );
}

/** List/detail scan time: e.g. 7月17日 14:30 */
export function formatInquiryDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${hh}:${mm}`;
}
