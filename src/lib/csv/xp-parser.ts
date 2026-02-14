import * as XLSX from "xlsx";

export interface XpPosition {
  section: "acoes" | "fiis" | "fundos" | "tesouro" | "renda_fixa";
  name: string;
  ticker: string | null;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  totalInvested: number;
  currentValue: number;
  assetType: string;
}

export interface XpParseResult {
  positions: XpPosition[];
  summary: {
    totalPatrimonio: number;
    totalInvestido: number;
    reportDate: string;
    accountNumber: string;
  };
  warnings: string[];
}

// Parse BRL currency string "R$ 1.234,56" -> 1234.56
function parseBrl(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Parse percentage "24,3%" -> 24.3
function parsePercent(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace("%", "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Parse quantity that may have BR format "1.000" -> 1000
function parseQty(val: string | number): number {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = String(val).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
}

// Detect asset type from ticker and section
function detectAssetType(
  ticker: string,
  section: string
): string {
  if (section === "fiis") return "br_fii";

  const t = ticker.toUpperCase();

  // BDRs end in 34, 35, 39
  if (/\d{2}$/.test(t)) {
    const suffix = parseInt(t.slice(-2));
    if (suffix === 34 || suffix === 35 || suffix === 39) return "br_bdr";
  }

  // ETFs end in 11 (but not FIIs which are in a separate section)
  if (t.endsWith("11") || t.endsWith("12")) return "br_etf";

  // Regular stocks
  return "br_stock";
}

export function parseXpPositionFile(file: ArrayBuffer): XpParseResult {
  const wb = XLSX.read(file, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: (string | number)[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  });

  const positions: XpPosition[] = [];
  const warnings: string[] = [];

  // Extract summary from header
  let accountNumber = "";
  let reportDate = "";
  let totalPatrimonio = 0;
  let totalInvestido = 0;

  // Row 0: "Conta: 5741882 | 13/02/2026, 20:50"
  const headerRow = String(rows[0]?.[0] || rows[0]?.[6] || "");
  const accountMatch = headerRow.match(/Conta:\s*(\d+)/);
  if (accountMatch) accountNumber = accountMatch[1];
  const dateMatch = headerRow.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) {
    const [d, m, y] = dateMatch[1].split("/");
    reportDate = `${y}-${m}-${d}`;
  } else {
    reportDate = new Date().toISOString().split("T")[0];
  }

  // Row 3: patrimonio and total invested
  if (rows[3]) {
    totalPatrimonio = parseBrl(String(rows[3][0] || ""));
    totalInvestido = parseBrl(String(rows[3][1] || ""));
  }

  // Parse the file by detecting sections
  let currentSection: string | null = null;
  let currentHeaders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || "").trim();

    // Detect main sections
    if (firstCell === "Ações" && row.length <= 3) {
      currentSection = "acoes";
      currentHeaders = [];
      continue;
    }
    if (firstCell === "Fundos Imobiliários" && row.length <= 3) {
      currentSection = "fiis";
      currentHeaders = [];
      continue;
    }
    if (firstCell === "Fundos de Investimentos" && row.length <= 3) {
      currentSection = "fundos";
      currentHeaders = [];
      continue;
    }
    if (firstCell === "Tesouro Direto" && row.length <= 3) {
      currentSection = "tesouro";
      currentHeaders = [];
      continue;
    }
    if (firstCell === "Renda Fixa" && row.length <= 3) {
      currentSection = "renda_fixa";
      currentHeaders = [];
      continue;
    }
    if (
      firstCell === "Dividendos, proventos e outras distribuições" ||
      firstCell === "Custódia Remunerada"
    ) {
      currentSection = null;
      continue;
    }

    // Detect sub-section headers (e.g., "30% | Renda Variável Brasil")
    if (firstCell.includes("% |") || firstCell.includes("%|")) {
      // Next row-like element is the header row
      currentHeaders = row.map((v) => String(v).trim());
      continue;
    }

    // Skip if no section or this is a header-like row
    if (!currentSection) continue;
    if (
      firstCell === "Posição" ||
      firstCell.includes("Proventos") ||
      firstCell === ""
    ) {
      continue;
    }

    // Parse data rows based on section
    if (currentSection === "acoes") {
      // Columns: Ticker, Posição, %Alocação, Rentabilidade(%), Preço médio, Último preço, Qtd total
      const ticker = firstCell;
      if (!ticker || ticker.length > 10 || ticker.includes(" ")) continue;

      const currentValue = parseBrl(String(row[1] || ""));
      const avgPrice = parseBrl(String(row[4] || ""));
      const lastPrice = parseBrl(String(row[5] || ""));
      const quantity = parseQty(String(row[6] || ""));

      if (quantity <= 0) continue;

      const totalInv = avgPrice * quantity;

      positions.push({
        section: "acoes",
        name: ticker,
        ticker,
        quantity,
        averagePrice: avgPrice,
        currentPrice: lastPrice,
        totalInvested: totalInv,
        currentValue,
        assetType: detectAssetType(ticker, "acoes"),
      });
    } else if (currentSection === "fiis") {
      // Columns: Ticker, Posição, %Alocação, Rent c/ proventos, Rent Bruta, Preço médio, Última cotação, Qtd Cotas
      const ticker = firstCell;
      if (!ticker || ticker.length > 10 || ticker.includes(" ")) continue;

      const currentValue = parseBrl(String(row[1] || ""));
      const avgPrice = parseBrl(String(row[5] || ""));
      const lastPrice = parseBrl(String(row[6] || ""));
      const quantity = parseQty(String(row[7] || ""));

      if (quantity <= 0) continue;

      const totalInv = avgPrice * quantity;

      positions.push({
        section: "fiis",
        name: ticker,
        ticker,
        quantity,
        averagePrice: avgPrice,
        currentPrice: lastPrice,
        totalInvested: totalInv,
        currentValue,
        assetType: "br_fii",
      });
    } else if (currentSection === "fundos") {
      // Columns: Fund Name, Posição, %Alocação, Rent Líquida, Rent Bruta, Valor aplicado, Valor líquido
      const name = firstCell;
      if (!name || name.includes("% |")) continue;

      const currentValue = parseBrl(String(row[1] || ""));
      const valorAplicado = parseBrl(String(row[5] || ""));
      const valorLiquido = parseBrl(String(row[6] || ""));

      if (valorAplicado <= 0 && currentValue <= 0) continue;

      warnings.push(
        `Fundo "${name}" (R$ ${valorAplicado.toFixed(2)}) - fundos nao tem ticker, precisa cadastrar manualmente`
      );
    } else if (currentSection === "tesouro") {
      // Columns: Name, Posição, %Alocação, Total aplicado, Qtd, Disponível, Vencimento
      const name = firstCell;
      if (!name || name.includes("% |")) continue;

      const currentValue = parseBrl(String(row[1] || ""));
      const totalAplicado = parseBrl(String(row[3] || ""));
      const quantity = parseQty(String(row[4] || ""));

      if (totalAplicado <= 0) continue;

      warnings.push(
        `Tesouro "${name}" (R$ ${totalAplicado.toFixed(2)}) - tesouro direto precisa ser cadastrado manualmente`
      );
    } else if (currentSection === "renda_fixa") {
      const name = firstCell;
      if (!name || name.includes("% |")) continue;

      const valorAplicado = parseBrl(String(row[3] || ""));

      if (valorAplicado <= 0) continue;

      warnings.push(
        `Renda Fixa "${name}" (R$ ${valorAplicado.toFixed(2)}) - precisa ser cadastrado manualmente`
      );
    }
  }

  return {
    positions,
    summary: {
      totalPatrimonio,
      totalInvestido,
      reportDate,
      accountNumber,
    },
    warnings,
  };
}
