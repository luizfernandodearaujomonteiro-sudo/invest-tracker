const BCB_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

// Series do Banco Central
const BCB_SERIES = {
  cdi: 12,    // CDI taxa diaria
  selic: 11,  // Selic taxa diaria
  ipca: 433,  // IPCA mensal
} as const;

export type BcbIndex = keyof typeof BCB_SERIES;

export interface BcbRateEntry {
  date: string;  // YYYY-MM-DD
  value: number;  // taxa em % (ex: 0.038356 = 0.038356%)
}

function formatDateBcb(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function fetchBcbRates(
  index: BcbIndex,
  startDate: Date,
  endDate: Date = new Date()
): Promise<BcbRateEntry[]> {
  const series = BCB_SERIES[index];
  const url = `${BCB_BASE}.${series}/dados?formato=json&dataInicial=${formatDateBcb(startDate)}&dataFinal=${formatDateBcb(endDate)}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) {
    console.error(`BCB API error: ${res.status} for series ${series}`);
    return [];
  }

  const data: Array<{ data: string; valor: string }> = await res.json();

  return data.map((entry) => {
    const [dd, mm, yyyy] = entry.data.split("/");
    return {
      date: `${yyyy}-${mm}-${dd}`,
      value: parseFloat(entry.valor),
    };
  });
}
