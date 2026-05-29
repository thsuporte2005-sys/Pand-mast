# Pand mast

Sistema Next.js para criar apps privados de conteúdo, gerenciar alunos, liberar acessos por webhooks de checkout e publicar PWAs por slug.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra `http://localhost:3000/admin/login`.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Deploy

Veja [README_DEPLOY.md](./README_DEPLOY.md) para GitHub, Supabase, Vercel, migrations, variáveis de ambiente e checklist de produção.
