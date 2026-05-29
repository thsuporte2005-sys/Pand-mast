export type WebhookPlatform =
  | 'hotmart'
  | 'kiwify'
  | 'eduzz'
  | 'monetizze'
  | 'cakto'
  | 'cartpanda'
  | 'ticto';

const webhookSecretEnvNames: Record<WebhookPlatform, string> = {
  hotmart: 'WEBHOOK_SECRET_HOTMART',
  kiwify: 'WEBHOOK_SECRET_KIWIFY',
  eduzz: 'WEBHOOK_SECRET_EDUZZ',
  monetizze: 'WEBHOOK_SECRET_MONETIZZE',
  cakto: 'WEBHOOK_SECRET_CAKTO',
  cartpanda: 'WEBHOOK_SECRET_CARTPANDA',
  ticto: 'WEBHOOK_SECRET_TICTO',
};

export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
    );
  }

  return { url, publishableKey };
}

export function getSupabaseServiceRoleKey() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  return serviceRoleKey;
}

export function getWebhookSecret(platform: WebhookPlatform) {
  return process.env[webhookSecretEnvNames[platform]] || null;
}

export function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export function getEmailEnv() {
  return {
    resendApiKey: process.env.RESEND_API_KEY || null,
    emailFrom: process.env.EMAIL_FROM || null,
  };
}
