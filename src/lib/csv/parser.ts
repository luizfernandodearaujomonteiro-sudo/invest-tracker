import Papa from "papaparse";

export interface CsvRow {
  date: string;
  ticker: string;
  type: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  fees: number;
  notes: string;
}

export type CsvFormat = "b3" | "xp" | "nomad" | "ledger" | "generic";

// Normalize Brazilian number format (1.234,56 -> 1234.56)
function parseBrNumber(val: string): number {
  if (!val) return 0;
  const cleaned = val.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Parse date in various formats
function parseDate(val: string): string {
  if (!val) return new Date().toISOString().split("T")[0];

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (brMatch) {
    return `${brMatch[3]}-${brMatch[2].padStart(2, "0")}-${brMatch[1].padStart(2, "0")}`;
  }

  // YYYY-MM-DD
  const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // MM/DD/YYYY (US format)
  const usMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usMatch) {
    return `${usMatch[3]}-${usMatch[1].padStart(2, "0")}-${usMatch[2].padStart(2, "0")}`;
  }

  return new Date().toISOString().split("T")[0];
}

// Detect buy/sell from various formats
function parseType(val: string): "buy" | "sell" | "dividend" {
  const lower = val.toLowerCase().trim();
  if (
    lower === "c" ||
    lower === "compra" ||
    lower === "buy" ||
    lower === "purchase" ||
    lower === "credito" ||
    lower.includes("compra")
  ) {
    return "buy";
  }
  if (
    lower === "v" ||
    lower === "venda" ||
    lower === "sell" ||
    lower === "sale" ||
    lower === "debito" ||
    lower.includes("venda")
  ) {
    return "sell";
  }
  if (
    lower === "dividendo" ||
    lower === "dividend" ||
    lower === "jcp" ||
    lower === "provento" ||
    lower.includes("dividend") ||
    lower.includes("provento")
  ) {
    return "dividend";
  }
  return "buy";
}

// Find the best matching column name from a row
function findColumn(
  headers: string[],
  candidates: string[]
): string | null {
  for (const candidate of candidates) {
    const found = headers.find(
      (h) => h.toLowerCase().trim() === candidate.toLowerCase()
    );
    if (found) return found;
  }
  // Partial match
  for (const candidate of candidates) {
    const found = headers.find((h) =>
      h.toLowerCase().trim().includes(candidate.toLowerCase())
    );
    if (found) return found;
  }
  return null;
}

// Stablecoins to skip in Ledger import (not real investments)
const LEDGER_SKIP_TICKERS = new Set([
  "USDC", "USDT", "DAI", "BUSD", "TUSD", "USDP", "FRAX", "LUSD",
  "MSTKEUSD", "MSTKEUSDC", "SUSDC", "SDAI", "AAVE", "STETH",
]);

// Map Ledger ticker to CoinGecko-compatible asset type
function getLedgerAssetType(ticker: string): string {
  const map: Record<string, string> = {
    BTC: "crypto", ETH: "crypto", SOL: "crypto", XRP: "crypto",
    BNB: "crypto", ADA: "crypto", DOT: "crypto", AVAX: "crypto",
    MATIC: "crypto", LINK: "crypto", ATOM: "crypto", UNI: "crypto",
    DOGE: "crypto", SHIB: "crypto", LTC: "crypto",
  };
  return map[ticker.toUpperCase()] || "crypto";
}

// Column mapping for known formats
const FORMAT_MAPPINGS: Record<
  Exclude<CsvFormat, "ledger">,
  {
    date: string[];
    ticker: string[];
    type: string[];
    quantity: string[];
    price: string[];
    fees: string[];
    notes: string[];
  }
> = {
  b3: {
    date: ["Data do Negocio", "Data Negocio", "Data", "Date"],
    ticker: ["Codigo Negociacao", "Codigo", "Ticker", "Ativo"],
    type: ["Tipo de Movimentacao", "Tipo", "C/V", "Operacao"],
    quantity: ["Quantidade", "Qtde", "Qtd"],
    price: ["Preco", "Valor Unitario", "Preco Unitario"],
    fees: ["Taxas", "Taxa", "Corretagem", "Emolumentos"],
    notes: ["Observacao", "Obs", "Notas"],
  },
  xp: {
    date: ["Data Negocio", "Data", "Data Pregao"],
    ticker: ["Codigo", "Ativo", "Papel", "Ticker"],
    type: ["Tipo", "C/V", "Natureza", "Operacao"],
    quantity: ["Quantidade", "Qtde", "Qtd"],
    price: ["Preco", "Preco Medio", "Valor"],
    fees: ["Taxas", "Corretagem", "Taxa"],
    notes: ["Observacao", "Obs"],
  },
  nomad: {
    date: ["Date", "Trade Date", "Data"],
    ticker: ["Symbol", "Ticker", "Asset"],
    type: ["Type", "Side", "Action", "Tipo"],
    quantity: ["Quantity", "Qty", "Shares", "Quantidade"],
    price: ["Price", "Avg Price", "Preco"],
    fees: ["Fees", "Commission", "Taxas"],
    notes: ["Notes", "Description", "Descricao"],
  },
  generic: {
    date: ["date", "data", "Date", "Data", "DATA"],
    ticker: ["ticker", "symbol", "codigo", "ativo", "Ticker", "Symbol", "Codigo", "Ativo"],
    type: ["type", "tipo", "side", "Type", "Tipo", "C/V", "operacao"],
    quantity: ["quantity", "qty", "quantidade", "qtd", "Quantity", "Quantidade"],
    price: ["price", "preco", "valor", "Price", "Preco"],
    fees: ["fees", "taxas", "commission", "Fees", "Taxas"],
    notes: ["notes", "obs", "observacao", "Notes", "Obs"],
  },
};

export interface ParseResult {
  rows: CsvRow[];
  errors: string[];
  totalParsed: number;
  totalSkipped: number;
}

function parseLedgerRows(results: Papa.ParseResult<unknown>): ParseResult {
  const headers = results.meta.fields || [];
  const errors: string[] = [];

  const dateCol = findColumn(headers, ["Operation Date"]);
  const tickerCol = findColumn(headers, ["Currency Ticker"]);
  const typeCol = findColumn(headers, ["Operation Type"]);
  const amountCol = findColumn(headers, ["Operation Amount"]);
  const feesCol = findColumn(headers, ["Operation Fees"]);
  const countervalueCol = findColumn(headers, ["Countervalue at Operation Date"]);
  const accountCol = findColumn(headers, ["Account Name"]);

  if (!dateCol || !tickerCol || !typeCol || !amountCol) {
    errors.push("Formato Ledger nao reconhecido");
    errors.push(`Colunas encontradas: ${headers.join(", ")}`);
    return { rows: [], errors, totalParsed: 0, totalSkipped: results.data.length };
  }

  const rows: CsvRow[] = [];
  let skipped = 0;

  for (const rawRow of results.data) {
    const row = rawRow as Record<string, string>;
    try {
      const opType = (row[typeCol] || "").toUpperCase().trim();

      // Skip FEES, DELEGATE and other non-trade operations
      if (opType !== "IN" && opType !== "OUT") {
        skipped++;
        continue;
      }

      const ticker = (row[tickerCol] || "").toUpperCase().trim();

      // Skip stablecoins
      if (LEDGER_SKIP_TICKERS.has(ticker)) {
        skipped++;
        continue;
      }

      const amount = parseFloat(row[amountCol] || "0");
      const countervalue = parseFloat(row[countervalueCol!] || "0");

      // Skip dust (< $1 USD)
      if (countervalue < 1 || amount <= 0) {
        skipped++;
        continue;
      }

      const pricePerUnit = countervalue / amount;
      const feesInCrypto = parseFloat(row[feesCol!] || "0");
      const feesUsd = feesInCrypto > 0 ? feesInCrypto * pricePerUnit : 0;
      const account = row[accountCol!] || "";

      rows.push({
        date: parseDate(row[dateCol]),
        ticker,
        type: opType === "IN" ? "buy" : "sell",
        quantity: amount,
        price: Math.round(pricePerUnit * 100) / 100,
        fees: Math.round(feesUsd * 100) / 100,
        notes: account,
      });
    } catch {
      skipped++;
    }
  }

  return { rows, errors: [], totalParsed: rows.length, totalSkipped: skipped };
}

export function parseCsvFile(
  file: File,
  format: CsvFormat
): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        // Ledger has its own parsing logic
        if (format === "ledger") {
          resolve(parseLedgerRows(results));
          return;
        }

        const headers = results.meta.fields || [];
        const mapping = FORMAT_MAPPINGS[format];

        const dateCol = findColumn(headers, mapping.date);
        const tickerCol = findColumn(headers, mapping.ticker);
        const typeCol = findColumn(headers, mapping.type);
        const qtyCol = findColumn(headers, mapping.quantity);
        const priceCol = findColumn(headers, mapping.price);
        const feesCol = findColumn(headers, mapping.fees);
        const notesCol = findColumn(headers, mapping.notes);

        const errors: string[] = [];

        if (!dateCol) errors.push("Coluna de DATA nao encontrada");
        if (!tickerCol) errors.push("Coluna de TICKER/CODIGO nao encontrada");
        if (!qtyCol) errors.push("Coluna de QUANTIDADE nao encontrada");
        if (!priceCol) errors.push("Coluna de PRECO nao encontrada");

        if (errors.length > 0) {
          resolve({
            rows: [],
            errors: [
              ...errors,
              `Colunas encontradas: ${headers.join(", ")}`,
            ],
            totalParsed: 0,
            totalSkipped: results.data.length,
          });
          return;
        }

        const rows: CsvRow[] = [];
        let skipped = 0;

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i] as Record<string, string>;
          try {
            const ticker = row[tickerCol!]?.trim();
            const qty = parseBrNumber(row[qtyCol!]);
            const price = parseBrNumber(row[priceCol!]);

            if (!ticker || qty <= 0 || price <= 0) {
              skipped++;
              continue;
            }

            rows.push({
              date: parseDate(row[dateCol!]),
              ticker: ticker.toUpperCase().replace(/\s+/g, ""),
              type: typeCol ? parseType(row[typeCol]) : "buy",
              quantity: qty,
              price: price,
              fees: feesCol ? parseBrNumber(row[feesCol]) : 0,
              notes: notesCol ? row[notesCol]?.trim() || "" : "",
            });
          } catch {
            skipped++;
          }
        }

        resolve({
          rows,
          errors: [],
          totalParsed: rows.length,
          totalSkipped: skipped,
        });
      },
      error: (error) => {
        resolve({
          rows: [],
          errors: [`Erro ao ler arquivo: ${error.message}`],
          totalParsed: 0,
          totalSkipped: 0,
        });
      },
    });
  });
}
