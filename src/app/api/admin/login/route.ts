import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getErrorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const credentials = adminLoginSchema.parse(body);
    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, error: 'E-mail ou senha inválidos.' },
        { status: 401 }
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('id, email')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (adminError) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: 'Não foi possível verificar o perfil administrativo.' },
        { status: 500 }
      );
    }

    if (!admin) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          ok: false,
          error:
            'Esta conta não possui acesso administrativo. Adicione o UID do usuário em public.admins.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: authData.user.id,
        email: authData.user.email ?? admin.email,
      },
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: err.issues[0]?.message ?? 'Dados de login inválidos.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
