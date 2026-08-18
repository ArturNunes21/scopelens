# ScopeLens

Analista de projeto assistido por IA — a partir da transcrição de uma reunião de time (daily, planning, retro, kickoff), extrai dados estruturados sobre o andamento do projeto, traduz isso para linguagem de negócio, diagnostica riscos e bloqueios (inclusive os não ditos explicitamente) e acompanha a recorrência desses problemas ao longo de múltiplas reuniões.

Projeto de portfólio, não um produto com validação comercial — o objetivo é demonstrar, de ponta a ponta, capacidade de identificar uma dor real de mercado, pesquisar concorrência antes de construir, tomar decisões de arquitetura justificadas, e entregar um produto multidisciplinar (dados, IA, backend, frontend, segurança).

## Documentação

- [`PRD.md`](./PRD.md) — problema, pesquisa de mercado, escopo, decisões de produto e stack
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — schema de dados e fluxo ponta a ponta
- [`ROADMAP.md`](./ROADMAP.md) — fases de implementação
- [`CONTEXT.md`](./CONTEXT.md) — contexto do autor e do projeto (referência para desenvolvimento assistido por IA)

## Stack

Next.js (Vercel) · Supabase (Postgres/Auth/Realtime) · Claude API (Anthropic) · Stripe · Sentry · PostHog — detalhes e justificativa em `PRD.md` seção 10.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher com chaves reais — ver comentários no arquivo
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

Outros scripts: `npm run lint`, `npm run typecheck`, `npm run build`.

## Status

Em desenvolvimento — escopo e arquitetura fechados (ver documentação acima), Fase 0 do roadmap em andamento. Nenhuma feature de produto implementada ainda.
