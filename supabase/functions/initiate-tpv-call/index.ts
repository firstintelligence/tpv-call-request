import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VAPI_API_KEY = Deno.env.get('VAPI_API_KEY');
    if (!VAPI_API_KEY) {
      throw new Error('VAPI_API_KEY is not configured');
    }

    const formData = await req.json();
    console.log('Received TPV request:', formData);

    // Validate agent ID
    const VALID_AGENTS: Record<string, string> = {
      'MM23': '+19059043544',
    };

    if (!VALID_AGENTS[formData.agentId]) {
      throw new Error('Invalid agent ID');
    }

    // Format phone number for VAPI (add +1 country code and remove formatting)
    const cleanPhone = formData.phoneNumber.replace(/\D/g, ''); // Remove all non-digits
    const formattedPhone = `+1${cleanPhone}`; // Add country code
    console.log('Formatted phone for VAPI:', formattedPhone);

    // Prepare the VAPI call request with all form fields as dynamic variables
    const vapiCallRequest = {
      phoneNumberId: formData.phoneNumberId || null, // Optional: use VAPI phone number ID
      phoneNumber: formattedPhone, // Customer's phone number with country code
      assistantId: formData.assistantId, // The VAPI assistant/agent ID
      assistantOverrides: {
        variableValues: {
          // Map all form fields to variables the agent can use
          agentId: formData.agentId,
          companyName: formData.companyName,
          customerName: formData.customerName,
          address: formData.address,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          phoneNumber: formData.phoneNumber,
          email: formData.email || '',
          products: Array.isArray(formData.products) 
            ? formData.products.join(', ') 
            : formData.products,
          salesPrice: formData.salesPrice,
          paymentOption: formData.paymentOption,
          financeCompany: formData.financeCompany || '',
          interestRate: formData.interestRate || '',
          promotionalTerm: formData.promotionalTerm || '',
          amortization: formData.amortization || '',
          monthlyPayment: formData.monthlyPayment || '',
        },
      },
      metadata: {
        agentId: formData.agentId,
        customerName: formData.customerName,
        address: formData.address,
      },
    };

    console.log('Initiating VAPI call with data:', JSON.stringify(vapiCallRequest, null, 2));

    // Call VAPI API to initiate the phone call
    const response = await fetch('https://api.vapi.ai/call/phone', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(vapiCallRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('VAPI API error:', response.status, errorText);
      throw new Error(`VAPI API error: ${response.status} - ${errorText}`);
    }

    const callData = await response.json();
    console.log('VAPI call initiated successfully:', callData);

    return new Response(
      JSON.stringify({
        success: true,
        callId: callData.id,
        message: 'TPV verification call initiated successfully',
        callData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in initiate-tpv-call function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
