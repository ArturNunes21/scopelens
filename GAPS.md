# Gap Register & Remediation Plan — ScopeLens

**Origem:** revisão crítica de CONTEXT.md/PRD.md/ARCHITECTURE.md/ROADMAP.md/TODO.md antes do início do desenvolvimento ativo.
**Como usar:** cada gap tem um ID (G#). Status muda conforme resolvido. Itens "Doc" são resolvíveis agora (Phase 0, sem infra provisionada). Itens "Infra"/"Runtime" só são verificáveis depois que a conta Supabase/Vercel existir (TODO Phase 0 #5).

## Registro

| ID | Gap | Impacto | Resolução | Tipo | Status |
|---|---|---|---|---|---|
| G1 | `findings.embedding vector(1536)` declarado sem `pgvector` habilitado — coluna não pode existir assim | Migration quebra no Phase 1 | Habilitar extensão `pgvector` agora, coluna fica nullable e sem uso até precisar | Doc | ✅ Resolvido |
| G2 | Nenhum índice definido (workspace_id, FKs, trigram) | RLS e recorrência lentos em produção | Adicionar índices no schema | Doc | ✅ Resolvido |
| G3 | RLS de `workspaces`/`workspace_members` não definida; policy padrão gera recursão se replicada nessas tabelas | Bloqueia Phase 1, risco de bug de segurança | Função `is_workspace_member()` `security definer`, usada em todas as policies | Doc | ✅ Resolvido |
| G4 | Sem `ON DELETE` nas FKs | Comportamento indefinido ao apagar meeting/workspace | `ON DELETE CASCADE` em tudo que pende de `meetings`/`workspaces` | Doc | ✅ Resolvido |
| G5 | `recurrence_group_id` às vezes null, às vezes self-id, às vezes root-id | Código de agregação cheio de `COALESCE` espalhado | Sempre preenchido (root aponta pra si mesma) | Doc | ✅ Resolvido |
| G6 | Sem `resolved_at`/histórico de status em `findings` | Phase 6 (trend ao longo do tempo) impossível de calcular | Adicionar `resolved_at`, `updated_at` | Doc | ✅ Resolvido |
| G7 | PRD/Roadmap falam em "trend across sprints" mas não existe entidade `sprint` | Ambiguidade de escopo pro Phase 6 | MVP não tem `sprints` — trend agrupado por `occorred_at` (semana/data). Termo trocado para "over time" | Doc | ✅ Resolvido |
| G8 | Trigger cria 1 workspace por signup — sem fluxo de convite pra time existente | Contradiz "workspace por time" do PRD seção 4 | Decisão explícita: fora da MVP, workspace é single-owner por enquanto; convite vira item pós-MVP | Doc | ✅ Resolvido |
| G9 | Padrão de auth nas API routes (client/key usado) indefinido | Bloqueia Phase 1 imediatamente | `@supabase/ssr` server client (sessão do usuário) para tudo que respeita RLS; service-role só no pipeline de IA, após validar membership com o client do usuário | Doc | ✅ Resolvido |
| G10 | Sem JSON schema dos 3 estágios de IA | Maior bloqueio de implementação do roadmap (Phase 3) | Contratos rascunhados em ARCHITECTURE.md §7 | Doc | ✅ Resolvido |
| G11 | Modelos por estágio não pinados | Impossível estimar custo/latência | IDs de modelo definidos por estágio (ver ARCHITECTURE.md §7) | Doc | ✅ Resolvido |
| G12 | Teto de custo (PRD 11.1) citado mas nunca implementado | Risco #4 do PRD sem mitigação técnica | Checagem de custo acumulado do workspace no mês antes do Stage 1; bloqueia com erro amigável acima do teto | Doc | ✅ Resolvido |
| G13 | Sem retry/timeout/falha parcial entre estágios | Pipeline pode travar em "processing" pra sempre | Retry pipeline = re-execução completa idempotente (limpa findings/notes anteriores do meeting antes de tentar de novo); 2 retries com backoff por chamada; falha final grava `error_message` | Doc | ✅ Resolvido |
| G14 | Lentes de diagnóstico ainda como "e.g." (não fechadas) | Dev inventaria no meio do Phase 5 | Fechadas: `contradiction`, `continuity`, `decision_gap` | Doc | ✅ Resolvido |
| G15 | `maxDuration` do Vercel free tier pode não cobrir as 3 chamadas encadeadas | Pode invalidar a decisão "sem queue" no Phase 5 | Fallback já desenhado (rota por estágio, ainda sem fila); validar valor real do plano quando a conta existir | Infra | 🔲 Pendente (aguarda conta Vercel) |
| G16 | GitHub Actions desabilita workflows agendados após 60 dias sem atividade — quebra o anti-pause do Supabase silenciosamente | Projeto Supabase pode dormir sem aviso | Rota `/api/health` criada + cron-job.org configurado apontando pra ela | Infra | ✅ Resolvido |
| G17 | Sem limite de tamanho de transcript nem rate limit de ingestão | Custo de IA pode explodir (risco #4 do PRD) | Limite de 50k caracteres por transcript na validação de upload; rate limit real fica pro feature gate do Phase 7 | Doc | ✅ Resolvido |
| G18 | Estratégia de Supabase Storage pro upload `.txt`/`.vtt` indefinida | Ambiguidade no Phase 2 | Decisão: MVP não usa Storage — arquivo é parseado no upload, só o texto vai pra `transcript_raw`, original é descartado | Doc | ✅ Resolvido |
| G19 | Sem política de retenção/exclusão de dado sensível | PRD seção 9 chama atenção pra sensibilidade, mas não protege nada disso | Apagar meeting/workspace cascateia tudo (via G4); sem retenção automática por tempo na MVP (decisão explícita, revisitar com usuários reais) | Doc | ✅ Resolvido |
| G20 | Verificação de assinatura/idempotência do webhook Stripe não especificada | Risco de segurança no Phase 7 | Requisito documentado: `stripe.webhooks.constructEvent` + dedupe por `event.id`; implementação no Phase 7 | Doc | ✅ Resolvido (requisito documentado, implementação no Phase 7) |

## Plano de remediação (ordem de execução)

**Etapa A — Agora (doc-only, sem infra), branch `chore/address-spec-review-gaps`:**
G1–G14, G17–G20 → ARCHITECTURE.md, PRD.md, ROADMAP.md atualizados nesta mesma branch.

**Etapa B — Ao criar a conta Supabase/Vercel (TODO Phase 0 #5):**
G15 (validar `maxDuration` real do plano), G16 (configurar pinger externo em vez de/além do GH Actions cron) → atualizar SETUP.md.

**Etapa C — Phase 1 (implementação):**
Migration SQL real aplicando G1–G6, RLS de G3, auth pattern de G9 — só depois que a conta Supabase existir e a migration puder ser testada de verdade.

**Etapa D — Phase 3:**
Implementar os contratos de IA de G10/G11/G14 e o enforcement de custo de G12/G13.

**Etapa E — Phase 7:**
Implementar G20 (webhook Stripe).

Nada nesta lista bloqueia o Phase 0 restante (criação de contas). A Etapa A já está sendo executada nesta branch.
