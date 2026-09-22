import { z } from "zod";

export const createPostBodySchema = z.object({
  code: z.string().min(1, "code is required"),
  name: z.string().min(1, "name is required"),
  vacancies: z.union([z.number(), z.string()]).optional(),
  feeRules: z.record(z.any()).nullable().optional(),
  formSchema: z.any().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createOrderBodySchema = z.object({
  applicationId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/),
  ]),
  amountPaise: z.union([z.number().int().nonnegative(), z.string()]).optional(),
});

export const generateAdmitCardsBodySchema = z.object({
  examDate: z.string().min(1, "examDate is required"),
  shift: z.string().min(1, "shift is required"),
  centers: z.array(z.string().min(1)).min(1, "centers[] required"),
});

export const createDraftApplicationBodySchema = z.object({
  postId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/),
  ]),
});

export const verifyPaymentBodySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  applicationId: z.union([
    z.number().int().positive(),
    z.string().regex(/^\d+$/),
  ]),
});
