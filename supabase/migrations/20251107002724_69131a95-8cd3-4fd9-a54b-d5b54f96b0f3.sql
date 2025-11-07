-- Add first_name and last_name columns to tpv_requests table
ALTER TABLE public.tpv_requests
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT;

-- Update customer_name to be nullable temporarily for migration
ALTER TABLE public.tpv_requests
ALTER COLUMN customer_name DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.tpv_requests.first_name IS 'Customer first name';
COMMENT ON COLUMN public.tpv_requests.last_name IS 'Customer last name';
COMMENT ON COLUMN public.tpv_requests.customer_name IS 'Full customer name (first + last)';