export type RefundFields = Record<'paidOn' | 'paid' | 'refund' | 'name' | 'reservation' | 'reason' | 'phone' | 'birth' | 'address' | 'addressDetail' | 'writtenOn' | 'bank' | 'account', string>;
export function fillRefundDocx(template: Uint8Array, fields: RefundFields): Uint8Array<ArrayBuffer>;
