import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Agent ID to phone number mapping
const AGENT_MAPPING: Record<string, string> = {
  'MM23': '+19059043544',
  'WK8448': '+16476258448',
  'TB0195': '+14168750195',
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

    // Check if this is a call ended event - handle both old and new VAPI webhook structures
    const isEndOfCall = webhookData.type === 'end-of-call-report' || webhookData.message?.type === 'end-of-call-report';
    
    if (isEndOfCall) {
      // Support both webhook structures
      const callData = webhookData.call || webhookData.message?.call;
      const metadata = callData?.metadata;
      
      const agentId = metadata?.agentId;
      const callStatus = webhookData.endedReason || webhookData.message?.endedReason || callData?.endedReason || 'unknown';
      const customerName = metadata?.customerName || 'Unknown';
      const address = metadata?.address || 'Unknown';
      const callSuccessful = callStatus === 'assistant-ended-call' || callStatus === 'completed';
      const vapiCallId = callData?.id;
      const callDuration = callData?.duration || 0;

      console.log('Call ended:', {
        agentId,
        callStatus,
        customerName,
        address,
        callSuccessful,
        vapiCallId,
        callDuration
      });

      // Update database with call results
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        try {
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          
          const { error: updateError } = await supabase
            .from('tpv_requests')
            .update({
              status: callSuccessful ? 'completed' : 'failed',
              ended_reason: callStatus,
              call_duration_seconds: Math.floor(callDuration),
            })
            .eq('vapi_call_id', vapiCallId);

          if (updateError) {
            console.error('Failed to update TPV request in database:', updateError);
          } else {
            console.log('TPV request updated in database successfully');
            
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
          console.error('Error updating database:', dbError);
        }
      }

      if (agentId && AGENT_MAPPING[agentId]) {
        const agentPhone = AGENT_MAPPING[agentId];
        const statusText = callSuccessful ? 'TPV Completed' : 'TPV Failed';
        const message = `${statusText}\n\nCustomer: ${customerName}\nAddress: ${address}`;

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
