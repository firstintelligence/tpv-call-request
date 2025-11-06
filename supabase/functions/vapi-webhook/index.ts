import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent ID to phone number mapping
const AGENT_MAPPING: Record<string, string> = {
  'MM23': '+19059043544',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      throw new Error('Twilio credentials not configured');
    }

    const webhookData = await req.json();
    console.log('VAPI webhook received:', JSON.stringify(webhookData, null, 2));

    // Check if this is a call ended event
    if (webhookData.type === 'end-of-call-report') {
      const agentId = webhookData.call?.metadata?.agentId;
      const callStatus = webhookData.endedReason || 'unknown';
      const customerName = webhookData.call?.metadata?.customerName || 'Unknown';
      const callSuccessful = callStatus === 'assistant-ended-call' || callStatus === 'completed';

      console.log('Call ended:', {
        agentId,
        callStatus,
        customerName,
        callSuccessful
      });

      if (agentId && AGENT_MAPPING[agentId]) {
        const agentPhone = AGENT_MAPPING[agentId];
        const statusText = callSuccessful ? '✅ SUCCESSFUL' : '❌ FAILED';
        const message = `TPV Call ${statusText}\n\nCustomer: ${customerName}\nAgent ID: ${agentId}\nStatus: ${callStatus}\n\nCall ID: ${webhookData.call?.id || 'N/A'}`;

        console.log('Sending SMS to agent:', agentPhone);

        // Send SMS via Twilio
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

        const smsResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            To: agentPhone,
            From: TWILIO_PHONE_NUMBER,
            Body: message,
          }),
        });

        if (!smsResponse.ok) {
          const errorText = await smsResponse.text();
          console.error('Twilio SMS error:', errorText);
          throw new Error(`Failed to send SMS: ${errorText}`);
        }

        const smsResult = await smsResponse.json();
        console.log('SMS sent successfully:', smsResult);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Notification sent to agent',
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // Return success for all webhook events
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Webhook received',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in vapi-webhook function:', error);
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
