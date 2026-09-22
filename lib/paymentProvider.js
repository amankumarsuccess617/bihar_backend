import crypto from "crypto";
import Razorpay from "razorpay";

/**
 * Abstraction over Razorpay so tests can run without live network calls.
 * When NODE_ENV=test (or MOCK_EXTERNAL_SERVICES=true), a deterministic mock is used.
 */
function createMockClient() {
  let orderSeq = 0;

  return {
    orders: {
      async create({ amount, currency, receipt, notes }) {
        orderSeq += 1;
        return {
          id: `order_mock_${orderSeq}`,
          amount,
          currency: currency || "INR",
          receipt,
          notes: notes || {},
          status: "created",
        };
      },
    },
  };
}

function createLiveClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required");
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

export function getPaymentClient() {
  const useMock =
    process.env.NODE_ENV === "test" ||
    process.env.MOCK_EXTERNAL_SERVICES === "true";

  return useMock ? createMockClient() : createLiveClient();
}

export function verifyPaymentSignature({
  orderId,
  paymentId,
  signature,
  secret = process.env.RAZORPAY_KEY_SECRET,
}) {
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is required for signature verification");
  }

  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expected === signature;
}

export function signPaymentPayload(orderId, paymentId, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}
