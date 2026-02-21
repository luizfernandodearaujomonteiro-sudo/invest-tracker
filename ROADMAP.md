# InvestTracker - Roadmap de Melhorias

> Analise completa do projeto realizada em 21/02/2026.
> 97 arquivos lidos, 11 migrations, 42 issues identificados.

---

## BUGS

### BUG-07: Trigger calcula preco medio errado apos venda parcial [CRITICAL]
- **Arquivo:** `supabase/migrations/001_create_tables.sql` (linhas 167-206)
- **Problema:** O trigger `invest_recalculate_holding` calcula `avg_price = total_cost / total_qty` onde `total_cost = sum(buys) - sum(sells)`. Isso esta errado - vendas reduzem quantidade mas NAO devem reduzir o custo usado no calculo do preco medio. Exemplo: compra 100 acoes a R$10 (custo=R$1000), vende 50 a R$15 (total_value=R$750). Trigger calcula: total_cost = 1000-750 = R$250, total_qty = 50, avg_price = R$5.00. O correto seria manter R$10.00.
- **Correcao:** Reescrever trigger para calcular preco medio ponderado usando apenas transacoes de compra: `avg_price = SUM(buy_total_value) / SUM(buy_quantity)`. Vendas so reduzem `total_quantity`.

### BUG-04: rentBruta e rentComProventos dos FIIs usam mesma formula [HIGH]
- **Arquivo:** `src/components/portfolio/PortfolioTable.tsx` (linhas 177-191)
- **Problema:** Ambas funcoes retornam `((profitLoss + dividendsAccumulated) / totalInvested) * 100`. A "Rent. Bruta" deveria mostrar apenas ganho de capital (sem dividendos).
- **Correcao:** `rentBruta = (profitLoss / totalInvested) * 100` (capital gain), `rentComProventos = ((profitLoss + dividendsAccumulated) / totalInvested) * 100`.

### BUG-05: CSV/XP import cria duplicatas ao reimportar [HIGH]
- **Arquivos:** `src/components/transactions/CsvImportDialog.tsx` (linhas 160-243), `XpImportDialog.tsx` (linhas 151-236)
- **Problema:** Nenhum dos imports verifica duplicatas. Reimportar o mesmo arquivo duplica todas as transacoes e dobra as quantidades via trigger.
- **Correcao:** Antes de inserir, verificar transacao existente com matching `holding_id`, `executed_at`, `total_value`, `type`. Mostrar aviso para duplicatas.

### BUG-08: Fee inconsistente para crypto/US [MEDIUM]
- **Arquivo:** `src/components/transactions/TransactionForm.tsx` (linhas 162-166)
- **Problema:** `totalValue` para crypto/US inclui fees (`totalPaid + fees`), mas `price_per_unit` e calculado sem fees. O trigger usa `total_value` para calcular preco medio, que agora inclui fees, inflando o calculo.
- **Correcao:** Garantir semantica consistente: `total_value = quantity * price_per_unit` sempre (fees separado), ou documentar que total_value inclui fees e ajustar trigger.

### BUG-03: setState durante render no PortfolioTable [MEDIUM]
- **Arquivo:** `src/components/portfolio/PortfolioTable.tsx` (linhas 140-149)
- **Problema:** `setCollapsedCategories(allKeys)` e `setInitialized(true)` sao chamados durante o render (fora de useEffect), causando re-render desnecessario.
- **Correcao:** Mover logica de inicializacao para `useEffect` ou `useState` initializer.

### BUG-06: AURA33 classificado como br_stock [LOW]
- **Arquivo:** `supabase/migrations/007_seed_all_assets_expanded.sql` (linha 19)
- **Problema:** `AURA33` e um BDR mas esta como `br_stock`. Regex do `detectBrAssetType` nao cobre sufixo 33.
- **Correcao:** Mudar tipo no seed para `br_bdr`. Atualizar regex em `src/lib/api/brapi.ts` linha 41 para incluir sufixo 33.

---

## SEGURANCA

### SEC-01: API routes sem autenticacao [HIGH]
- **Arquivos:** `src/app/api/prices/route.ts`, `src/app/api/search/route.ts`, `src/app/api/seed-assets/route.ts`, `src/app/api/seed-us-assets/route.ts`
- **Problema:** Usam service role key (bypassa RLS) mas NAO verificam se o caller e autenticado. Qualquer pessoa que descubra a URL pode consumir quotas de API ou inserir dados.
- **Correcao:** Adicionar verificacao de autenticacao no topo de cada route. Para seed routes, adicionar check de admin ou token secreto.

### SEC-04: wallet-sync nao verifica dono do broker [HIGH]
- **Arquivo:** `src/app/api/wallet-sync/route.ts`
- **Problema:** Aceita `userId` do body do request. Usando service role key, um atacante poderia criar holdings na conta de outro usuario.
- **Correcao:** Extrair usuario autenticado da session (nao do body). Verificar que `brokerId` pertence ao usuario.

### SEC-03: Imports fazem writes diretos pelo client [MEDIUM]
- **Arquivos:** `src/components/transactions/CsvImportDialog.tsx`, `XpImportDialog.tsx`
- **Problema:** Dialogs de import usam client-side Supabase para inserir holdings e transacoes diretamente, sem validacao server-side.
- **Correcao:** Mover logica de import para API route server-side (similar ao `/api/holdings/import`).

### SEC-02: Non-null assertions em env vars [LOW]
- **Arquivos:** `src/lib/supabase/client.ts`, todas as `getSupabase()` em API routes
- **Problema:** `process.env.NEXT_PUBLIC_SUPABASE_URL!` usa `!`. Se env var estiver faltando, o app crasha sem mensagem util.
- **Correcao:** Adicionar validacao runtime: `if (!url) throw new Error("Missing env var")`.

---

## PERFORMANCE

### PERF-01: N+1 queries nos imports CSV/XP [HIGH]
- **Arquivos:** `src/components/transactions/CsvImportDialog.tsx` (linhas 160-243), `XpImportDialog.tsx` (linhas 151-236)
- **Problema:** Cada linha e processada sequencialmente com queries individuais ao DB. Para CSV de 100 linhas, sao 200-300 round-trips.
- **Correcao:** Batchar operacoes: buscar todos assets de uma vez, criar holdings faltantes em batch, inserir todas transacoes com um unico `insert([...allTransactions])`.

### PERF-02: Chamadas de preco sem rate limiting [HIGH]
- **Arquivo:** `src/app/api/prices/route.ts` (linhas 66-126)
- **Problema:** `Promise.allSettled` dispara todas as chamadas simultaneamente. Com 30+ US stocks, Finnhub (60 req/min) retorna 429.
- **Correcao:** Implementar concurrency limiter (chunks de 5-10 com delay entre batches). Agrupar por provider e aplicar limites por provider.

### PERF-03: API calls sequenciais no usePortfolio [MEDIUM]
- **Arquivo:** `src/hooks/usePortfolio.ts` (linhas 44-218)
- **Problema:** Apos carregar holdings, faz 4 chamadas sequenciais (prices, fixed-income, funds/nav, dividends). Sao independentes mas rodam em sequencia.
- **Correcao:** Usar `Promise.all()` para buscar prices, fixed-income, fund NAVs e dividendos em paralelo.

### PERF-04: CVM fund registry baixa ZIP de 6MB inteiro a cada sync [LOW]
- **Arquivo:** `src/app/api/funds/sync-registry/route.ts`
- **Problema:** Deleta tudo e re-insere 30k+ rows a cada sync. Pode dar timeout.
- **Correcao:** Sync incremental: verificar `synced_at`, usar upsert em vez de delete-all + re-insert.

### PERF-05: usePortfolio refetch a cada 60s em todas as paginas [LOW]
- **Arquivo:** `src/hooks/usePortfolio.ts` (linha 43)
- **Problema:** Polling continua mesmo em paginas nao-portfolio (settings, brokers).
- **Correcao:** Adicionar `refetchIntervalInBackground: false` para parar quando tab nao esta visivel.

---

## UX/UI

### UX-06: Nao e possivel editar transacoes [MEDIUM]
- **Arquivo:** `src/app/(app)/transactions/page.tsx`
- **Problema:** So tem adicionar e deletar. Erro de digitacao obriga deletar e recriar (dispara trigger 2x).
- **Correcao:** Adicionar botao de editar que abre TransactionForm pre-populado. Usar UPDATE em vez de DELETE+INSERT.

### UX-01: Sem loading enquanto precos sao buscados [MEDIUM]
- **Arquivo:** `src/app/(app)/dashboard/page.tsx` (linhas 14-23)
- **Problema:** Apos carregar holdings (rapido), buscar precos leva 2-5s. Usuario ve valores zerados/stale sem indicador visual.
- **Correcao:** Adicionar "Atualizando precos..." ou shimmer effect nos cards durante fetch de precos.

### UX-07: Renda fixa mostra "--" para quantidade [LOW]
- **Arquivo:** `src/components/portfolio/PortfolioTable.tsx` (linhas 281-283)
- **Problema:** Coluna Qtd mostra "--", P. Atual mostra "CDI 100%". Semanticamente diferente dos outros tipos.
- **Correcao:** Mostrar "1 aplicacao" ou formato dedicado para renda fixa.

### UX-02: Delecao de transacao usa confirm() nativo [LOW]
- **Arquivo:** `src/app/(app)/transactions/page.tsx`
- **Problema:** Usa `confirm()` do browser em vez de dialog shadcn como no resto do app.
- **Correcao:** Usar inline confirmation pattern consistente com PortfolioTable.

### UX-04: navItems duplicado entre Sidebar e Header [LOW]
- **Arquivos:** `src/components/shared/Sidebar.tsx` (linhas 23-30), `Header.tsx` (linhas 32-39)
- **Correcao:** Extrair para `src/lib/utils/constants.ts`.

### UX-05: Sidebar nao destaca sub-rotas [LOW]
- **Arquivo:** `src/components/shared/Sidebar.tsx` (linha 58)
- **Problema:** Active state usa match exato. `/asset/PETR4` nao destaca nada.
- **Correcao:** Usar `pathname.startsWith(item.href)`.

---

## CODE QUALITY

### CQ-04: getSupabase() copiado em 13+ arquivos [MEDIUM]
- **Arquivos:** Todos os API routes
- **Correcao:** Criar `src/lib/supabase/service.ts` com `getServiceClient()` compartilhado.

### CQ-03: ImportPositionDialog com ~1247 linhas [MEDIUM]
- **Arquivo:** `src/components/portfolio/ImportPositionDialog.tsx`
- **Correcao:** Quebrar em sub-componentes: `MarketSelector`, `AssetSearchField`, `FixedIncomeFields`, `USAssetFields`, `FundFields`.

### CQ-06: Nenhum Error Boundary [MEDIUM]
- **Arquivo:** `src/app/(app)/layout.tsx`
- **Problema:** Erro em qualquer componente crasha a pagina inteira com tela de erro generica do Next.js.
- **Correcao:** Adicionar `error.tsx` nos route groups `(app)` e `(auth)` com mensagem amigavel e botao retry.

### CQ-01: Type casts `as unknown as` em usePortfolio [MEDIUM]
- **Arquivo:** `src/hooks/usePortfolio.ts` (linhas 74, 96-97)
- **Correcao:** Gerar types do Supabase com `supabase gen types typescript` ou usar Zod para validar runtime.

### CQ-05: Magic numbers espalhados (CACHE_TTL nao usado) [LOW]
- **Arquivos:** `usePortfolio.ts` (60000), `prices/route.ts` (5*60*1000), `brapi.ts` (300), `finnhub.ts` (60), `coingecko.ts` (300)
- **Correcao:** Usar constantes de `CACHE_TTL` em `src/lib/utils/constants.ts`.

### CQ-07: Variavel `created` nunca exibida no CsvImportDialog [LOW]
- **Arquivo:** `src/components/transactions/CsvImportDialog.tsx` (linha 158)
- **Correcao:** Mostrar no resumo ou remover.

---

## FEATURES FALTANDO

### MF-01: Conversao USD para BRL para visao unificada [HIGH]
- **Arquivos:** `src/hooks/usePortfolio.ts`, `src/components/dashboard/PortfolioSummaryCards.tsx`
- **Problema:** Dashboard mostra BRL e USD separados, mas nao ha visao unificada do patrimonio total.
- **Correcao:** Buscar taxa USD/BRL da BCB API (serie 1, gratuita) e mostrar card com patrimonio total convertido.

### MF-02: Calculo de IR / DARF [MEDIUM]
- **Problema:** Nao ha calculo de imposto de renda sobre ganhos de capital. Acoes tem isencao de R$20k/mes em vendas. FIIs nao tem isencao. Day-trade e 20%.
- **Correcao:** Modulo de impostos que calcula DARF mensal baseado em transacoes de venda.

### MF-03: Grafico de evolucao do patrimonio [MEDIUM]
- **Problema:** Graficos existem so para ativos individuais em `/asset/[ticker]`. Nao ha grafico de "patrimonio total ao longo do tempo" no dashboard.
- **Correcao:** Armazenar snapshots diarios do portfolio ou calcular retroativamente. Exibir com recharts (ja no package.json).

### MF-05: Reset de senha [MEDIUM]
- **Arquivo:** `src/app/(auth)/login/page.tsx`
- **Problema:** Login tem email/senha mas nao tem "Esqueceu a senha?".
- **Correcao:** Adicionar link que chama `supabase.auth.resetPasswordForEmail()` e criar pagina `/auth/reset-password`.

### MF-04: Export de dados para CSV/PDF [LOW]
- **Problema:** Importa dados (B3 CSV, XP XLSX) mas nao exporta portfolio, transacoes ou holdings.
- **Correcao:** Botoes de export usando xlsx (ja no package.json).

### MF-06: Edicao de perfil (nome, moeda preferida) [LOW]
- **Arquivo:** `src/app/(app)/settings/page.tsx`
- **Correcao:** Campos de formulario para nome e moeda preferida com save para `invest_profiles`.

### MF-07: Fund sem cor dedicada no pie chart [LOW]
- **Arquivos:** `src/components/dashboard/AllocationPieChart.tsx`, `src/lib/utils/constants.ts`
- **Correcao:** Garantir que `fund` tem cor dedicada em `ASSET_TYPE_COLORS`.

---

## DESIGN/VISUAL

### DV-02: Cores hardcoded quebram no dark mode [MEDIUM]
- **Arquivos:** `src/components/transactions/CsvImportDialog.tsx`, `XpImportDialog.tsx`
- **Problema:** `bg-emerald-50`, `bg-red-50`, `bg-amber-50` ficam lavadas no dark mode.
- **Correcao:** Usar dark mode variants: `bg-emerald-50 dark:bg-emerald-950`.

### DV-03: Landing page acessivel para usuarios autenticados [LOW]
- **Arquivos:** `src/app/page.tsx`, `src/lib/supabase/middleware.ts`
- **Problema:** Usuario logado que navega para `/` ve a landing page em vez de ser redirecionado ao dashboard.
- **Correcao:** Adicionar `/` ao redirect check no middleware.

### DV-01: Palette monocromatica sem identidade visual [LOW]
- **Arquivo:** `src/app/globals.css`
- **Correcao:** Considerar cor primaria de "financas" (azul/verde) para botoes e estados ativos.

### DV-04: ThemeToggle sem aria-label [LOW]
- **Arquivo:** `src/components/shared/ThemeToggle.tsx`
- **Correcao:** Adicionar `aria-label={theme === "dark" ? "Trocar para modo claro" : "Trocar para modo escuro"}`.

---

## ARQUITETURA

### ARCH-04: Zod v4 instalado mas nao usado [MEDIUM]
- **Arquivos:** Todos os API routes
- **Problema:** Zod esta no `package.json` mas nenhuma API route valida inputs.
- **Correcao:** Adicionar Zod schemas para todos os inputs de API routes.

### ARCH-07: Types do Supabase mantidos manualmente [MEDIUM]
- **Arquivo:** `src/types/database.ts`
- **Problema:** Types podem divergir do schema real. Colunas de migrations 009/010 podem nao estar refletidas.
- **Correcao:** Usar `supabase gen types typescript` no build ou pre-commit.

### ARCH-01: Waterfall de requests client-side [MEDIUM]
- **Arquivo:** `src/hooks/usePortfolio.ts`
- **Problema:** Browser faz holdings → prices → fixed-income → funds → dividends em cascata (2-5s).
- **Correcao:** Criar endpoint unico `/api/portfolio` que agrega tudo server-side em um response.

### ARCH-05: force-dynamic no layout bloqueia otimizacoes [LOW]
- **Arquivo:** `src/app/(app)/layout.tsx`
- **Correcao:** Remover `force-dynamic` do layout. Marcar apenas paginas especificas como dynamic.

### ARCH-06: Sem monitoramento de erros [LOW]
- **Problema:** Erros sao `console.error()` em todo lugar. Em producao, sao invisiveis.
- **Correcao:** Adicionar Sentry ou similar com funcao utilitaria `reportError(error, context)`.

### ARCH-02: Sem migration runner [LOW]
- **Problema:** Migrations sao SQL files rodados manualmente no Supabase SQL editor.
- **Correcao:** Configurar Supabase CLI com `supabase init` e `supabase db push`.

### ARCH-03: RLS policy faltando para invest_fund_registry [LOW]
- **Arquivo:** `supabase/migrations/010_add_cnpj_to_assets.sql` (linhas 20-27)
- **Correcao:** Adicionar policy de service_role para ALL operations.

---

## RESUMO

| Prioridade | Qtd | Exemplos |
|-----------|-----|----------|
| **Critical** | 1 | Trigger de preco medio errado |
| **High** | 8 | Seguranca API, rate limiting, FII formula, imports duplicados |
| **Medium** | 14 | Editar transacoes, loading states, code quality, conversao USD/BRL |
| **Low** | 19 | Dark mode, aria-labels, export, migration runner |
| **Total** | **42** | |

### Top 5 para resolver primeiro:
1. **BUG-07** - Trigger de preco medio (corrompe dados financeiros)
2. **SEC-01** - API routes sem autenticacao
3. **BUG-04** - Formula FII rentBruta vs rentComProventos
4. **PERF-02** - Rate limiting nas chamadas de preco
5. **MF-01** - Conversao USD/BRL para patrimonio unificado
