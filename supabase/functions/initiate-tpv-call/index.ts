import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

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
      'WK8448': '+16476258448',
      'TB0195': '+14168750195',
    };

    if (!VALID_AGENTS[formData.agentId]) {
      throw new Error('Invalid agent ID');
    }

    // Format phone number for VAPI (add +1 country code and remove formatting)
    const cleanPhone = formData.phoneNumber.replace(/\D/g, ''); // Remove all non-digits
    const formattedPhone = `+1${cleanPhone}`; // Add country code
    console.log('Formatted phone for VAPI:', formattedPhone);

    // Prepare the VAPI call request with all form fields as dynamic variables
    const vapiCallRequest: any = {
      phoneNumberId: '0c8cdec4-c0fe-46e8-b89a-7741d0c49a00', // VAPI phone number to call from
      customer: {
        number: formattedPhone, // Customer's phone number with country code
      },
      assistantId: formData.assistantId, // The VAPI assistant/agent ID
      assistantOverrides: {
        variableValues: {
          // Map all form fields to variables the agent can use
          agentId: formData.agentId,
          firstName: formData.firstName,
          lastName: formData.lastName,
          customerName: formData.customerName, // Full name for formal references
          address: formData.address,
          city: formData.city,
          province: formData.province,
          postalCode: formData.postalCode,
          phoneNumber: formData.phoneNumber,
          email: formData.email || '',
          // Send products as both array and formatted string for agent flexibility
          products: Array.isArray(formData.products) 
            ? formData.products.join(', ') 
            : formData.products,
          productsList: Array.isArray(formData.products) 
            ? formData.products 
            : [formData.products],
          numberOfProducts: Array.isArray(formData.products) 
            ? formData.products.length 
            : 1,
          salesPrice: formData.salesPrice,
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

    // Log to database
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        const { error: insertError } = await supabase
          .from('tpv_requests')
          .insert({
            agent_id: formData.agentId,
            first_name: formData.firstName,
            last_name: formData.lastName,
            customer_name: formData.customerName, // Full name
            customer_phone: formData.phoneNumber,
            customer_address: formData.address,
            city: formData.city,
            province: formData.province,
            postal_code: formData.postalCode,
            email: formData.email,
            products: Array.isArray(formData.products) 
              ? formData.products.join(', ') 
              : formData.products,
            sales_price: formData.salesPrice,
            interest_rate: formData.interestRate,
            promotional_term: formData.promotionalTerm,
            amortization: formData.amortization,
            monthly_payment: formData.monthlyPayment,
            vapi_call_id: callData.id,
            status: 'initiated',
          });

        if (insertError) {
          console.error('Failed to log TPV request to database:', insertError);
        } else {
          console.log('TPV request logged to database successfully');
          
          // Trigger Google Sheets sync
          try {
            const syncResponse = await fetch(`${SUPABASE_URL}/functions/v1/sync-to-google-sheets`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!syncResponse.ok) {
              console.error('Failed to sync to Google Sheets:', await syncResponse.text());
            } else {
              console.log('Successfully synced to Google Sheets');
            }
          } catch (syncError) {
            console.error('Error syncing to Google Sheets:', syncError);
          }
        }
      } catch (dbError) {
        console.error('Error logging to database:', dbError);
      }
    }

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
