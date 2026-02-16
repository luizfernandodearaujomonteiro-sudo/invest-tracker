import { unzipSync } from "fflate";

export interface CvmFundNav {
  cnpj: string;
  date: string;
  vlQuota: number;
  vlPatrimLiq: number;
}

export interface CvmFundInfo {
  cnpj: string;
  name: string;
  classe: string;
  situacao: string;
  gestor: string;
  admin: string;
}

/**
 * Download and parse CVM monthly ZIP file to get the latest VL_QUOTA per CNPJ.
 * The ZIP contains a CSV with semicolon-delimited data in Latin-1 encoding.
 * URL: https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_YYYYMM.zip
 */
export async function fetchFundNavs(
  targetCnpjs: string[]
): Promise<Map<string, CvmFundNav>> {
  if (targetCnpjs.length === 0) return new Map();

  // Normalize CNPJs (remove formatting)
  const cnpjSet = new Set(targetCnpjs.map(normalizeCnpj));

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const url = `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${yyyy}${mm}.zip`;

  const response = await fetch(url);
  if (!response.ok) {
    // If current month fails (e.g., beginning of month), try previous month
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevYyyy = prevDate.getFullYear();
    const prevMm = String(prevDate.getMonth() + 1).padStart(2, "0");
    const prevUrl = `https://dados.cvm.gov.br/dados/FI/DOC/INF_DIARIO/DADOS/inf_diario_fi_${prevYyyy}${prevMm}.zip`;
    const prevResponse = await fetch(prevUrl);
    if (!prevResponse.ok) {
      throw new Error(`CVM download failed for both ${url} and ${prevUrl}`);
    }
    return parseNavZip(await prevResponse.arrayBuffer(), cnpjSet);
  }

  return parseNavZip(await response.arrayBuffer(), cnpjSet);
}

async function parseNavZip(
  buffer: ArrayBuffer,
  cnpjSet: Set<string>
): Promise<Map<string, CvmFundNav>> {
  const results = new Map<string, CvmFundNav>();
  const uint8 = new Uint8Array(buffer);
  const files = unzipSync(uint8);

  for (const [filename, data] of Object.entries(files)) {
    if (!filename.endsWith(".csv")) continue;

    // CVM files use Latin-1 encoding
    const decoder = new TextDecoder("latin1");
    const content = decoder.decode(data);
    const lines = content.split("\n");

    if (lines.length < 2) continue;

    // Parse header to find column indices
    const header = lines[0].split(";").map((h) => h.trim());
    const cnpjIdx = header.findIndex(
      (h) => h === "CNPJ_FUNDO_CLASSE" || h === "CNPJ_FUNDO"
    );
    const dateIdx = header.indexOf("DT_COMPTC");
    const quotaIdx = header.indexOf("VL_QUOTA");
    const patrimIdx = header.indexOf("VL_PATRIM_LIQ");

    if (cnpjIdx === -1 || dateIdx === -1 || quotaIdx === -1) continue;

    // Parse data rows - keep only the latest entry per CNPJ
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(";");
      const cnpj = normalizeCnpj(cols[cnpjIdx] || "");

      if (!cnpjSet.has(cnpj)) continue;

      const date = cols[dateIdx] || "";
      const vlQuota = parseFloat(cols[quotaIdx] || "0");
      const vlPatrimLiq =
        patrimIdx >= 0 ? parseFloat(cols[patrimIdx] || "0") : 0;

      const existing = results.get(cnpj);
      if (!existing || date > existing.date) {
        results.set(cnpj, { cnpj, date, vlQuota, vlPatrimLiq });
      }
    }
  }

  return results;
}

/**
 * Search CVM fund registry by name.
 * Downloads registro_fundo_classe.zip (~6MB), parses both
 * registro_fundo.csv and registro_classe.csv, and filters by name.
 */
export async function searchCvmFunds(
  query: string,
  limit = 15
): Promise<CvmFundInfo[]> {
  const url =
    "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip";
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`CVM cadastro download failed: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const uint8 = new Uint8Array(buffer);
  const files = unzipSync(uint8);
  const decoder = new TextDecoder("latin1");

  // Normalize query for matching
  const queryParts = query
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 1);

  const results: CvmFundInfo[] = [];

  function matchesQuery(name: string): boolean {
    const nameUpper = name
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return queryParts.every((part) => nameUpper.includes(part));
  }

  // Parse registro_fundo.csv
  for (const [filename, data] of Object.entries(files)) {
    if (
      filename.includes("registro_fundo") &&
      !filename.includes("classe") &&
      !filename.includes("subclasse")
    ) {
      const content = decoder.decode(data);
      const lines = content.split("\n");
      if (lines.length < 2) continue;

      const header = lines[0].split(";").map((h) => h.trim());
      const cnpjIdx = header.findIndex((h) => h === "CNPJ_Fundo");
      const nameIdx = header.findIndex((h) => h === "Denominacao_Social");
      const sitIdx = header.findIndex((h) => h === "Situacao");
      const gestorIdx = header.findIndex((h) => h === "Gestor");
      const adminIdx = header.findIndex((h) => h === "Administrador");

      if (cnpjIdx === -1 || nameIdx === -1) continue;

      for (let i = 1; i < lines.length && results.length < limit; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(";");
        const situacao = (cols[sitIdx] || "").trim();
        if (!situacao.includes("Funcionamento Normal")) continue;

        const name = (cols[nameIdx] || "").trim();
        if (matchesQuery(name)) {
          results.push({
            cnpj: (cols[cnpjIdx] || "").trim(),
            name,
            classe: "Fundo",
            situacao,
            gestor: (cols[gestorIdx] || "").trim(),
            admin: (cols[adminIdx] || "").trim(),
          });
        }
      }
    }
  }

  // Parse registro_classe.csv (if still under limit)
  if (results.length < limit) {
    for (const [filename, data] of Object.entries(files)) {
      if (
        filename.includes("registro_classe") &&
        !filename.includes("subclasse")
      ) {
        const content = decoder.decode(data);
        const lines = content.split("\n");
        if (lines.length < 2) continue;

        const header = lines[0].split(";").map((h) => h.trim());
        const cnpjIdx = header.findIndex((h) => h === "CNPJ_Classe");
        const nameIdx = header.findIndex((h) => h === "Denominacao_Social");
        const sitIdx = header.findIndex((h) => h === "Situacao");
        const classeIdx = header.findIndex((h) => h === "Classificacao");

        if (cnpjIdx === -1 || nameIdx === -1) continue;

        for (let i = 1; i < lines.length && results.length < limit; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(";");
          const situacao = (cols[sitIdx] || "").trim();
          if (!situacao.includes("Funcionamento Normal")) continue;

          const name = (cols[nameIdx] || "").trim();
          if (matchesQuery(name)) {
            results.push({
              cnpj: (cols[cnpjIdx] || "").trim(),
              name,
              classe: (cols[classeIdx] || "").trim(),
              situacao,
              gestor: "",
              admin: "",
            });
          }
        }
      }
    }
  }

  return results;
}

/** Remove dots, slashes, dashes from CNPJ for comparison */
export function normalizeCnpj(cnpj: string): string {
  return cnpj.replace(/[.\-/]/g, "").trim();
}

/** Format CNPJ as XX.XXX.XXX/XXXX-XX */
export function formatCnpj(cnpj: string): string {
  const digits = normalizeCnpj(cnpj);
  if (digits.length !== 14) return cnpj;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

/** Generate a short ticker-like name from the fund name */
export function generateFundTicker(name: string): string {
  const stopWords = new Set([
    "de", "em", "do", "da", "dos", "das", "e", "a", "o",
    "fundo", "fundos", "investimento", "investimentos",
    "responsabilidade", "limitada", "rl", "aberto",
    "cotas", "cota", "multimercado", "multiestrategia",
  ]);
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 1);

  // Take up to 3 significant words
  return words.slice(0, 3).join("-") || "FUNDO";
}
