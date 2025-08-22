-- Add bank receipt number and image URLs to payment_records table
ALTER TABLE public.payment_records 
ADD COLUMN IF NOT EXISTS bank_receipt_number text,
ADD COLUMN IF NOT EXISTS payment_image_urls text[];

-- Add invoice image URLs to invoice_records table  
ALTER TABLE public.invoice_records
ADD COLUMN IF NOT EXISTS invoice_image_urls text[];