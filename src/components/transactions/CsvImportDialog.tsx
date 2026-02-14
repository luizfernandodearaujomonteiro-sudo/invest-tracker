"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useBrokers } from "@/hooks/useBrokers";
import { createClient } from "@/lib/supabase/client";
import { parseCsvFile, type CsvRow, type CsvFormat } from "@/lib/csv/parser";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FORMAT_OPTIONS = [
  { value: "b3", label: "B3 Area do Investidor" },
  { value: "xp", label: "XP Investimentos" },
  { value: "nomad", label: "Nomad" },
  { value: "ledger", label: "Ledger Wallet" },
  { value: "generic", label: "Generico (CSV padrao)" },
];

const TYPE_LABELS: Record<string, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Dividendo",
};

const TYPE_COLORS: Record<string, string> = {
  buy: "bg-emerald-100 text-emerald-700",
  sell: "bg-red-100 text-red-700",
  dividend: "bg-blue-100 text-blue-700",
};

type Step = "upload" | "preview" | "importing" | "done";

export function CsvImportDialog({
  open,
  onOpenChange,
}: CsvImportDialogProps) {
  const { data: brokers } = useBrokers();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [format, setFormat] = useState<CsvFormat>("generic");
  const [brokerId, setBrokerId] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({
    success: 0,
    failed: 0,
    skippedTickers: [] as string[],
  });

  const reset = () => {
    setStep("upload");
    setRows([]);
    setErrors([]);
    setFileName("");
    setImporting(false);
    setImportResult({ success: 0, failed: 0, skippedTickers: [] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const result = await parseCsvFile(file, format);

    if (result.errors.length > 0) {
      setErrors(result.errors);
      setRows([]);
      return;
    }

    setErrors([]);
    setRows(result.rows);
    setStep("preview");
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (!brokerId) {
      toast.error("Selecione uma corretora");
      return;
    }

    setImporting(true);
    setStep("importing");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Nao autenticado");
      setImporting(false);
      return;
    }

    // Get all assets from DB to match tickers
    const { data: assets } = await supabase
      .from("invest_assets")
      .select("id, ticker")
      .eq("is_active", true);

    const assetMap = new Map(
      (assets || []).map((a) => [a.ticker.toUpperCase(), a.id])
    );

    let success = 0;
    let failed = 0;
    const skippedTickers: string[] = [];

    let created = 0;

    for (const row of rows) {
      let assetId = assetMap.get(row.ticker.toUpperCase());

      if (!assetId && format === "ledger") {
        // Auto-create crypto asset for Ledger imports
        const { data: newAsset, error: assetErr } = await supabase
          .from("invest_assets")
          .insert({
            ticker: row.ticker.toUpperCase(),
            name: row.ticker.toUpperCase(),
            asset_type: "crypto",
            currency: "USD",
            exchange: "Crypto",
          })
          .select("id")
          .single();

        if (assetErr) {
          skippedTickers.push(row.ticker);
          failed++;
          continue;
        }
        assetId = newAsset.id;
        assetMap.set(row.ticker.toUpperCase(), assetId);
        created++;
      } else if (!assetId) {
        skippedTickers.push(row.ticker);
        failed++;
        continue;
      }

      try {
        // Find or create holding
        let { data: holding } = await supabase
          .from("invest_holdings")
          .select("id")
          .eq("user_id", user.id)
          .eq("broker_id", brokerId)
          .eq("asset_id", assetId)
          .single();

        if (!holding) {
          const { data: newHolding, error: hErr } = await supabase
            .from("invest_holdings")
            .insert({
              user_id: user.id,
              broker_id: brokerId,
              asset_id: assetId,
            })
            .select("id")
            .single();

          if (hErr) {
            failed++;
            continue;
          }
          holding = newHolding;
        }

        const totalValue = row.quantity * row.price + row.fees;

        const { error: txErr } = await supabase
          .from("invest_transactions")
          .insert({
            user_id: user.id,
            holding_id: holding.id,
            type: row.type,
            quantity: row.quantity,
            price_per_unit: row.price,
            total_value: totalValue,
            fees: row.fees,
            executed_at: new Date(row.date).toISOString(),
            notes: row.notes || `Importado de ${fileName}`,
          });

        if (txErr) {
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      }
    }

    setImportResult({
      success,
      failed,
      skippedTickers: [...new Set(skippedTickers)],
    });
    setImporting(false);
    setStep("done");

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar Transacoes via CSV</DialogTitle>
          <DialogDescription>
            Importe suas transacoes de um arquivo CSV exportado da corretora
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Formato do arquivo</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as CsvFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Corretora de destino</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a corretora" />
                </SelectTrigger>
                <SelectContent>
                  {(brokers || []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!brokers || brokers.length === 0) && (
                <p className="text-xs text-muted-foreground">
                  Voce precisa criar uma corretora primeiro em Corretoras.
                </p>
              )}
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-accent/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                Clique para selecionar o arquivo CSV
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Formatos aceitos: .csv
              </p>
              {fileName && (
                <div className="mt-3 flex items-center gap-2 text-sm text-primary">
                  <FileSpreadsheet className="h-4 w-4" />
                  {fileName}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {errors.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <p className="mb-1 text-sm font-medium text-destructive">
                  Erro ao processar arquivo:
                </p>
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {err}
                  </p>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm font-medium mb-2">
                Colunas esperadas no CSV:
              </p>
              <p className="text-xs text-muted-foreground">
                <strong>Data</strong> (dd/mm/yyyy) |{" "}
                <strong>Ticker/Codigo</strong> |{" "}
                <strong>Tipo</strong> (C/V ou Compra/Venda) |{" "}
                <strong>Quantidade</strong> |{" "}
                <strong>Preco</strong> |{" "}
                Taxas (opcional) | Obs (opcional)
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} transacoes encontradas em{" "}
                <span className="font-medium">{fileName}</span>
              </p>
              <Button variant="outline" size="sm" onClick={reset}>
                Trocar arquivo
              </Button>
            </div>

            <div className="max-h-[400px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Preco</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{row.date}</TableCell>
                      <TableCell className="font-medium">
                        {row.ticker}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={TYPE_COLORS[row.type] || ""}
                        >
                          {TYPE_LABELS[row.type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.price.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {(row.quantity * row.price + row.fees).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeRow(i)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {rows.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                Nenhuma transacao para importar.
              </p>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Importando transacoes...</p>
            <p className="text-sm text-muted-foreground">
              Processando {rows.length} transacoes
            </p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="space-y-4 py-6">
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="mb-3 h-12 w-12 text-emerald-600" />
              <p className="text-lg font-medium">Importacao concluida!</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {importResult.success}
                </p>
                <p className="text-xs text-emerald-600">Importadas</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {importResult.failed}
                </p>
                <p className="text-xs text-red-600">Falharam</p>
              </div>
            </div>

            {importResult.skippedTickers.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-700">
                    Tickers nao encontrados no sistema:
                  </p>
                </div>
                <p className="text-xs text-amber-600">
                  {importResult.skippedTickers.join(", ")}
                </p>
                <p className="mt-1 text-xs text-amber-500">
                  Esses ativos precisam ser cadastrados primeiro na tabela de
                  ativos ou adicionados manualmente via Transacoes.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={rows.length === 0 || !brokerId}
              >
                Importar {rows.length} transacoes
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => onOpenChange(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
