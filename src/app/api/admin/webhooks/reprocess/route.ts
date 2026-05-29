import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { processWebhookEvent } from '@/lib/webhooks/processor';
import { requireAdminUser } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/errors';
import type { WebhookPlatform } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdminUser();
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
    }

    const body = await req.json();
    const { eventId } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId parameter' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch webhook event details
    const { data: event, error: fetchError } = await adminClient
      .from('webhook_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Webhook event not found in logs' }, { status: 404 });
    }

    // 2. Call the processor logic again
    const result = await processWebhookEvent({
      platform: event.platform as WebhookPlatform,
      event_type: event.event_type,
      buyer_name: event.buyer_name,
      buyer_email: event.buyer_email,
      product_id: event.product_id,
      product_name: event.product_name,
      transaction_id: event.transaction_id,
      order_status: event.order_status,
      subscription_status: event.subscription_status || null,
      raw_payload: event.raw_payload
    });

    return NextResponse.json({ success: true, result });
  } catch (err: unknown) {
    console.error('Webhook reprocessing error:', err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
