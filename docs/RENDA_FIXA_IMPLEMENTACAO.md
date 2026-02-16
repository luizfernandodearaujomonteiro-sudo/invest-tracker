# Renda Fixa - Plano de Implementacao

## Problema Atual
- Renda fixa no portfolio mostra R$ 0 de lucro/perda
- Sem calculo de rendimento (CDI/SELIC/IPCA)
- Nao tem "Preco Atual" nem "Valor Atualizado"

## Abordagem: "Foto + Calculo pra Frente"

### Conceito
O usuario nao tem historico de cada aporte individual. Mas a XP ja calcula o rendimento acumulado.
Entao importamos o snapshot da XP e calculamos o rendimento dali pra frente.

### Dados que o usuario importa (da XP)

| Campo | Exemplo LFT | Exemplo NTNB |
|-------|------------|--------------|
| Produto | LFT mar/2028 | NTNB PRINC mai/2029 |
| Total aplicado | R$ 32.843,97 | R$ 11.895,74 |
| Posicao atual | R$ 34.918,94 | R$ 12.385,32 |
| Indice | SELIC | IPCA+ |
| Taxa | 100% | 6,5% (taxa fixa + IPCA) |
| Vencimento | 01/03/2028 | 15/05/2029 |

### Campos no Banco (invest_holdings)

Ja existem:
- `total_invested` -> Total aplicado (R$ 32.843,97)
- `fixed_income_index` -> "CDI", "SELIC", "IPCA", "PRE"
- `fixed_income_rate` -> Taxa (100 = 100% do CDI, ou 6.5 = IPCA+6.5%)
- `maturity_date` -> Data de vencimento

Precisam ser adicionados:
- `snapshot_value` (DECIMAL) -> Posicao no momento da importacao (R$ 34.918,94)
- `snapshot_date` (DATE) -> Data da importacao (quando o usuario cadastrou)

### Calculo de Rendimento

```
Para CDI/SELIC (pos-fixado):
  valor_atual = snapshot_value * (1 + cdi_acumulado_desde_snapshot)
  cdi_acumulado = produto de (1 + cdi_diario) para cada dia util desde snapshot_date

Para IPCA+ (inflacao):
  valor_atual = snapshot_value * (1 + ipca_acumulado + taxa_fixa_proporcional)

Para PRE-FIXADO:
  valor_atual = total_invested * (1 + taxa)^(dias_uteis_totais/252)
  (nao precisa de API, a taxa ja e fixa)
```

### Lucro/Perda exibido no portfolio

```
rendimento_total = valor_atual - total_invested
rendimento_percent = (valor_atual / total_invested - 1) * 100
```

## API do Banco Central (BCB)

### Endpoints (gratuitos, sem limite)

1. **Taxa SELIC diaria**
   - URL: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados?formato=json&dataInicial=DD/MM/AAAA`
   - Serie 11 = SELIC meta
   - Retorna array de { data, valor } com taxa diaria

2. **Taxa CDI diaria**
   - URL: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=DD/MM/AAAA`
   - Serie 12 = CDI diario
   - Retorna taxa diaria em %

3. **IPCA mensal**
   - URL: `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=DD/MM/AAAA`
   - Serie 433 = IPCA variacao mensal
   - Retorna variacao % mensal

### Codigos das Series BCB
| Serie | Descricao |
|-------|-----------|
| 11 | Taxa SELIC (meta) |
| 12 | Taxa CDI (diaria) |
| 433 | IPCA (mensal) |
| 4390 | CDI acumulado no mes |
| 226 | TR (Taxa Referencial) - poupanca |

## Implementacao Passo a Passo

### 1. Migration: Adicionar campos snapshot no holding
```sql
ALTER TABLE invest_holdings
  ADD COLUMN IF NOT EXISTS snapshot_value DECIMAL(18,8),
  ADD COLUMN IF NOT EXISTS snapshot_date DATE;
```

### 2. Criar `src/lib/api/bcb.ts`
- `fetchCDIAccumulated(startDate, endDate)` -> retorna fator acumulado do CDI
- `fetchSELICAccumulated(startDate, endDate)` -> retorna fator acumulado SELIC
- `fetchIPCAAccumulated(startDate, endDate)` -> retorna fator acumulado IPCA
- Cache de 24h (taxas nao mudam durante o dia)

### 3. Criar `src/lib/calculations/fixed-income.ts`
- `calculateFixedIncomeValue(holding)` -> calcula valor atual baseado no indice
- Recebe: snapshot_value, snapshot_date, index, rate
- Retorna: { currentValue, yieldAmount, yieldPercent }

### 4. Atualizar `src/app/api/prices/route.ts`
- Quando asset_type === "fixed_income", em vez de pular, calcular rendimento
- Usar BCB API + logica de calculo
- Salvar resultado no price_cache como os outros ativos

### 5. Atualizar formulario de importacao (ImportPositionDialog)
- Quando mercado = "Renda Fixa", mostrar campos extras:
  - Posicao atual (snapshot_value) - campo novo
  - Indice (CDI/SELIC/IPCA/PRE)
  - Taxa (%)
  - Vencimento

### 6. Atualizar exibicao no Portfolio
- Renda fixa mostra: Valor Atual | Rendimento | % | Vencimento
- Em vez de "P. Medio" e "P. Atual", mostrar "Total Aplicado" e "Valor Atual"

## Exemplo Completo

### Input do usuario:
- Produto: Tesouro Selic 2028
- Total aplicado: R$ 32.843,97
- Posicao atual (XP): R$ 34.918,94
- Data importacao: 15/02/2026
- Indice: SELIC (100%)
- Vencimento: 01/03/2028

### Calculo em 15/03/2026 (30 dias depois):
1. Buscar CDI acumulado de 15/02 a 15/03 na API BCB
2. Supondo CDI acumulado = 0.95% no periodo
3. valor_atual = 34.918,94 * 1.0095 = R$ 35.250,62
4. rendimento_total = 35.250,62 - 32.843,97 = R$ 2.406,65
5. rendimento_percent = (35.250,62 / 32.843,97 - 1) * 100 = 7.33%

### Exibicao no portfolio:
| Ativo | Total Aplicado | Valor Atual | Rendimento |
|-------|---------------|-------------|------------|
| Tesouro Selic 2028 | R$ 32.843,97 | R$ 35.250,62 | R$ 2.406,65 (+7.33%) |
