export const DEPARTURE_STATUS_VALUES = [
  'draft',
  'sellable',
  'locked',
  'closed',
  'sold_out',
  'cancelled',
] as const;

export type DepartureStatusValue = (typeof DEPARTURE_STATUS_VALUES)[number];

export const DEPARTURE_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  sellable: '可售',
  locked: '已锁团',
  closed: '已关闭',
  sold_out: '售罄',
  cancelled: '已取消',
};

/** Short tag beside status in list / confirm context. */
export const DEPARTURE_STATUS_SHORT_TAGS: Record<string, string> = {
  draft: '未上架',
  sellable: '在售',
  locked: '可恢复',
  closed: '不再卖',
  sold_out: '售罄',
  cancelled: '已作废',
};

export type DepartureDangerAction = 'lock' | 'close' | 'cancel';

export const DEPARTURE_ACTION_LABELS: Record<DepartureDangerAction, string> = {
  lock: '锁团',
  close: '关闭',
  cancel: '取消',
};

export type DepartureActionConfirm = {
  title: string;
  body: string;
  shortTag: string;
};

export const DEPARTURE_ACTION_CONFIRMS: Record<DepartureDangerAction, DepartureActionConfirm> = {
  lock: {
    title: '确认锁团？',
    body: '暂时停售，已有订单保留。之后可用「重新上架可售」恢复。',
    shortTag: '可恢复',
  },
  close: {
    title: '确认关闭？',
    body: '本团结束售卖，不提供一键恢复。',
    shortTag: '不再卖',
  },
  cancel: {
    title: '确认取消？',
    body: '班期作废，不提供一键恢复。',
    shortTag: '已作废',
  },
};

export function departureStatusLabel(status: string): string {
  return DEPARTURE_STATUS_LABELS[status] ?? status;
}

export function departureStatusShortTag(status: string): string | null {
  return DEPARTURE_STATUS_SHORT_TAGS[status] ?? null;
}

export function departureActionLabel(action: DepartureDangerAction): string {
  return DEPARTURE_ACTION_LABELS[action];
}

export function departureActionConfirm(action: DepartureDangerAction): DepartureActionConfirm {
  return DEPARTURE_ACTION_CONFIRMS[action];
}

/** Traveler can buy only when sellable and seats remain. */
export function travelerCanBuy(status: string, availableSeats: number): boolean {
  return status === 'sellable' && availableSeats > 0;
}

export type TravelerBuyConclusion = {
  canBuy: boolean;
  label: string;
  detail: string;
};

export function travelerBuyConclusion(
  status: string,
  availableSeats: number,
): TravelerBuyConclusion {
  if (status === 'sold_out' || (status === 'sellable' && availableSeats <= 0)) {
    return {
      canBuy: false,
      label: '不能购买',
      detail: '售罄（无剩余名额）',
    };
  }
  if (travelerCanBuy(status, availableSeats)) {
    return {
      canBuy: true,
      label: '可以购买',
      detail: '状态为可售，且仍有名额',
    };
  }
  return {
    canBuy: false,
    label: '不能购买',
    detail: `当前状态：${departureStatusLabel(status)}`,
  };
}

export function canResellDeparture(status: string): boolean {
  return status === 'draft' || status === 'locked';
}

export function canRunDangerAction(status: string): boolean {
  return status === 'sellable';
}
