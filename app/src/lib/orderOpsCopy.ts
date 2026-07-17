export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: '待支付',
  confirmed: '已确认',
  cancellation_requested: '取消申请中',
  cancelled: '已取消',
  refunded: '已退款',
  failed: '失败',
  expired: '已过期',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: '未支付',
  paid: '已支付',
  partially_refunded: '部分退款',
  refunded: '已退款',
  failed: '支付失败',
};

export const REFUND_STATUS_LABELS: Record<string, string> = {
  none: '无退款',
  pending: '退款处理中',
  partially_refunded: '部分退款',
  refunded: '已退款',
};

export const CONFIRMATION_EMAIL_STATUS_LABELS: Record<string, string> = {
  confirmation_email_pending: '待发送',
  confirmation_email_sent: '已发送',
  confirmation_email_failed: '发送失败',
  confirmation_email_retrying: '重试中',
};

/** Order status = fulfillment progress (plain language). */
export const ORDER_STATUS_PLAIN: Record<string, string> = {
  pending_payment: '还在等客人付款，别当已成团去履约',
  confirmed: '已成单，可按行程跟进与沟通',
  cancellation_requested: '客人申请取消，需人工跟进（后台不能一键批准）',
  cancelled: '订单已取消，履约结束',
  refunded: '已退款收口，履约结束',
  failed: '下单或支付失败，未成团',
  expired: '超时未付，订单已失效',
};

/** Payment status = money in/out (plain language). */
export const PAYMENT_STATUS_PLAIN: Record<string, string> = {
  unpaid: '钱还没到账',
  paid: '钱已到账',
  partially_refunded: '已退一部分',
  refunded: '款已退完',
  failed: '支付没成功',
};

export const ORDER_STATUS_HINTS: Record<string, string> = {
  pending_payment: '等待客人完成支付；勿当已成团履约。',
  confirmed: '已成单；可核对行程，符合条件时可重发确认邮件。',
  cancellation_requested:
    '客人已申请取消。后台暂不能点批准或退款；请按内部流程（联系客人、Stripe/财务）处理，并用备注记录进展。',
  cancelled: '订单已取消，一般无需再履约；有疑问再查支付与备注。',
  refunded: '退款已完成，订单收口。',
  failed: '订单失败，核对支付与客人沟通即可。',
  expired: '超时未支付已过期，无需履约。',
};

export const CANCEL_REQUEST_BANNER =
  '取消申请：后台暂不能一键批准或退款。请联系客人确认诉求，按内部流程走 Stripe/财务处理，并用下方备注记录进展。';

export const DASHBOARD_CANCEL_CARD_DESCRIPTION =
  '客人已申请取消，需人工跟进；后台不能一键批准。';

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? status;
}

export function paymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] ?? status;
}

export function refundStatusLabel(status: string): string {
  return REFUND_STATUS_LABELS[status] ?? status;
}

export function confirmationEmailStatusLabel(status: string): string {
  return CONFIRMATION_EMAIL_STATUS_LABELS[status] ?? status;
}

export function orderStatusHint(status: string): string {
  return ORDER_STATUS_HINTS[status] ?? '按实际业务进度跟进，并用备注记录。';
}

export function orderStatusPlain(status: string): string {
  return ORDER_STATUS_PLAIN[status] ?? '见订单状态标签';
}

export function paymentStatusPlain(status: string): string {
  return PAYMENT_STATUS_PLAIN[status] ?? '见支付状态标签';
}

export function canResendConfirmation(order: {
  status: string;
  payment_status: string;
}): boolean {
  return order.status === 'confirmed' && order.payment_status === 'paid';
}

/** List/detail scan time: e.g. 7月17日 14:30 */
export function formatOrderDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${hh}:${mm}`;
}
