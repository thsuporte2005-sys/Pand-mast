import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdminUser } from '@/lib/auth/admin';
import { getErrorMessage } from '@/lib/errors';
import { sendAccessEmail } from '@/lib/email/access';
import { getAppBaseUrl } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const adminCheck = await requireAdminUser();
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
    }

    const adminClient = createAdminClient();
    const body = await req.json();
    const { email, name, appId, action, userId } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
    }

    // 1. Action: GRANT ACCESS
    if (action === 'grant') {
      if (!email || !appId) {
        return NextResponse.json({ error: 'Missing email or appId' }, { status: 400 });
      }

      const cleanEmail = email.toLowerCase().trim();
      const { data: targetApp, error: appError } = await adminClient
        .from('apps')
        .select('id, name, slug')
        .eq('id', appId)
        .single();

      if (appError || !targetApp) {
        return NextResponse.json({ error: 'Aplicativo não encontrado.' }, { status: 404 });
      }

      // Check if user exists in final_users
      const { data: existingUser } = await adminClient
        .from('final_users')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      let targetUserId = existingUser?.id;

      if (!targetUserId) {
        // Create user in Supabase Auth
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
          email: cleanEmail,
          email_confirm: true,
          user_metadata: {
            name: name || cleanEmail.split('@')[0],
            origin: 'manual_admin',
          },
        });

        if (authError || !authUser.user) {
          throw new Error(`Failed to create Auth account: ${authError?.message}`);
        }

        targetUserId = authUser.user.id;
      }

      // Grant access in user_app_access
      const { error: accessError } = await adminClient
        .from('user_app_access')
        .upsert({
          user_id: targetUserId,
          app_id: appId,
          status: 'active',
          platform: 'manual',
          transaction_id: `man_${Date.now()}`,
          granted_at: new Date().toISOString(),
        }, { onConflict: 'user_id,app_id' });

      if (accessError) {
        throw new Error(`Failed to insert access: ${accessError.message}`);
      }

      const loginPath = `/app/${targetApp.slug}/login`;
      const { data: linkData } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: cleanEmail,
        options: { redirectTo: `${getAppBaseUrl()}${loginPath}` },
      });
      const emailResult = await sendAccessEmail({
        email: cleanEmail,
        name: name || null,
        appName: targetApp.name,
        loginPath,
        actionLink: linkData.properties?.action_link || null,
      });

      await adminClient.from('audit_logs').insert({
        action: 'access_granted_manual',
        user_id: targetUserId,
        user_email: cleanEmail,
        details: {
          app_id: appId,
          admin_id: adminCheck.user.id,
          email_status: emailResult.sent ? 'sent' : 'pending',
          email_reason: emailResult.reason,
        },
      });

      return NextResponse.json({ success: true, user_id: targetUserId });
    }

    // 2. Action: UPDATE STATUS (BLOCK/UNBLOCK)
    if (action === 'block' || action === 'unblock') {
      if (!userId || !appId) {
        return NextResponse.json({ error: 'Missing userId or appId' }, { status: 400 });
      }

      const status = action === 'block' ? 'blocked' : 'active';

      const { error: updateError } = await adminClient
        .from('user_app_access')
        .update({ status })
        .eq('user_id', userId)
        .eq('app_id', appId);

      if (updateError) {
        throw new Error(`Failed to update status: ${updateError.message}`);
      }

      // Audit Log
      const { data: userRecord } = await adminClient
        .from('final_users')
        .select('email')
        .eq('id', userId)
        .single();

      await adminClient.from('audit_logs').insert({
        action: action === 'block' ? 'access_blocked_manual' : 'access_unblocked_manual',
        user_id: userId,
        user_email: userRecord?.email || '',
        details: { app_id: appId },
      });

      return NextResponse.json({ success: true });
    }

    // 3. Action: REVOKE
    if (action === 'revoke') {
      if (!userId || !appId) {
        return NextResponse.json({ error: 'Missing userId or appId' }, { status: 400 });
      }

      const { error: deleteError } = await adminClient
        .from('user_app_access')
        .delete()
        .eq('user_id', userId)
        .eq('app_id', appId);

      if (deleteError) {
        throw new Error(`Failed to delete access record: ${deleteError.message}`);
      }

      // Audit Log
      await adminClient.from('audit_logs').insert({
        action: 'access_revoked_manual',
        user_id: userId,
        details: { app_id: appId },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Admin users API error:', err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
