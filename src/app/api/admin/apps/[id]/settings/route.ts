import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin';
import { formatAppError, logTechnicalError, type AppErrorCategory } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const nullableText = z.string().trim().nullable().optional();
const nullableUrl = z.string().trim().url('Informe uma URL válida.').nullable().optional();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor hexadecimal válida.');

const generalSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do app.'),
  slug: z.string().trim().min(2).regex(/^[a-z0-9-]+$/, 'Use apenas letras minúsculas, números e hífens no slug.'),
  description: nullableText,
  productIds: nullableText,
  status: z.enum(['draft', 'published']),
  logoUrl: nullableUrl,
  logoPath: nullableText,
  coverUrl: nullableUrl,
});

const appearanceSchema = z.object({
  primaryColor: color,
  secondaryColor: color,
  accentColor: color,
  backgroundColor: color,
  textColor: color,
  customDomain: nullableText,
});

const pwaSchema = z.object({
  shortName: nullableText,
  themeColor: color,
  backgroundColor: color,
  display: z.enum(['standalone', 'fullscreen', 'minimal-ui']),
  orientation: z.enum(['portrait', 'landscape', 'any']),
});

const supportSchema = z
  .object({
    supportEnabled: z.boolean(),
    supportType: z.enum(['whatsapp', 'email', 'external_link']),
    supportWhatsapp: nullableText,
    supportEmail: z.string().trim().email('Email de suporte inválido.').nullable().optional(),
    supportExternalUrl: nullableUrl,
    supportButtonText: z.string().trim().min(2, 'Informe o texto do botão.'),
    supportIconUrl: nullableUrl,
    supportIconPath: nullableText,
    supportPosition: z.enum(['bottom_right', 'hidden']),
  })
  .superRefine((values, ctx) => {
    if (!values.supportEnabled) return;

    if (values.supportType === 'whatsapp' && !values.supportWhatsapp) {
      ctx.addIssue({ code: 'custom', message: 'Informe o WhatsApp do suporte.', path: ['supportWhatsapp'] });
    }
    if (values.supportType === 'email' && !values.supportEmail) {
      ctx.addIssue({ code: 'custom', message: 'Informe o email do suporte.', path: ['supportEmail'] });
    }
    if (values.supportType === 'external_link' && !values.supportExternalUrl) {
      ctx.addIssue({ code: 'custom', message: 'Informe o link externo do suporte.', path: ['supportExternalUrl'] });
    }
  });

const brandingSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do app.'),
  displayName: z.string().trim().min(2, 'Informe o nome exibido.'),
  subtitle: nullableText,
  logoUrl: nullableUrl,
  logoPath: nullableText,
  squareIconUrl: nullableUrl,
  squareIconPath: nullableText,
  brandMode: z.enum(['text', 'image']),
  brandFont: z.string().trim().min(1),
  defaultLanguage: z.enum(['pt-BR', 'en-US', 'es-ES', 'fr-FR']),
});

const carouselSchema = z.object({ carouselEnabled: z.boolean() });
const auditSchema = z.object({
  auditAction: z.enum([
    'update_app_settings',
    'update_support_settings',
    'update_branding',
    'update_carousel',
    'upload_app_logo',
    'upload_support_icon',
  ]),
  changes: z.record(z.string(), z.unknown()).optional(),
});

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('general'), values: generalSchema }),
  z.object({ action: z.literal('appearance'), values: appearanceSchema }),
  z.object({ action: z.literal('pwa'), values: pwaSchema }),
  z.object({ action: z.literal('support'), values: supportSchema }),
  z.object({ action: z.literal('branding'), values: brandingSchema }),
  z.object({ action: z.literal('carousel'), values: carouselSchema }),
  z.object({ action: z.literal('audit'), values: auditSchema }),
]);

function getStatus(category: AppErrorCategory) {
  if (category === 'permission') return 403;
  if (category === 'validation') return 400;
  if (category === 'connection') return 503;
  return 500;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let adminId: string | null = null;
  let adminEmail: string | null = null;
  let appId: string | null = null;

  async function audit(action: string, status: 'success' | 'error', details: Record<string, unknown>) {
    if (!supabase) {
      console.error(`[Pand mast] audit_logs:${action}`, 'Cliente Supabase indisponível.');
      return;
    }

    const { error } = await supabase.from('audit_logs').insert({
      action,
      user_id: adminId,
      user_email: adminEmail,
      details: { app_id: appId, status, ...details },
    });

    if (error) logTechnicalError(`audit_logs:${action}`, error, 'database');
  }

  try {
    const adminCheck = await requireAdminUser();
    if (!adminCheck.ok) {
      return NextResponse.json({ ok: false, error: adminCheck.message }, { status: adminCheck.status });
    }

    adminId = adminCheck.user.id;
    adminEmail = adminCheck.user.email || null;
    supabase = await createClient();
    appId = z.string().uuid('Aplicativo inválido.').parse((await context.params).id);
    const body = bodySchema.parse(await request.json());

    if (body.action === 'general') {
      const values = body.values;
      const { error } = await supabase
        .from('apps')
        .update({
          name: values.name,
          slug: values.slug,
          description: values.description || null,
          product_ids: values.productIds || null,
          status: values.status,
          logo_url: values.logoUrl || null,
          logo_path: values.logoPath || null,
          cover_url: values.coverUrl || null,
        })
        .eq('id', appId);
      if (error) throw error;
      await audit('update_app_settings', 'success', { section: 'general' });
    }

    if (body.action === 'appearance') {
      const values = body.values;
      const { error } = await supabase.from('app_settings').upsert(
        {
          app_id: appId,
          primary_color: values.primaryColor,
          secondary_color: values.secondaryColor,
          accent_color: values.accentColor,
          background_color: values.backgroundColor,
          text_color: values.textColor,
          custom_domain: values.customDomain || null,
        },
        { onConflict: 'app_id' }
      );
      if (error) throw error;
      await audit('update_app_settings', 'success', { section: 'appearance' });
    }

    if (body.action === 'pwa') {
      const values = body.values;
      const { error } = await supabase.from('pwa_settings').upsert(
        {
          app_id: appId,
          short_name: values.shortName || null,
          theme_color: values.themeColor,
          background_color: values.backgroundColor,
          display: values.display,
          orientation: values.orientation,
        },
        { onConflict: 'app_id' }
      );
      if (error) throw error;
      await audit('update_app_settings', 'success', { section: 'pwa' });
    }

    if (body.action === 'support') {
      const values = body.values;
      const { error } = await supabase.from('app_settings').upsert(
        {
          app_id: appId,
          support_enabled: values.supportEnabled,
          support_type: values.supportType,
          support_whatsapp: values.supportWhatsapp || null,
          support_email: values.supportEmail || null,
          support_external_url: values.supportExternalUrl || null,
          support_button_text: values.supportButtonText,
          support_icon_url: values.supportIconUrl || null,
          support_icon_path: values.supportIconPath || null,
          support_position: values.supportPosition,
        },
        { onConflict: 'app_id' }
      );
      if (error) throw error;
      await audit('update_support_settings', 'success', {
        support_enabled: values.supportEnabled,
        support_type: values.supportType,
      });
    }

    if (body.action === 'branding') {
      const values = body.values;
      const appPayload = {
        name: values.name,
        display_name: values.displayName,
        subtitle: values.subtitle || null,
        logo_url: values.logoUrl || null,
        logo_path: values.logoPath || null,
        square_icon_url: values.squareIconUrl || null,
        square_icon_path: values.squareIconPath || null,
        brand_mode: values.brandMode,
        brand_font: values.brandFont,
        default_language: values.defaultLanguage,
      };
      const { error: appError } = await supabase.from('apps').update(appPayload).eq('id', appId);
      if (appError) throw appError;

      const { error: settingsError } = await supabase.from('app_settings').upsert(
        {
          app_id: appId,
          display_name: values.displayName,
          subtitle: values.subtitle || null,
          logo_url: values.logoUrl || null,
          logo_path: values.logoPath || null,
          square_icon_url: values.squareIconUrl || null,
          square_icon_path: values.squareIconPath || null,
          brand_mode: values.brandMode,
          brand_font: values.brandFont,
        },
        { onConflict: 'app_id' }
      );
      if (settingsError) throw settingsError;
      await audit('update_branding', 'success', { brand_mode: values.brandMode });
    }

    if (body.action === 'carousel') {
      const { error } = await supabase.from('app_settings').upsert(
        { app_id: appId, carousel_enabled: body.values.carouselEnabled },
        { onConflict: 'app_id' }
      );
      if (error) throw error;
      await audit('update_carousel', 'success', { carousel_enabled: body.values.carouselEnabled });
    }

    if (body.action === 'audit') {
      await audit(body.values.auditAction, 'success', body.values.changes || {});
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const formatted = formatAppError(error);
    logTechnicalError('PATCH /api/admin/apps/[id]/settings', error);

    if (adminId && appId) {
      await audit('update_app_settings', 'error', {
        category: formatted.category,
        code: formatted.code,
        technical: formatted.technical,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: formatted.message,
        category: formatted.category,
        code: formatted.code,
        technical: formatted.technical,
      },
      { status: getStatus(formatted.category) }
    );
  }
}
