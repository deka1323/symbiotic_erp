-- Add PART (partial payment) to POS payment mode enum
ALTER TYPE "PaymentMode" ADD VALUE IF NOT EXISTS 'PART';
