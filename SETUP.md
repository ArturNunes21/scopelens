# Setup de Contas e Credenciais

Passo a passo pra desbloquear a Fase 0 do ROADMAP.md (e o que vem depois). Cada seção diz onde clicar e em qual variável do `.env.example` colar o resultado. Nenhuma dessas contas foi criada ainda.

## Ordem recomendada

Os quatro primeiros itens desbloqueiam a Fase 0. Os dois últimos só entram nas Fases 3 e 7 — pode deixar pra depois.

### 1. Vercel (hosting)

1. Acesse [vercel.com](https://vercel.com) → **Sign Up** → entrar com a conta GitHub `ArturNunes21`.
2. **Add New → Project** → selecione o repositório `scopelens`.
3. Vercel detecta Next.js automaticamente. Não precisa configurar nada extra ainda — nenhuma env var é obrigatória pro primeiro deploy (Sentry/PostHog ficam inertes sem chave).
4. **Deploy.** Isso já gera a URL pública (ex.: `scopelens.vercel.app`).
5. Depois de mesclado o PR na `main`, todo push nela vira deploy de produção automaticamente; outras branches geram preview deploy.

### 2. Supabase (banco/auth)

1. Acesse [supabase.com](https://supabase.com) → **Sign Up** com GitHub.
2. **New Project** → escolha nome (`scopelens`), senha do banco (guarde), região mais próxima.
3. Aguarde provisionar (~2 min).
4. Vá em **Project Settings → API** e copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (nunca expor no client)

### 3. Sentry (erro)

1. Acesse [sentry.io](https://sentry.io) → **Sign Up**.
2. **Create Project** → plataforma **Next.js**.
3. A tela pós-criação mostra o **DSN** (`https://...@...ingest.sentry.io/...`).
4. Cole o mesmo valor em `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN`.

### 4. PostHog (analytics)

1. Acesse [posthog.com](https://posthog.com) → **Sign Up** (escolha região US ou EU — isso muda o host).
2. Crie um projeto (`scopelens`).
3. Vá em **Project Settings → Project API Key**, copie:
   - a chave → `POSTHOG_KEY` e `NEXT_PUBLIC_POSTHOG_KEY`
   - o host da região escolhida → `POSTHOG_HOST` e `NEXT_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com` ou `https://eu.i.posthog.com`)

### 5. Anthropic / Claude API (Fase 3 — extração de IA, não bloqueia Fase 0)

1. Acesse [console.anthropic.com](https://console.anthropic.com) → criar conta.
2. **API Keys → Create Key**.
3. Cole em `ANTHROPIC_API_KEY`.

### 6. Stripe (Fase 7 — billing, não bloqueia Fase 0)

1. Acesse [dashboard.stripe.com](https://dashboard.stripe.com) → criar conta.
2. Certifique-se que o toggle **Test mode** está ativo (canto superior).
3. **Developers → API keys**, copie as chaves de teste (`sk_test_...`, `pk_test_...`) para `STRIPE_SECRET_KEY` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. `STRIPE_WEBHOOK_SECRET` só é gerado quando o endpoint de webhook existir (fica pra quando a Fase 7 for implementada).

## Depois de coletar as chaves

Duas cópias precisam existir:
- **Local:** `.env.local` na raiz do repo (nunca commitado — já está no `.gitignore`).
- **Vercel:** Project Settings → Environment Variables, colar as mesmas chaves (senão o deploy de produção não tem acesso a elas).

Depois de preenchido, me avise — eu confirmo que o app reconhece as variáveis (Sentry/PostHog saem do modo inerte) e seguimos pro resto da Fase 0.
