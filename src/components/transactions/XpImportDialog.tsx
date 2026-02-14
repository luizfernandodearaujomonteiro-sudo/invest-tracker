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
import {
  parseXpPositionFile,
  type XpPosition,
  type XpParseResult,
} from "@/lib/csv/xp-parser";
import { toast } from "sonner";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  TrendingUp,
  Building2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface XpImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SECTION_LABELS: Record<string, string> = {
  acoes: "Acoes",
  fiis: "FIIs",
};

const SECTION_ICONS: Record<string, typeof TrendingUp> = {
  acoes: TrendingUp,
  fiis: Building2,
};

type Step = "upload" | "preview" | "importing" | "done";

export function XpImportDialog({ open, onOpenChange }: XpImportDialogProps) {
  const { data: brokers } = useBrokers();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [brokerId, setBrokerId] = useState("");
  const [parseResult, setParseResult] = useState<XpParseResult | null>(null);
  const [positions, setPositions] = useState<XpPosition[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState({
    success: 0,
    failed: 0,
    created: 0,
  });

  const reset = () => {
    setStep("upload");
    setPositions([]);
    setParseResult(null);
    setFileName("");
    setImporting(false);
    setImportResult({ success: 0, failed: 0, created: 0 });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const buffer = await file.arrayBuffer();
    const result = parseXpPositionFile(buffer);

    setParseResult(result);
    setPositions(result.positions);

    if (result.positions.length > 0) {
      setStep("preview");
    } else {
      toast.error("Nenhuma posicao encontrada no arquivo");
    }
  };

  const removePosition = (index: number) => {
    setPositions((prev) => prev.filter((_, i) => i !== index));
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

    // Get existing assets
    const { data: existingAssets } = await supabase
      .from("invest_assets")
      .select("id, ticker")
      .eq("is_active", true);

    const assetMap = new Map(
      (existingAssets || []).map((a) => [a.ticker.toUpperCase(), a.id])
    );

    let success = 0;
    let failed = 0;
    let created = 0;

    for (const pos of positions) {
      if (!pos.ticker) {
        failed++;
        continue;
      }

      let assetId = assetMap.get(pos.ticker.toUpperCase());

      // Auto-create asset if not found
      if (!assetId) {
        const { data: newAsset, error: assetErr } = await supabase
          .from("invest_assets")
          .insert({
            ticker: pos.ticker.toUpperCase(),
            name: pos.name || pos.ticker,
            asset_type: pos.assetType,
            currency: "BRL",
            exchange: "B3",
          })
          .select("id")
          .single();

        if (assetErr) {
          failed++;
          continue;
        }
        assetId = newAsset.id;
        assetMap.set(pos.ticker.toUpperCase(), assetId);
        created++;
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

        // Create buy transaction with avg price
        const totalValue = pos.quantity * pos.averagePrice;
        const { error: txErr } = await supabase
          .from("invest_transactions")
          .insert({
            user_id: user.id,
            holding_id: holding.id,
            type: "buy",
            quantity: pos.quantity,
            price_per_unit: pos.averagePrice,
            total_value: totalValue,
            fees: 0,
            executed_at: new Date(
              parseResult?.summary.reportDate || new Date()
            ).toISOString(),
            notes: `Importado de ${fileName} - Posicao XP`,
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

    setImportResult({ success, failed, created });
    setImporting(false);
    setStep("done");

    queryClient.invalidateQueries({ queryKey: ["transactions"] });
    queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  };

  const totalImportValue = positions.reduce(
    (acc, p) => acc + p.quantity * p.averagePrice,
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Posicao XP Investimentos</DialogTitle>
          <DialogDescription>
            Importe sua carteira do arquivo &quot;Posicao Detalhada&quot; da XP (.xlsx)
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
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
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-accent/50"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                Selecione o arquivo PosicaoDetalhada.xlsx
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Baixe em: Portal XP &gt; Minha Carteira &gt; Posicao Detalhada
                &gt; Exportar
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
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && parseResult && (
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">Patrimonio XP</p>
                <p className="text-lg font-bold">
                  R${" "}
                  {parseResult.summary.totalPatrimonio.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Posicoes para importar
                </p>
                <p className="text-lg font-bold">{positions.length}</p>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3 text-center">
                <p className="text-xs text-muted-foreground">
                  Valor a importar
                </p>
                <p className="text-lg font-bold">
                  R${" "}
                  {totalImportValue.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                </p>
              </div>
            </div>

            {/* Warnings for funds/tesouro */}
            {parseResult.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-700">
                    Nao importados automaticamente:
                  </p>
                </div>
                <div className="space-y-1">
                  {parseResult.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-600">
                      {w}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Positions table */}
            <div className="max-h-[350px] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">PM</TableHead>
                    <TableHead className="text-right">Preco Atual</TableHead>
                    <TableHead className="text-right">Investido</TableHead>
                    <TableHead className="text-right">Valor Atual</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((pos, i) => {
                    const Icon =
                      SECTION_ICONS[pos.section] || TrendingUp;
                    const pnl = pos.currentValue - pos.totalInvested;
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            <Icon className="mr-1 h-3 w-3" />
                            {SECTION_LABELS[pos.section]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {pos.ticker}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {pos.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          R$ {pos.averagePrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          R$ {pos.currentPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          R${" "}
                          {pos.totalInvested.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm font-medium ${
                            pnl >= 0
                              ? "text-emerald-600"
                              : "text-red-600"
                          }`}
                        >
                          R${" "}
                          {pos.currentValue.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removePosition(i)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Importando posicoes...</p>
            <p className="text-sm text-muted-foreground">
              Processando {positions.length} ativos
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

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {importResult.success}
                </p>
                <p className="text-xs text-emerald-600">Importados</p>
              </div>
              <div className="rounded-lg border bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">
                  {importResult.created}
                </p>
                <p className="text-xs text-blue-600">Ativos criados</p>
              </div>
              <div className="rounded-lg border bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {importResult.failed}
                </p>
                <p className="text-xs text-red-600">Falharam</p>
              </div>
            </div>

            {importResult.created > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                {importResult.created} ativos novos foram cadastrados
                automaticamente no sistema.
              </p>
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
                disabled={positions.length === 0 || !brokerId}
              >
                Importar {positions.length} posicoes
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
