import { getAppBaseUrl, getEmailEnv } from '@/lib/env';

interface AccessEmailInput {
  email: string;
  name: string | null;
  appName: string;
  loginPath: string;
  actionLink: string | null;
}

export async function sendAccessEmail(input: AccessEmailInput) {
  const { resendApiKey, emailFrom } = getEmailEnv();

  if (!resendApiKey || !emailFrom || !input.actionLink) {
    return { sent: false, reason: 'E-mail não configurado ou link de acesso indisponível.' };
  }

  const loginUrl = `${getAppBaseUrl()}${input.loginPath}`;
  const subject = `Seu acesso ao ${input.appName} foi liberado`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #071A2F;">
      <h1 style="font-size: 20px;">Acesso liberado</h1>
      <p>Olá${input.name ? `, ${input.name}` : ''}.</p>
      <p>Seu acesso ao <strong>${input.appName}</strong> foi liberado.</p>
      <p>Use o botão abaixo para criar ou redefinir sua senha com segurança.</p>
      <p><a href="${input.actionLink}" style="display:inline-block;background:#1E6BFF;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Criar senha de acesso</a></p>
      <p>Depois, acesse: <a href="${loginUrl}">${loginUrl}</a></p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: input.email,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `Resend retornou HTTP ${response.status}.` };
  }

  return { sent: true, reason: null };
}
