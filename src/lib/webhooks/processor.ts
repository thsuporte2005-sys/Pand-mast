import { createAdminClient } from '@/lib/supabase/admin';
import { sendAccessEmail } from '@/lib/email/access';
import { getAppBaseUrl, type WebhookPlatform } from '@/lib/env';
import { getErrorMessage } from '@/lib/errors';
import type { JsonValue } from '@/lib/types';

export interface StandardWebhookData {
  platform: WebhookPlatform;
  event_type: string;
  buyer_name: string | null;
  buyer_email: string;
  product_id: string;
  product_name: string | null;
  transaction_id: string;
  order_status: string;
  subscription_status?: string | null;
  raw_payload: JsonValue;
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function splitProductIds(productIds: string | null) {
  return (productIds || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function isApprovalEvent(data: StandardWebhookData) {
  const status = data.order_status.toLowerCase();
  const eventType = data.event_type.toLowerCase();

  return (
    ['approved', 'complete', 'completed', 'paid', 'active', 'approval', 'compra_aprovada'].includes(
      status
    ) || ['compra aprovada', 'assinatura renovada', 'purchase_approved'].includes(eventType)
  );
}

function isRevocationEvent(data: StandardWebhookData) {
  const status = data.order_status.toLowerCase();
  const eventType = data.event_type.toLowerCase();

  return (
    [
      'refunded',
      'refund',
      'chargeback',
      'canceled',
      'cancelled',
      'disputed',
      'revoked',
      'devolvida',
      'reembolsada',
      'reembolso',
      'cancelada',
    ].includes(status) ||
    ['compra reembolsada', 'assinatura cancelada', 'chargeback'].includes(eventType)
  );
}

function extractAmount(rawPayload: JsonValue) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return 0;
  }

  const amountValue = rawPayload.price_amount ?? rawPayload.amount ?? rawPayload.value ?? 0;
  const amount = typeof amountValue === 'number' ? amountValue : Number.parseFloat(String(amountValue));

  return Number.isFinite(amount) ? amount : 0;
}

async function generateRecoveryLink(email: string, loginPath: string) {
  const adminClient = createAdminClient();
  const redirectTo = `${getAppBaseUrl()}${loginPath}`;
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error) {
    return null;
  }

  return data.properties?.action_link || null;
}

export async function processWebhookEvent(data: StandardWebhookData) {
  const adminClient = createAdminClient();
  const receivedAt = new Date().toISOString();
  const buyerEmail = normalizeEmail(data.buyer_email);

  const { data: dbEvent, error: insertError } = await adminClient
    .from('webhook_events')
    .insert({
      platform: data.platform,
      event_type: data.event_type,
      buyer_name: data.buyer_name,
      buyer_email: buyerEmail,
      product_id: data.product_id,
      product_name: data.product_name,
      transaction_id: data.transaction_id,
      order_status: data.order_status,
      subscription_status: data.subscription_status,
      raw_payload: data.raw_payload,
      status: 'pending',
      received_at: receivedAt,
    })
    .select('id')
    .single();

  if (insertError || !dbEvent) {
    return { success: false, error: 'Database insertion failed' };
  }

  const updateStatus = async (status: 'processed' | 'failed', errorMessage?: string) => {
    await adminClient
      .from('webhook_events')
      .update({
        status,
        error_message: errorMessage || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', dbEvent.id);
  };

  try {
    const { data: apps, error: appsError } = await adminClient
      .from('apps')
      .select('id, name, slug, product_ids, status');

    if (appsError) {
      throw new Error(`Failed to fetch apps: ${appsError.message}`);
    }

    const matchedApp = apps?.find((app) => splitProductIds(app.product_ids).includes(data.product_id));

    if (!matchedApp) {
      const errorMessage = `Product ID '${data.product_id}' is not linked to any app.`;
      await updateStatus('failed', errorMessage);
      await adminClient.from('audit_logs').insert({
        action: 'webhook_failed',
        details: {
          error: errorMessage,
          platform: data.platform,
          product_id: data.product_id,
          transaction_id: data.transaction_id,
        },
      });

      return { success: false, error: errorMessage };
    }

    const loginPath = `/app/${matchedApp.slug}/login`;

    if (isApprovalEvent(data)) {
      const { data: existingUser } = await adminClient
        .from('final_users')
        .select('id')
        .eq('email', buyerEmail)
        .maybeSingle();

      let userId = existingUser?.id;

      if (!userId) {
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email: buyerEmail,
          email_confirm: true,
          user_metadata: {
            name: data.buyer_name || buyerEmail.split('@')[0],
            origin: `webhook_${data.platform}`,
          },
        });

        if (authError || !authUser.user) {
          throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`);
        }

        userId = authUser.user.id;
      } else if (data.buyer_name) {
        await adminClient
          .from('final_users')
          .update({ name: data.buyer_name, status: 'active' })
          .eq('id', userId);
      }

      const { error: accessError } = await adminClient.from('user_app_access').upsert(
        {
          user_id: userId,
          app_id: matchedApp.id,
          status: 'active',
          platform: data.platform,
          transaction_id: data.transaction_id,
          granted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,app_id' }
      );

      if (accessError) {
        throw new Error(`Failed to grant app access: ${accessError.message}`);
      }

      await adminClient.from('orders').upsert(
        {
          user_id: userId,
          app_id: matchedApp.id,
          transaction_id: data.transaction_id,
          platform: data.platform,
          product_id: data.product_id,
          amount: extractAmount(data.raw_payload),
          status: 'approved',
        },
        { onConflict: 'platform,transaction_id' }
      );

      if (data.subscription_status) {
        await adminClient.from('subscriptions').upsert(
          {
            user_id: userId,
            app_id: matchedApp.id,
            subscription_id: data.transaction_id,
            platform: data.platform,
            status: data.subscription_status,
          },
          { onConflict: 'platform,subscription_id' }
        );
      }

      const recoveryLink = await generateRecoveryLink(buyerEmail, loginPath);
      const emailResult = await sendAccessEmail({
        email: buyerEmail,
        name: data.buyer_name,
        appName: matchedApp.name,
        loginPath,
        actionLink: recoveryLink,
      });

      await adminClient.from('audit_logs').insert([
        {
          action: 'access_granted',
          user_id: userId,
          user_email: buyerEmail,
          details: {
            app_id: matchedApp.id,
            app_name: matchedApp.name,
            platform: data.platform,
            transaction_id: data.transaction_id,
          },
        },
        {
          action: emailResult.sent ? 'access_email_sent' : 'access_email_pending',
          user_id: userId,
          user_email: buyerEmail,
          details: {
            app_id: matchedApp.id,
            app_name: matchedApp.name,
            login_path: loginPath,
            reason: emailResult.reason,
          },
        },
      ]);

      await updateStatus('processed');
      return { success: true, action: 'granted', user_id: userId };
    }

    if (isRevocationEvent(data)) {
      const { data: access } = await adminClient
        .from('user_app_access')
        .select('user_id, id')
        .eq('app_id', matchedApp.id)
        .eq('transaction_id', data.transaction_id)
        .maybeSingle();

      let targetUserId = access?.user_id;

      if (!targetUserId) {
        const { data: userRecord } = await adminClient
          .from('final_users')
          .select('id')
          .eq('email', buyerEmail)
          .maybeSingle();

        targetUserId = userRecord?.id;
      }

      if (!targetUserId) {
        const errorMessage = `Revocation received, but no user was found for ${buyerEmail}.`;
        await updateStatus('failed', errorMessage);
        return { success: false, error: errorMessage };
      }

      const { error: blockError } = await adminClient
        .from('user_app_access')
        .update({ status: 'blocked' })
        .eq('user_id', targetUserId)
        .eq('app_id', matchedApp.id);

      if (blockError) {
        throw new Error(`Failed to revoke access: ${blockError.message}`);
      }

      await adminClient
        .from('orders')
        .update({ status: data.order_status })
        .eq('platform', data.platform)
        .eq('transaction_id', data.transaction_id);

      await adminClient.from('audit_logs').insert({
        action: 'access_blocked',
        user_id: targetUserId,
        user_email: buyerEmail,
        details: {
          app_id: matchedApp.id,
          app_name: matchedApp.name,
          platform: data.platform,
          transaction_id: data.transaction_id,
          reason: data.order_status,
        },
      });

      await updateStatus('processed');
      return { success: true, action: 'revoked', user_id: targetUserId };
    }

    await adminClient.from('audit_logs').insert({
      action: 'webhook_info_received',
      details: {
        message: `Webhook event '${data.event_type}' received with order status '${data.order_status}'. No access action was taken.`,
        platform: data.platform,
        product_id: data.product_id,
        transaction_id: data.transaction_id,
      },
    });

    await updateStatus('processed');
    return { success: true, action: 'ignored_status' };
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Unknown processing error');
    await updateStatus('failed', message);
    return { success: false, error: message };
  }
}
