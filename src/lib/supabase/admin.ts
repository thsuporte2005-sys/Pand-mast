import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { getPublicSupabaseEnv, getSupabaseServiceRoleKey } from '@/lib/env';

let adminClient: SupabaseClient | null = null;

export const createAdminClient = () => {
  if (adminClient) {
    return adminClient;
  }

  const { url } = getPublicSupabaseEnv();
  const serviceKey = getSupabaseServiceRoleKey();

  adminClient = createSupabaseClient(
    url,
    serviceKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return adminClient;
};
