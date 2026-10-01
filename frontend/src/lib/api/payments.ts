import { apiClient } from "@/lib/api-client";

const PRICE_TABLE: Record<string, Record<string, number>> = {
  "1-100": { email: 100000, whatsapp: 200000, sms: 300000 },
  "101-200": { email: 200000, whatsapp: 350000, sms: 500000 },
  "201-400": { email: 350000, whatsapp: 500000, sms: 750000 },
  "400+": { email: 500000, whatsapp: 750000, sms: 1000000 },
};

export function calculatePrice(guestRange: string, channel: string): number {
  return PRICE_TABLE[guestRange]?.[channel] ?? PRICE_TABLE["1-100"]["email"];
}

export type InitiatePaymentResult = {
  payment_id: number;
  reference: string;
  amount: number;
  provider: string;
  authorization_url: string | null;
  method?: string;
};

export async function initiatePayment(eventId: number, channel: string = "email", provider: string = "paystack", paymentMethod: string = "paystack", couponCode?: string): Promise<InitiatePaymentResult> {
  return apiClient<InitiatePaymentResult>("/payments/initiate", {
    method: "POST",
    body: { event_id: eventId, channel, provider, payment_method: paymentMethod, coupon_code: couponCode },
  });
}

export type PaymentRecord = {
  id: number;
  event_id: number;
  organizer_id: number;
  amount: number;
  currency: string;
  provider: string;
  reference: string;
  status: string;
  paid_at: string | null;
  created_at: string;
};

export async function getPaymentHistory(): Promise<PaymentRecord[]> {
  return apiClient<PaymentRecord[]>("/payments/history");
}

export type CheckResendResult = {
  has_valid_payment: boolean;
  amount: number;
};

export async function checkResendPayment(eventId: number, guestId: number): Promise<CheckResendResult> {
  return apiClient<CheckResendResult>(`/payments/check-resend?event_id=${eventId}&guest_id=${guestId}`);
}

export async function initiateResendPayment(eventId: number, guestId: number, provider: string = "paystack"): Promise<InitiatePaymentResult> {
  return apiClient<InitiatePaymentResult>("/payments/resend", {
    method: "POST",
    body: { event_id: eventId, guest_id: guestId, provider },
  });
}
