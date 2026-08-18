# Roadmap de Implementação — ScopeLens

**Depende de:** PRD.md, ARCHITECTURE.md
**Princípios que guiam a ordem das fases:**
- Instrumentar (erro + analytics) antes de escrever lógica de produto, não depois — mais barato de fazer cedo do que retroativamente.
- Fatia vertical por fase: cada fase entrega algo que roda ponta a ponta e é deployável, não uma camada isolada (ex.: não "todo o schema primeiro, toda a UI depois").
- RLS e isolamento de tenant são testados explicitamente assim que existem — é requisito de segurança (PRD seção 9), não detalhe de implementação a validar depois.
- IA entra em 3 fases separadas (extração → recorrência → diagnóstico/síntese), na mesma ordem de custo crescente definida em ARCHITECTURE.md — cada uma testável isoladamente antes de encadear a próxima.
- Billing é a fase mais tardia por decisão do PRD (8.2, pós-MVP) — infraestrutura de pagamento só depois do produto central provar que funciona.

---

## Fase 0 — Fundação e instrumentação

**Objetivo:** esqueleto do projeto deployado publicamente desde o primeiro dia, com observabilidade já ligada.

- Scaffold Next.js, deploy inicial no Vercel (página vazia já no ar).
- Projeto Supabase criado; ferramenta de migration versionada no repo (Supabase CLI).
- Sentry e PostHog integrados desde já — captura erro e evento mesmo sem features reais ainda.
- CI básico: lint + typecheck (+ testes, conforme forem existindo) rodando em PR.

**Definition of done:** URL pública no ar, erro proposital em produção aparece no Sentry, um evento de pageview aparece no PostHog.

## Fase 1 — Autenticação e multi-tenancy

**Objetivo:** base de isolamento por workspace, que é requisito não-funcional (PRD seção 9), não feature opcional.

- Supabase Auth (magic link), trigger de criação automática de `workspace` + `workspace_members(owner)` no primeiro signup.
- RLS habilitado em todas as tabelas de domínio (mesmo antes delas terem dado real).

**Definition of done:** teste automatizado que cria dois workspaces com usuários diferentes e confirma que um usuário **não consegue ler dado do outro workspace** via query direta — não é suficiente confiar que a política SQL "parece certa".

## Fase 2 — Ingestão de reunião (sem IA)

**Objetivo:** validar o caminho de dado ponta a ponta antes de acoplar custo de IA.

- UI de colar texto / upload `.txt`/`.vtt`.
- `meetings` criada com `status='pending'`, listagem/histórico por workspace (feature 6 do PRD, parcial).

**Definition of done:** reunião aparece na listagem do workspace certo, isolada de outros workspaces (reusa o teste de RLS da Fase 1).

## Fase 3 — Extração estruturada (etapa 1 do pipeline de IA)

**Objetivo:** primeira chamada real à Claude API, isolada e testável antes de encadear as próximas.

- Integração com Claude API, structured output/JSON schema.
- Populamento de `findings` (bloqueios/riscos/dependências/decisões).
- Log em `ai_calls` (tokens, latência) — visibilidade de custo desde a primeira chamada, não retroativa.

**Definition of done:** reunião de teste gera findings corretos nos 4 tipos, custo da chamada visível em `ai_calls`.

## Fase 4 — Recorrência entre reuniões

**Objetivo:** feature 7 do PRD (diferencial de continuidade) — implementada e testada separadamente da IA, porque é lógica determinística (matching), não geração.

- Matching por `pg_trgm` contra findings abertos do mesmo workspace/tipo.
- Atribuição de `recurrence_group_id`.

**Definition of done:** conjunto de reuniões sintéticas com o "mesmo" bloqueio descrito de formas diferentes é corretamente agrupado; bloqueios genuinamente distintos não são agrupados por engano (falso positivo é o erro mais caro aqui — risco #4 do PRD).

## Fase 5 — Diagnóstico multi-perspectiva e síntese (etapas 2-3)

**Objetivo:** fechar o pipeline completo de 3 etapas e o diferencial real do produto (seção 6 do PRD).

- Lentes de diagnóstico (2-3, específicas de domínio) → `diagnostic_notes`.
- Síntese executiva → `meetings.executive_summary` + `suggested_actions`.
- Fluxo assíncrono completo: `status` na tabela + Supabase Realtime no frontend (ARCHITECTURE.md seção 3).

**Definition of done:** usuário cola transcrição e, sem dar refresh, vê o status mudar de pending → processing → completed com resumo executivo, achados, diagnóstico e ações sugeridas renderizados.

## Fase 6 — Dashboard de tendência

**Objetivo:** feature 8 do PRD — visão agregada, não mais reunião-a-reunião.

- Query agregada por `recurrence_group_id`: riscos abertos vs. resolvidos ao longo do tempo.

**Definition of done:** dashboard reflete corretamente o estado de um workspace com múltiplas reuniões e ao menos um risco recorrente resolvido.

## Fase 7 — Billing

**Objetivo:** demonstrar capacidade de monetização (objetivo do PRD seção 3), sem bloquear o MVP core nisso.

- Stripe Checkout em test mode, webhook atualizando `workspaces.plan`.
- Gate de feature simples (ex.: limite de reuniões/mês no free) checado na API route.

**Definition of done:** upgrade de plano via Checkout de teste reflete no `workspaces.plan` e libera o gate correspondente.

## Fase 8 — Hardening para portfólio público

**Objetivo:** o produto precisa sobreviver ao primeiro contato de um recrutador sem supervisão.

- Estados vazios, estados de erro, dado de demonstração seedado (workspace de exemplo navegável sem precisar colar transcrição).
- README do repositório contando a história do projeto (problema, pesquisa de mercado, decisões de arquitetura, honestidade sobre ser portfólio — PRD seção 3.2).
- Domínio próprio (opcional, custo baixo — ver ARCHITECTURE.md/PRD seção 10).

**Definition of done:** alguém sem contexto acessa o link, entende o que é em 30 segundos, e consegue ver o produto funcionando sem precisar de dado próprio.

---

## Fora deste roadmap (pós-MVP, PRD seção 8.2)

Áudio, integração Jira/Linear, alertas proativos — deliberadamente não sequenciados aqui; entram como fases novas só depois do MVP validado.
