# PRD — ScopeLens

**Documento de Requisitos de Produto/Técnico**
**Autor:** Artur Nunes Oliveira Resende
**Status:** Em planejamento — escopo de produto definido, arquitetura técnica em aberto
**Última atualização:** ver histórico de commits deste arquivo

---

## 1. Resumo Executivo

ScopeLens é um analista de projeto assistido por IA. A partir da transcrição de uma reunião de time (daily, planning, retro, kickoff), o produto extrai dados estruturados sobre o andamento do projeto, traduz isso para linguagem de negócio, diagnostica riscos e bloqueios — inclusive os não ditos explicitamente — e acompanha a recorrência desses problemas ao longo de múltiplas reuniões.

Este é um projeto de portfólio, não um produto com validação comercial. O objetivo declarado é demonstrar, de ponta a ponta, capacidade de: identificar uma dor real de mercado, pesquisar concorrência antes de construir, tomar decisões de arquitetura justificadas, e entregar um produto multidisciplinar (dados, IA, backend, frontend, segurança) usando ferramentas de IA como parte do próprio processo de trabalho.

## 2. Problema e Motivação

Dois problemas centrais, discutidos e validados por pesquisa (seção 5):

1. **Barreira de linguagem** entre quem executa (desenvolvedores) e quem decide/reporta (gestores, PMs não-técnicos) — jargão técnico não traduzido gera desalinhamento e decisões mal informadas.
2. **Cegueira de continuidade** — reuniões são tratadas como eventos isolados. Bloqueios e riscos recorrentes ao longo de várias reuniões raramente são cruzados manualmente, porque ninguém tem tempo de revisitar transcrições antigas pra achar o padrão.

## 3. Objetivos do Projeto

| Objetivo | Descrição |
|---|---|
| Portfólio técnico | Demonstrar competência multidisciplinar (dados, IA, backend, frontend, segurança) pra vagas de Engenharia de Dados/Analytics |
| Uso prático de IA | Mostrar fluência usando IA como ferramenta de trabalho real, não só como novidade |
| Validação de mercado | Provar capacidade de pesquisar concorrência e nichar uma ideia antes de construir |
| Monetização (aspiracional) | Estruturar o produto como se fosse vendável (billing, planos), mesmo sem meta de receita real no curto prazo |

**Fora de escopo como objetivo:** tração comercial real ou validação de product-market fit. Isso deve ser comunicado honestamente em entrevistas e na documentação pública do repositório.

## 4. Público-Alvo

- **Usuário direto:** gestores de projeto/PM não-técnicos e tech leads/scrum masters de squads ágeis pequenos e médios.
- **Comprador (quando aplicável):** ainda não definido com clareza — ver risco #3 na seção 7. Hipótese inicial é o próprio gestor de squad, não necessariamente C-level.

## 5. Pesquisa de Mercado e Concorrência

### 5.1 Concorrentes diretos (notetakers de reunião)
Fireflies, Otter, Fathom, Granola, Zoom AI Companion, Read.ai. Mercado saturado e com guerra de preço. Problemas relatados por usuários: resumos rasos/genéricos e imprecisão de transcrição. Existe também risco jurídico real no modelo de bot de gravação — ações judiciais (BIPA) contra Fireflies e Otter por gravação sem consentimento explícito, a ponto de instituições como Cornell bloquearem esses bots.

### 5.2 Concorrente mais relevante (categoria adjacente)
"Software Engineering Intelligence" — Jellyfish, LinearB, Swarmia, GetDX, Faros AI. Resolvem "traduzir engenharia pra negócio" para CTO/VP, mas usando dados de Git/Jira/CI-CD em vez de transcrição de reunião — fonte de dado mais confiável e estruturada. Modelo de venda enterprise (do free tier a contratos de seis dígitos/ano). Existe inclusive um plugin de Jira ("Leiga") que já gera relatório de progresso + risco previsto com um clique, sem depender de transcrição nenhuma.

### 5.3 Posicionamento decidido
ScopeLens não compete como dashboard de BI de engenharia (perderia contra as plataformas de SEI). O posicionamento é de **copiloto de decisão pontual** sobre uma reunião ou momento crítico específico do projeto — apoiando decisão, não substituindo métricas agregadas de entrega.

## 6. Proposta de Valor / Diferencial

- Cruzamento de múltiplas reuniões ao longo do tempo pra identificar recorrência de risco (não coberto pelos notetakers genéricos, que tratam cada reunião isoladamente).
- Fonte de dado qualitativa (conversa) complementar — não concorrente — à fonte de dado estruturada (ticket/commit) que as plataformas de SEI já exploram bem.
- Possibilidade futura de cruzar as duas fontes (reunião + ticket), o que nenhum concorrente mapeado faz hoje (ver seção 8.2).

## 7. Riscos Mapeados

| # | Risco | Notas |
|---|---|---|
| 1 | Concorrência estabelecida com fonte de dado mais confiável | Jellyfish/LinearB/Swarmia |
| 2 | Mercado de notetaker saturado | Guerra de preço, difícil diferenciação |
| 3 | Comprador errado | Quem sente a dor pode não decidir orçamento |
| 4 | Custo alto de falso positivo/negativo | Erro de diagnóstico de IA quebra confiança rápido |
| 5 | Fricção de adoção | Exigir colar transcrição / novo login compete com "perguntar no Slack" |
| 6 | Dependência de terceiros | Qualidade da transcrição depende de Zoom/Meet/Teams |
| 7 | Efeito "Big Brother" | Resistência de devs se sentirem vigiados/avaliados |
| 8 | Ciclo de venda B2B lento | Mesmo em produto simples, adoção institucional é lenta |
| 9 | Monetização fraca em squads pequenos | Squads grandes já têm orçamento pra SEI platforms |
| 10 | Vantagem técnica replicável | LLMs generalistas já cobrem boa parte do caso de uso básico |

**Mitigação geral:** manter o produto honesto sobre seu nicho (copiloto pontual, não plataforma de BI) e não superestimar potencial comercial na comunicação — tanto no produto quanto no portfólio.

## 8. Escopo do Produto

### 8.1 Funcionalidades — MVP (Fase 1)

| # | Funcionalidade | Descrição |
|---|---|---|
| 1 | Ingestão de reunião | Colar texto ou upload de `.txt` / `.vtt` de transcrição |
| 2 | Extração estruturada | Bloqueios, riscos, dependências, decisões e responsáveis identificados automaticamente |
| 3 | Resumo executivo | Tradução da reunião para linguagem de negócio, sem jargão técnico |
| 4 | Análise diagnóstica | IA aponta riscos/falhas/dependências não ditas explicitamente — **método de análise em aberto**, ver 8.3 |
| 5 | Sugestões acionáveis | Lista de próximos passos ou perguntas recomendadas pela IA |
| 6 | Histórico por workspace | Reuniões analisadas ficam salvas e associadas ao projeto/time |
| 7 | Tracking de recorrência | Cruzamento entre reuniões ao longo do tempo, sinalizando riscos/bloqueios recorrentes |
| 8 | Dashboard de tendência | Visão de riscos abertos vs. resolvidos ao longo das sprints |
| 9 | Autenticação e multi-tenancy | Cada time/empresa com workspace isolado |

### 8.2 Visão de produto — pós-MVP (não compromissado)

- Upload/gravação de áudio (condicionado à validação do MVP em texto)
- Integração com Jira/Linear, cruzando dado de ticket com dado de reunião
- Alertas proativos (ex: Slack) quando um risco atinge um número de recorrências
- Camada de billing/planos pagos

### 8.3 Método de análise da IA — decidido

**Decisão: variação própria, com lentes específicas de domínio (não a skill "5 vozes" nativa como está, nem um pipeline sem personas).**

Justificativa: a skill "5 vozes" foi desenhada pra brainstorming/avaliação de ideias em conversa, não pra extração estruturada de bloqueios/riscos/decisões — usá-la como está exigiria 6 chamadas completas (5 personas + síntese) com fit fraco pro domínio. Um pipeline sem personas seria mais barato, mas arrisca cair no mesmo problema dos concorrentes mapeados na seção 5.1 ("resumos rasos/genéricos") — a análise multi-perspectiva é o diferencial real do produto (seção 6). A variação própria preserva esse diferencial com lentes desenhadas pro caso de uso, e custo controlado via tiering de modelo.

Pipeline em 3 etapas:
1. **Extração** (modelo barato/rápido, structured output/JSON schema) — bloqueios, riscos, dependências, decisões, responsáveis.
2. **Diagnóstico multi-perspectiva** (modelo intermediário, 2-3 lentes específicas do domínio — ex.: contradição/risco não dito, continuidade histórica cruzando reuniões anteriores, lacuna de decisão) — pode rodar numa única chamada com output estruturado por lente, pra economizar custo.
3. **Síntese executiva** (modelo mais robusto) — traduz tudo pra linguagem de negócio + sugestões acionáveis; é o que o usuário efetivamente lê.

Provedor de LLM: ver seção 10.

## 9. Requisitos Não-Funcionais

- **Segurança e privacidade:** dado de reunião é sensível por natureza (pode conter informação de negócio, desempenho de indivíduos, decisões estratégicas). Isolamento de dados por workspace é requisito, não opcional.
- **Multi-tenancy:** arquitetura de dados deve suportar múltiplos times/empresas com isolamento na camada de banco (não só na aplicação).
- **Sem gravação de áudio no MVP:** decisão deliberada para evitar o problema de consentimento que afeta concorrentes (ver 5.1) e reduzir custo de infraestrutura.
- **Custo de IA controlado:** chamadas de IA devem ser desenhadas considerando custo/latência por etapa (extração simples vs. síntese final), independente do método final escolhido em 8.3.

## 10. Stack Técnica

**Status: decidida.**

**Princípio geral:** operar em free tier / test mode por padrão em toda a stack; todo upgrade pra plano pago é troca de configuração (chave de API, plano de billing), não migração de ferramenta ou dado. Isso mantém custo em $0/mês pro portfólio, mas não fecha a porta pra monetização real se surgir demanda.

| Camada | Escolha | Justificativa |
|---|---|---|
| Frontend/hosting | Vercel | Free tier generoso, deploy zero-config, integração nativa com Next.js |
| Backend/DB/Auth | Supabase | Postgres com RLS nativo — atende ao requisito de isolamento por workspace na camada de banco (seção 9), não só aplicação. Auth integrado. **Ponto de atenção:** projeto free tier pausa após 7 dias sem request — mitigado com cron gratuito (GitHub Actions ou similar) fazendo ping periódico; sem custo adicional |
| Provedor de LLM | Claude (Anthropic API) | Necessário formalizar explicitamente — as 3 etapas do pipeline de IA (seção 8.3) rodam sobre a Claude API, com tiering de modelo por etapa (custo controlado por chamada) |
| Billing | Stripe | Padrão de mercado, mais reconhecido em entrevista técnica. Operar em test mode (chaves `sk_test_`) até haver demanda real de pagamento; virar `sk_live_` é troca de chave, sem mudança de código |
| Observabilidade/erro | Sentry | Free tier cobre o volume do projeto; demonstra competência de observabilidade distinta do resto da stack |
| Product analytics | PostHog | Free tier (1M eventos/mês); cobre funil de uso real (ingestão → análise → dashboard), não só pageview. Inclui surveys/feedback widget nativo — cobre necessidade de feedback sem ferramenta extra |
| STT (fase 2, se necessário) | Groq API | Whisper Large v3 Turbo, tier gratuito generoso |

**Áreas avaliadas e conscientemente adiadas** (não são lacuna de arquitetura — são aditivas, sem risco de retrabalho, e várias já cobertas de graça pela stack acima):
- **Vector DB:** não precisa de ferramenta nova — Supabase roda `pgvector` como extensão nativa do Postgres. MVP usa matching estruturado simples (`pg_trgm`) pra recorrência de risco; pgvector liga depois, no mesmo banco, sem migração.
- **Redis/fila de jobs:** não necessário pro volume esperado. Pipeline assíncrono resolvido com campo `status` na tabela de reunião + Supabase Realtime pro frontend, sem infra extra.
- **DNS/domínio próprio:** não é decisão de arquitetura, é custo opcional (~US$12/ano) a ser feito quando o produto estiver pronto pra ser mostrado.
- **Email transacional:** Supabase Auth já cobre magic link/reset por padrão pro MVP. Revisitar (Resend ou Postmark, free tier generoso) só quando a feature de alertas proativos (pós-MVP, seção 8.2) for implementada.

Já decidido (ferramentas de processo, não de arquitetura do produto):
- Versionamento: GitHub, repositório `scopelens`, público, license MIT
- Editor/desenvolvimento assistido por IA: Cursor + Claude Code

## 11. Métricas de Sucesso

Dado que o objetivo primário é portfólio (seção 3), métricas de sucesso não são de receita/tração, mas de completude e qualidade técnica:
- Produto funcional ponta a ponta (ingestão → análise → dashboard) implantado e acessível publicamente
- Decisões de arquitetura documentadas e justificáveis em entrevista técnica
- Cobertura das áreas multidisciplinares propostas: modelagem de dados, orquestração de IA, segurança (RLS/multi-tenancy), frontend, billing

### 11.1 Critério de sucesso técnico mensurável do MVP

Complementa as métricas qualitativas acima com limiares concretos, verificáveis por fase (detalhamento por fase em ROADMAP.md):

| Critério | Limiar |
|---|---|
| Isolamento de tenant | Teste automatizado de cross-tenant leak passando (zero exceções) — não é aceito validar isso só por revisão de código |
| Precisão de recorrência | Zero falsos positivos no conjunto sintético de teste (agrupar achados genuinamente distintos é o erro mais caro, risco #4) |
| Latência do pipeline de IA | Análise completa (3 etapas) de uma transcrição de tamanho típico (~30-45 min de reunião) em menos de 60s, do ponto de vista do usuário |
| Custo por análise | Custo total das 3 chamadas de IA por reunião analisada, medido via `ai_calls`, mantido abaixo de um teto definido em Fase 3 do roadmap (referência inicial: sob US$0,10/reunião) |
| Disponibilidade pública | Produto acessível sem necessidade de setup do avaliador — workspace de demonstração navegável (Fase 8 do roadmap) |

## 12. Decisões em Aberto / Próximos Passos

1. ~~Definir método de análise de IA (seção 8.3)~~ — decidido
2. ~~Avaliar e decidir stack técnica (seção 10)~~ — decidido
3. ~~Desenhar schema de dados~~ — ver ARCHITECTURE.md
4. ~~Desenhar fluxo de dados ponta a ponta~~ — ver ARCHITECTURE.md
5. ~~Definir critério de sucesso técnico mensurável para o MVP~~ — ver seção 11.1

Nenhuma decisão de planejamento em aberto no momento. Próximo passo é execução conforme ROADMAP.md, Fase 0.

## 13. Histórico de Decisões

| Data/Etapa | Decisão |
|---|---|
| Ideação | Escolhida a fusão das ideias "tradução para gestores" + "análise de projeto" sobre "buscador de vagas" |
| Pesquisa de mercado | Identificados concorrentes diretos (notetakers) e adjacentes (SEI platforms); posicionamento ajustado para "copiloto pontual" |
| Escopo MVP | Removida ingestão de áudio do MVP; ingestão via texto/transcrição nativa de ferramentas de call |
| Nome | Definido "ScopeLens" |
| Repositório | Criado `scopelens`, público, MIT, `.gitignore` Node |
| Ambiente de trabalho | Definido uso de Cursor + Claude Code para desenvolvimento assistido |
| Método de análise de IA | Variação própria com lentes específicas de domínio (extração → diagnóstico multi-perspectiva → síntese), não a skill "5 vozes" nativa nem pipeline sem personas — ver seção 8.3 |
| Stack técnica | Vercel + Supabase + Claude API + Stripe (test mode) + Sentry + PostHog, todos em free tier/test mode com upgrade sem migração — ver seção 10 |
