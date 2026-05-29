# Deploy do Pand mast

Este projeto usa Next.js 16, App Router, Supabase Auth/Database/Storage e Vercel.

## 1. Variáveis de ambiente

Cadastre estas variáveis localmente em `.env.local` e na Vercel:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_ADMIN_URL=
WEBHOOK_SECRET_HOTMART=
WEBHOOK_SECRET_KIWIFY=
WEBHOOK_SECRET_EDUZZ=
WEBHOOK_SECRET_MONETIZZE=
WEBHOOK_SECRET_CAKTO=
WEBHOOK_SECRET_CARTPANDA=
WEBHOOK_SECRET_TICTO=
RESEND_API_KEY=
EMAIL_FROM=
```

Somente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_ADMIN_URL` podem aparecer no cliente. Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, secrets de webhook ou `RESEND_API_KEY`.

## 2. Supabase

1. Crie um projeto no Supabase.
2. Copie a Project URL para `NEXT_PUBLIC_SUPABASE_URL`.
3. Copie a publishable key para `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Copie a service role key para `SUPABASE_SERVICE_ROLE_KEY`.
5. Aplique a migration:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

Se preferir SQL manual, rode o conteúdo de `supabase/migrations/20260529150000_production_baseline.sql` no SQL Editor.

A migration cria as tabelas principais, RLS, policies e os buckets:

- `public-media`: público, para logos e capas.
- `app-files`: privado, para PDFs, zips e arquivos sensíveis dos apps.

Primeiro admin seguro:

1. Crie o usuário admin em Supabase Auth.
2. Copie o UID do usuário.
3. Rode no SQL Editor:

```sql
insert into public.admins (id, email)
values ('UID_DO_AUTH_USER', 'admin@email.com');
```

## 3. GitHub

Depois de instalar as Command Line Tools do Xcode no macOS, inicialize o Git:

```bash
git init
git add .
git commit -m "Prepare Pand mast for production"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

O `.gitignore` já impede commit de `.env`, `.env.local`, `.vercel`, `.next`, `node_modules`, logs e chaves.

## 4. Vercel

1. Acesse a Vercel e clique em “Add New Project”.
2. Importe o repositório do GitHub.
3. Framework preset: Next.js.
4. Install Command: `npm install`.
5. Build Command: `npm run build`.
6. Cadastre todas as variáveis da seção 1 em Production, Preview e Development conforme necessário.
7. Faça o deploy.
8. Use o domínio padrão `https://seu-projeto.vercel.app` em `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_ADMIN_URL`.

Depois do primeiro deploy, configure as URLs de webhook nas plataformas:

- `/api/webhooks/hotmart`
- `/api/webhooks/kiwify`
- `/api/webhooks/eduzz`
- `/api/webhooks/monetizze`
- `/api/webhooks/cakto`
- `/api/webhooks/cartpanda`
- `/api/webhooks/ticto`

Envie o segredo correspondente em header `x-webhook-secret`, `x-{platform}-secret`, `x-{platform}-token`, `x-{platform}-signature`, `Authorization: Bearer ...` ou no campo `secret`/`webhook_secret` do payload.

## 5. Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Checks antes de produção:

```bash
npm run lint
npm run typecheck
npm run build
```

## 6. Checklist final

- [ ] Supabase migrations aplicadas.
- [ ] Primeiro admin inserido manualmente em `public.admins`.
- [ ] Buckets `public-media` e `app-files` criados.
- [ ] Variáveis cadastradas na Vercel.
- [ ] Webhook secrets configurados nas plataformas.
- [ ] `npm run lint`, `npm run typecheck` e `npm run build` passando.
- [ ] Login admin acessível em `/admin/login`.
- [ ] App final acessível em `/app/[slug]`.
- [ ] Webhooks aparecem em `/admin/webhooks`.
