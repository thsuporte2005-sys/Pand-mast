import type { AppErrorCategory } from '@/lib/errors';

export type AppConfigurationAction =
  | 'general'
  | 'appearance'
  | 'pwa'
  | 'support'
  | 'branding'
  | 'carousel'
  | 'audit';

interface ConfigurationResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  category?: AppErrorCategory;
  code?: string | null;
  technical?: string;
}

export async function saveAdminAppConfiguration<T = unknown>(
  appId: string,
  action: AppConfigurationAction,
  values: Record<string, unknown>
) {
  const response = await fetch(`/api/admin/apps/${appId}/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, values }),
  });
  const payload = (await response.json().catch(() => ({}))) as ConfigurationResponse<T>;

  if (!response.ok || !payload.ok) {
    throw {
      message: payload.error || 'Falha ao salvar configuração.',
      category: payload.category,
      code: payload.code,
      details: payload.technical,
    };
  }

  return payload.data;
}
