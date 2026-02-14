export type FixedIncomeIndex = "cdi" | "ipca" | "selic" | "prefixado";

export interface BcbRate {
  date: string;
  value: number;
}

// IOF regressivo - Decreto 6.306/2007
// Incide sobre rendimento nos primeiros 30 dias
const IOF_TABLE = [
  96, 93, 90, 86, 83, 80, 76, 73, 70, 66,
  63, 60, 56, 53, 50, 46, 43, 40, 36, 33,
  30, 26, 23, 20, 16, 13, 10, 6, 3, 0,
];

export function getIofRate(holdingDays: number): number {
  if (holdingDays >= 30) return 0;
  if (holdingDays < 1) return 0.96;
  return IOF_TABLE[holdingDays - 1] / 100;
}

// IR regressivo - Lei 11.033/2004
export function getIrRate(holdingDays: number): number {
  if (holdingDays <= 180) return 0.225;
  if (holdingDays <= 360) return 0.20;
  if (holdingDays <= 720) return 0.175;
  return 0.15;
}

// LCI, LCA, CRI, CRA sao isentos de IR
const IR_EXEMPT_PREFIXES = ["LCI", "LCA", "CRI", "CRA"];

export function isIrExempt(ticker: string): boolean {
  const upper = ticker.toUpperCase();
  return IR_EXEMPT_PREFIXES.some((p) => upper.startsWith(p));
}

export interface FixedIncomeInput {
  totalInvested: number;
  purchaseDate: Date;
  index: FixedIncomeIndex;
  rate: number; // CDI: % do CDI (ex: 110). Prefixado: taxa a.a. (ex: 12.5). IPCA/Selic: spread a.a. (ex: 5.5)
  ticker: string;
  rates: BcbRate[]; // taxas diarias/mensais do BCB (nao necessario para prefixado)
}

export interface FixedIncomeResult {
  grossValue: number;
  netValue: number;
  grossReturn: number;
  netReturn: number;
  iofAmount: number;
  irAmount: number;
  holdingDays: number;
  iofRate: number;
  irRate: number;
}

export function calculateFixedIncome(input: FixedIncomeInput): FixedIncomeResult {
  const now = new Date();
  const holdingDays = Math.floor(
    (now.getTime() - input.purchaseDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let grossValue: number;

  switch (input.index) {
    case "prefixado": {
      const annualRate = input.rate / 100;
      grossValue = input.totalInvested * Math.pow(1 + annualRate, holdingDays / 365);
      break;
    }

    case "cdi": {
      // Cada dia: acumula taxa_diaria * (% contratado)
      // BCB serie 12 retorna taxa diaria em % (ex: 0.038356 = 0.038356%)
      const cdiPercent = input.rate / 100; // 110 -> 1.10
      let accumulated = 1.0;
      for (const entry of input.rates) {
        const dailyRate = entry.value / 100;
        accumulated *= 1 + dailyRate * cdiPercent;
      }
      grossValue = input.totalInvested * accumulated;
      break;
    }

    case "selic": {
      // Tesouro Selic: acumula taxa diaria Selic + spread
      const annualSpread = input.rate / 100;
      const dailySpread = Math.pow(1 + annualSpread, 1 / 252) - 1;
      let accumulated = 1.0;
      for (const entry of input.rates) {
        const dailyRate = entry.value / 100;
        accumulated *= 1 + dailyRate + dailySpread;
      }
      grossValue = input.totalInvested * accumulated;
      break;
    }

    case "ipca": {
      // Tesouro IPCA+: acumula IPCA mensal + spread anual composto
      let accumulated = 1.0;
      for (const entry of input.rates) {
        const monthlyRate = entry.value / 100;
        accumulated *= 1 + monthlyRate;
      }
      const annualSpread = input.rate / 100;
      const yearsHeld = holdingDays / 365;
      const spreadFactor = Math.pow(1 + annualSpread, yearsHeld);
      grossValue = input.totalInvested * accumulated * spreadFactor;
      break;
    }

    default:
      grossValue = input.totalInvested;
  }

  // Calculo de impostos (incidem sobre o rendimento, nao sobre o principal)
  const grossProfit = grossValue - input.totalInvested;

  const iofRate = getIofRate(holdingDays);
  const iofAmount = grossProfit > 0 ? grossProfit * iofRate : 0;

  const profitAfterIof = grossProfit - iofAmount;

  let irRate = 0;
  let irAmount = 0;
  if (!isIrExempt(input.ticker) && profitAfterIof > 0) {
    irRate = getIrRate(holdingDays);
    irAmount = profitAfterIof * irRate;
  }

  const netValue = grossValue - iofAmount - irAmount;
  const grossReturn =
    input.totalInvested > 0
      ? ((grossValue - input.totalInvested) / input.totalInvested) * 100
      : 0;
  const netReturn =
    input.totalInvested > 0
      ? ((netValue - input.totalInvested) / input.totalInvested) * 100
      : 0;

  return {
    grossValue,
    netValue,
    grossReturn,
    netReturn,
    iofAmount,
    irAmount,
    holdingDays,
    iofRate,
    irRate,
  };
}
