export type RefundFields = Record<'paidOn' | 'paid' | 'refund' | 'name' | 'reservation' | 'reason' | 'phone' | 'birth' | 'address' | 'addressDetail' | 'writtenOn' | 'bank' | 'account', string>;
export type RefundSignature = { bytes: Uint8Array; width: number; height: number };
export function fillRefundDocx(template: Uint8Array, fields: RefundFields, image?: RefundSignature): Uint8Array<ArrayBuffer>;
