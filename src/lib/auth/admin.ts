import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

type AdminCheckResult =
  | { ok: true; user: User }
  | { ok: false; status: 401 | 403; message: string };

export async function requireAdminUser(): Promise<AdminCheckResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, message: 'Sessão administrativa inválida.' };
  }

  const { data: admin, error: adminError } = await supabase
    .from('admins')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return { ok: false, status: 403, message: 'Acesso administrativo negado.' };
  }

  return { ok: true, user };
}
