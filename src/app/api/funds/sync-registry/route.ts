import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";

export const maxDuration = 120;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface CvmFundRow {
  cnpj: string;
  name: string;
  classe: string;
  gestor: string;
  admin: string;
}

function parseCsv(content: string): { header: string[]; rows: string[][] } {
  const lines = content.split("\n");
  if (lines.length < 2) return { header: [], rows: [] };
  const header = lines[0].split(";").map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    rows.push(line.split(";"));
  }
  return { header, rows };
}

function findCol(header: string[], name: string): number {
  return header.findIndex((h) => h === name);
}

export async function POST() {
  const supabase = getSupabase();

  // CVM changed format: now uses a ZIP with registro_fundo.csv + registro_classe.csv
  const url =
    "https://dados.cvm.gov.br/dados/FI/CAD/DADOS/registro_fundo_classe.zip";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: `CVM download failed: ${response.status}` },
        { status: 502 }
      );
    }

    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const files = unzipSync(uint8);

    const funds: CvmFundRow[] = [];
    const decoder = new TextDecoder("latin1");

    // Parse registro_fundo.csv (parent funds)
    for (const [filename, data] of Object.entries(files)) {
      if (filename.includes("registro_fundo") && !filename.includes("classe") && !filename.includes("subclasse")) {
        const content = decoder.decode(data);
        const { header, rows } = parseCsv(content);

        const cnpjIdx = findCol(header, "CNPJ_Fundo");
        const nameIdx = findCol(header, "Denominacao_Social");
        const sitIdx = findCol(header, "Situacao");
        const gestorIdx = findCol(header, "Gestor");
        const adminIdx = findCol(header, "Administrador");

        if (cnpjIdx === -1 || nameIdx === -1) continue;

        for (const cols of rows) {
          const situacao = (cols[sitIdx] || "").trim();
          if (!situacao.includes("Funcionamento Normal")) continue;

          const cnpj = (cols[cnpjIdx] || "").replace(/[.\-/]/g, "").trim();
          if (!cnpj) continue;

          funds.push({
            cnpj,
            name: (cols[nameIdx] || "").trim(),
            classe: "Fundo",
            gestor: (cols[gestorIdx] || "").trim(),
            admin: (cols[adminIdx] || "").trim(),
          });
        }
      }
    }

    // Parse registro_classe.csv (fund classes - have their own CNPJs)
    for (const [filename, data] of Object.entries(files)) {
      if (filename.includes("registro_classe") && !filename.includes("subclasse")) {
        const content = decoder.decode(data);
        const { header, rows } = parseCsv(content);

        const cnpjIdx = findCol(header, "CNPJ_Classe");
        const nameIdx = findCol(header, "Denominacao_Social");
        const sitIdx = findCol(header, "Situacao");
        const classeIdx = findCol(header, "Classificacao");

        if (cnpjIdx === -1 || nameIdx === -1) continue;

        for (const cols of rows) {
          const situacao = (cols[sitIdx] || "").trim();
          if (!situacao.includes("Funcionamento Normal")) continue;

          const cnpj = (cols[cnpjIdx] || "").replace(/[.\-/]/g, "").trim();
          if (!cnpj) continue;

          funds.push({
            cnpj,
            name: (cols[nameIdx] || "").trim(),
            classe: (cols[classeIdx] || "").trim(),
            gestor: "",
            admin: "",
          });
        }
      }
    }

    if (funds.length === 0) {
      return NextResponse.json(
        { error: "Nenhum fundo ativo encontrado no arquivo da CVM" },
        { status: 500 }
      );
    }

    // Deduplicate by CNPJ (prefer fund-level entry which has gestor/admin)
    const deduped = new Map<string, CvmFundRow>();
    for (const f of funds) {
      const existing = deduped.get(f.cnpj);
      if (!existing || (f.gestor && !existing.gestor)) {
        deduped.set(f.cnpj, f);
      }
    }

    // Clear and re-insert in batches
    await supabase.from("invest_fund_registry").delete().neq("cnpj", "");

    const allFunds = Array.from(deduped.values());
    const BATCH_SIZE = 500;
    let inserted = 0;
    for (let i = 0; i < allFunds.length; i += BATCH_SIZE) {
      const batch = allFunds.slice(i, i + BATCH_SIZE).map((f) => ({
        cnpj: f.cnpj,
        name: f.name,
        classe: f.classe,
        gestor: f.gestor,
        admin: f.admin,
        synced_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("invest_fund_registry")
        .upsert(batch, { onConflict: "cnpj" });

      if (!error) inserted += batch.length;
    }

    return NextResponse.json({
      totalActive: allFunds.length,
      totalInserted: inserted,
    });
  } catch (error) {
    console.error("Erro ao sincronizar cadastro CVM:", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar cadastro CVM" },
      { status: 500 }
    );
  }
}
