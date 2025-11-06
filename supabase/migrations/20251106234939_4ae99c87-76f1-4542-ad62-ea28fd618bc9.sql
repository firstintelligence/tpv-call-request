-- Create tpv_requests table to log all TPV verification calls
CREATE TABLE public.tpv_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  email TEXT,
  products TEXT,
  sales_price TEXT,
  interest_rate TEXT,
  promotional_term TEXT,
  amortization TEXT,
  monthly_payment TEXT,
  vapi_call_id TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  ended_reason TEXT,
  call_duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tpv_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read access (agents can view all requests)
CREATE POLICY "Anyone can view TPV requests"
ON public.tpv_requests
FOR SELECT
TO public
USING (true);

-- Allow public insert (for logging new requests)
CREATE POLICY "Anyone can insert TPV requests"
ON public.tpv_requests
FOR INSERT
TO public
WITH CHECK (true);

-- Allow public update (for updating status)
CREATE POLICY "Anyone can update TPV requests"
ON public.tpv_requests
FOR UPDATE
TO public
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_tpv_requests_agent_id ON public.tpv_requests(agent_id);
CREATE INDEX idx_tpv_requests_created_at ON public.tpv_requests(created_at DESC);
CREATE INDEX idx_tpv_requests_vapi_call_id ON public.tpv_requests(vapi_call_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_tpv_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_tpv_requests_updated_at
BEFORE UPDATE ON public.tpv_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_tpv_requests_updated_at();