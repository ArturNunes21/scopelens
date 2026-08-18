# Contexto do Projeto: ScopeLens

> Este arquivo existe para dar contexto completo ao Claude Code (Cursor) sobre o projeto, sem precisar repetir tudo em prompt. Referencie com `@CONTEXT.md`.

## 1. Quem sou eu

Artur Nunes Oliveira Resende — estudante do último ano de Ciência da Computação (PUC Goiás), estagiário de Analytics Engineering na Indicium. Foco em modelagem de dados, ETL/ELT e Modern Data Stack (SQL avançado, Python intermediário, Snowflake, Databricks, dbt, Airflow, Power BI, Git/Bitbucket). Certificação Databricks Certified Data Analyst Associate.

**Como trabalhar comigo:** direto ao ponto, sem explicar conceitos básicos de dados/SQL/versionamento. Foco em decisões de design, eficiência, escalabilidade e código. Postura crítica — corrigir imediatamente se eu sugerir algo abaixo de boa prática de mercado.

## 2. Objetivo do projeto

Projeto de portfólio para vaga de dados, mostrando: uso prático de IA para construir produto de ponta a ponta, multidisciplinaridade (back, front, dados, segurança, IA), capacidade de ter uma ideia original a partir de demanda real de mercado, e noção de monetização/venda de produto.

**Importante:** o objetivo é experiência e portfólio, não necessariamente tração comercial real. Isso deve ser reconhecido de forma honesta na documentação e em entrevistas.

## 3. O produto: ScopeLens

### 3.1 O que é

ScopeLens é um **analista de projeto assistido por IA**. Ele recebe a transcrição de uma reunião (daily, planning, retro, kickoff) e não só resume — ele **analisa** o projeto como um analista técnico sênior faria: identifica o que está indo mal, o que está sendo dito nas entrelinhas, o que falta ser decidido, e o que provavelmente vai virar problema se ninguém agir.

### 3.2 Objetivo

Resolver dois problemas ao mesmo tempo:
1. **Barreira de linguagem** entre quem executa (dev) e quem decide/reporta (gestor, PM, stakeholder não-técnico).
2. **Cegueira de continuidade** — reuniões são eventos isolados; ninguém junta os pontos entre "esse bloqueio já apareceu na daily de segunda, quarta e hoje" ao longo do tempo. O ScopeLens é o "analista" que participa de todas as reuniões, lembra de todas as anteriores, e enxerga o padrão que ninguém tem tempo de rastrear manualmente.

### 3.3 O papel da IA no produto

A IA não é só um resumidor de texto. As funções centrais dela são:
- **Extrair** dados estruturados de uma conversa não-estruturada (bloqueios, riscos, dependências, decisões tomadas, decisões pendentes, responsáveis).
- **Traduzir** esses dados pra linguagem que um stakeholder não-técnico entende, sem perder a substância técnica.
- **Diagnosticar** — apontar falhas, riscos e dependências que não foram ditas explicitamente, mas que um analista experiente perceberia (ex: "dois participantes descreveram a mesma tarefa de formas incompatíveis" → risco de retrabalho).
- **Sugerir** próximos passos ou perguntas que o gestor deveria fazer antes da próxima reunião.
- **Acompanhar** a evolução de cada risco/bloqueio ao longo de várias reuniões, não só relatar o que aconteceu numa reunião isolada.

**Sobre o método de análise (decidido):** a ideia das "5 vozes" (contrário, first principles, expansionista, forasteiro, executor) citada nas conversas anteriores é uma **skill nativa do Claude**, usada só como referência de inspiração — não foi adotada como está. Decisão final: variação própria, com 2-3 lentes específicas de domínio (não as 5 personas genéricas), rodando em pipeline de 3 etapas com tiering de modelo — extração (barato) → diagnóstico multi-perspectiva (intermediário) → síntese executiva (robusto). Ver PRD.md seção 8.3 para justificativa completa.

### 3.4 Funcionalidades — MVP (Fase 1)

1. **Ingestão de reunião** — colar texto ou upload de `.txt`/`.vtt` de transcrição.
2. **Extração estruturada** — bloqueios, riscos, dependências, decisões e responsáveis identificados automaticamente.
3. **Resumo executivo** — tradução da reunião pra linguagem de negócio, sem jargão técnico.
4. **Análise diagnóstica** — a IA aponta riscos/falhas/dependências não ditas explicitamente (método de análise ainda em definição, ver 3.3).
5. **Sugestões acionáveis** — lista de próximos passos ou perguntas recomendadas pela IA.
6. **Histórico por workspace** — todas as reuniões analisadas ficam salvas e associadas ao projeto/time.
7. **Tracking de recorrência** — a IA cruza reuniões ao longo do tempo e sinaliza riscos/bloqueios que reaparecem (ex: "esse bloqueio já foi mencionado 3 vezes").
8. **Dashboard simples de tendência** — visão de riscos abertos vs. resolvidos ao longo das sprints.
9. **Autenticação e multi-tenancy** — cada time/empresa tem seu workspace isolado.

### 3.5 Visão de produto — pós-MVP (não compromissado ainda)

- Upload/gravação de áudio (fase 2, condicionado a validação do MVP em texto).
- Integração direta com Jira/Linear, cruzando dado de ticket com dado de reunião — esse cruzamento é um diferencial real frente a concorrentes que só usam um tipo de fonte (ver seção 4).
- Alertas proativos (ex: Slack) quando um risco atinge um número de recorrências.
- Camada de billing/planos pagos.

## 4. Pesquisa de mercado (resumo)

**Concorrentes diretos de notetaker:** Fireflies, Otter, Fathom, Granola, Zoom AI Companion, Read.ai. Mercado saturado, guerra de preço. Problemas relatados: resumos rasos/genéricos, imprecisão de transcrição, e risco jurídico real (ações BIPA contra Fireflies/Otter por gravação sem consentimento; Cornell bloqueia esses bots).

**Concorrente mais perigoso:** categoria "Software Engineering Intelligence" (Jellyfish, LinearB, Swarmia, GetDX, Faros AI) — já resolve "traduzir engenharia pra negócio" para CTO/VP, mas usando dados de Git/Jira/CI-CD (mais confiável que transcrição). Vendido enterprise (free tier até 6 dígitos/ano). Existe até um plugin de Jira ("Leiga") que já faz risco previsto + relatório de progresso com um clique, sem transcrição nenhuma.

**Decisão de posicionamento:** não competir como "dashboard de BI de engenharia" (perdido contra SEI platforms). Focar em "copiloto de decisão pontual" sobre reunião específica — o modo 5 vozes é o diferencial real, pouco coberto por concorrentes.

## 5. 10 riscos mapeados (pra mitigar ou reconhecer no roadmap)

1. Concorrência estabelecida (Jellyfish/LinearB/Swarmia) com fonte de dado mais confiável.
2. Mercado de notetaker saturado.
3. Comprador errado (quem sente a dor não decide orçamento).
4. Custo alto de falso positivo/negativo em "risco" identificado por IA.
5. Fricção de adoção (exigir colar transcrição / abrir outro site).
6. Dependência de terceiros pra qualidade da transcrição (Zoom/Meet/Teams).
7. Efeito "Big Brother" — resistência de devs se sentirem vigiados.
8. Ciclo de venda B2B lento.
9. Monetização fraca em squads pequenos.
10. Vantagem técnica replicável (LLMs generalistas já fazem 80% disso de graça).

## 6. Escopo do MVP (decisões já tomadas)

- **Sem ingestão de áudio no MVP.** Entrada é texto colado ou upload de `.txt`/`.vtt` — aproveita transcrição nativa gratuita de Zoom/Meet/Teams. Elimina custo de STT e problema de consentimento/gravação.
- **Áudio é feature de fase 2** (stretch goal), usando **Groq API** (Whisper Large v3 Turbo, tier gratuito generoso) se decidirmos incluir.
- **Estratégia de custo por chamada de IA (decidida):** pipeline de 3 etapas com tiering de modelo — extração estruturada (modelo barato/rápido) → diagnóstico multi-perspectiva com 2-3 lentes (modelo intermediário) → síntese executiva (modelo mais robusto, é o que o usuário efetivamente lê). Ver 3.3 e PRD.md seção 8.3.

## 7. Stack técnico — **DECIDIDO**

Princípio geral: free tier / test mode por padrão em toda a stack; upgrade pago é troca de configuração, não migração. Justificativa completa de cada escolha em PRD.md seção 10.

- Frontend/hosting: Vercel (free tier)
- Backend/DB/Auth: Supabase (free tier; RLS nativo atende requisito de isolamento por workspace; mitigação de sleep após 7 dias de inatividade via cron gratuito)
- Provedor de LLM: Claude (Anthropic API), com tiering de modelo por etapa do pipeline (ver seção 6)
- Billing: Stripe, em test mode até haver demanda paga real
- Observabilidade/erro: Sentry (free tier)
- Product analytics: PostHog (free tier; surveys nativos cobrem feedback, sem ferramenta extra)
- STT (fase 2, se necessário): Groq API
- Editor/dev: Cursor (Claude Code integrado)
- Versionamento: GitHub, repositório `scopelens`, público, license MIT, `.gitignore` template Node

**Adiado conscientemente, sem risco de retrabalho** (avaliado e justificado em PRD.md seção 10): vector DB (coberto por `pgvector` no próprio Supabase quando necessário), Redis/fila de jobs (não necessário — status na tabela + Supabase Realtime), DNS/domínio próprio (custo opcional, não é decisão de arquitetura), email transacional (Supabase Auth cobre o MVP; revisitar só na feature de alertas proativos pós-MVP).

## 8. Próximos passos

Ainda **não começamos a codar**. Estamos na fase de documentação/escopo dentro do repositório (Markdown), antes de qualquer implementação. Método de análise de IA e stack técnica já decididos (ver seções 3.3, 6 e 7). Próximo passo: documento de arquitetura técnica (schema de dados, fluxo ponta a ponta) em ARCHITECTURE.md, seguido de roadmap de implementação em fases.
