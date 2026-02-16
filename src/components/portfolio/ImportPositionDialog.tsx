"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useImportPosition } from "@/hooks/useImportPosition";
import { useBrokers } from "@/hooks/useBrokers";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import type { AssetType } from "@/types/database";

interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_type: AssetType;
  currency: "BRL" | "USD";
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  br_stock: "Acao",
  br_fii: "FII",
  br_etf: "ETF",
  br_bdr: "BDR",
  us_stock: "Acao US",
  us_etf: "ETF US",
  crypto: "Crypto",
  fixed_income: "Renda Fixa",
};

const FII_TYPES: AssetType[] = ["br_fii"];
const STOCK_TYPES: AssetType[] = ["br_stock", "us_stock", "br_etf", "us_etf", "br_bdr"];
const FIXED_INCOME_INDICES = [
  { value: "cdi", label: "CDI" },
  { value: "selic", label: "SELIC" },
  { value: "ipca", label: "IPCA+" },
  { value: "prefixado", label: "Prefixado" },
];

function formatCurrencyInput(raw: string): string {
  if (!raw) return "";
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const formatted = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${formatted}` : formatted;
}

function parseCurrencyInput(raw: string): number {
  if (!raw) return 0;
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const value = parseInt(digits, 10) / 100;
  return isNegative ? -value : value;
}

function formatPercentInput(raw: string): string {
  if (!raw) return "";
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  const formatted = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return isNegative ? `-${formatted}` : formatted;
}

function parsePercentInput(raw: string): number {
  if (!raw) return 0;
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  const value = parseInt(digits, 10) / 100;
  return isNegative ? -value : value;
}

function handleMaskedChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setter: (v: string) => void
) {
  const input = e.target.value;
  const isNegative = input.startsWith("-");
  const digits = input.replace(/\D/g, "");
  setter((isNegative ? "-" : "") + digits);
}

interface ImportPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportPositionDialog({ open, onOpenChange }: ImportPositionDialogProps) {
  const importPosition = useImportPosition();
  const { data: brokers } = useBrokers();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetCache, setSelectedAssetCache] = useState<Asset | null>(null);
  const [market, setMarket] = useState("");
  const [assetId, setAssetId] = useState("");
  const [brokerId, setBrokerId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Position data
  const [quantity, setQuantity] = useState("");
  const [averagePriceRaw, setAveragePriceRaw] = useState("");
  // Current price (auto-fetched)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  // Raw digits for masked fields
  const [dividendsRaw, setDividendsRaw] = useState("");
  const [rentProvRaw, setRentProvRaw] = useState("");
  const [rentBrutaRaw, setRentBrutaRaw] = useState("");
  // Renda fixa fields
  const [fixedIncomeIndex, setFixedIncomeIndex] = useState("");
  const [fixedIncomeRateRaw, setFixedIncomeRateRaw] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [snapshotValueRaw, setSnapshotValueRaw] = useState("");


  const activeTypes: AssetType[] = useMemo(() => {
    if (market === "crypto") return ["crypto"];
    if (market === "fixed") return ["fixed_income"];
    if (market === "br") return ["br_stock", "br_fii", "br_bdr", "br_etf"];
    if (market === "us") return ["us_stock", "us_etf"];
    return [];
  }, [market]);

  // Search assets
  useEffect(() => {
    if (searchTerm.length < 2 || activeTypes.length === 0) {
      setAssets([]);
      return;
    }
    const supabase = createClient();
    const timer = setTimeout(async () => {
      const term = `%${searchTerm}%`;
      const { data } = await supabase
        .from("invest_assets")
        .select("id, ticker, name, asset_type, currency")
        .eq("is_active", true)
        .in("asset_type", activeTypes)
        .or(`ticker.ilike.${term},name.ilike.${term}`)
        .order("ticker")
        .limit(20);
      if (data) setAssets(data as Asset[]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, activeTypes]);

  // Auto-fetch current price when asset is selected
  useEffect(() => {
    if (!selectedAssetCache || selectedAssetCache.asset_type === "fixed_income") {
      setCurrentPrice(null);
      return;
    }
    let cancelled = false;
    setFetchingPrice(true);
    fetch(`/api/prices?tickers=${selectedAssetCache.ticker}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const priceInfo = data[selectedAssetCache.ticker];
        if (priceInfo?.currentPrice) {
          setCurrentPrice(priceInfo.currentPrice);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetchingPrice(false);
      });
    return () => { cancelled = true; };
  }, [selectedAssetCache]);

  const selectedAsset = selectedAssetCache?.id === assetId
    ? selectedAssetCache
    : assets.find((a) => a.id === assetId) || null;
  const currencySymbol = selectedAsset?.currency === "USD" ? "US$" : "R$";
  const showAssetSearch = market !== "";

  const isFII = selectedAsset ? FII_TYPES.includes(selectedAsset.asset_type) : false;
  const isStock = selectedAsset ? STOCK_TYPES.includes(selectedAsset.asset_type) : false;
  const isFixedIncome = selectedAsset?.asset_type === "fixed_income";

  const avgPrice = parseCurrencyInput(averagePriceRaw);
  const qty = parseFloat(quantity) || 0;
  const totalInvested = qty * avgPrice;

  // Auto-calculate rentabilidade for stocks/ETFs/crypto
  const calcRentValue = currentPrice && avgPrice > 0 && qty > 0
    ? (currentPrice - avgPrice) * qty
    : null;
  const calcRentPercent = currentPrice && avgPrice > 0
    ? ((currentPrice - avgPrice) / avgPrice) * 100
    : null;

  const resetForm = useCallback(() => {
    setMarket("");
    setSearchTerm("");
    setSelectedAssetCache(null);
    setAssetId("");
    setBrokerId("");
    setQuantity("");
    setAveragePriceRaw("");
    setCurrentPrice(null);
    setDividendsRaw("");
    setRentProvRaw("");
    setRentBrutaRaw("");
    setFixedIncomeIndex("");
    setFixedIncomeRateRaw("");
    setMaturityDate("");
    setSnapshotValueRaw("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isFixedIncome) {
      const snapshotVal = parseCurrencyInput(snapshotValueRaw);
      const totalApplied = parseCurrencyInput(averagePriceRaw);
      const rateVal = parseFloat(fixedIncomeRateRaw) || 0;

      await importPosition.mutateAsync({
        assetId,
        brokerId,
        quantity: parseFloat(quantity) || 1,
        averagePrice: totalApplied,
        fixedIncomeIndex: fixedIncomeIndex || undefined,
        fixedIncomeRate: rateVal || undefined,
        maturityDate: maturityDate || undefined,
        snapshotValue: snapshotVal > 0 ? snapshotVal : undefined,
      });
    } else if (isFII) {
      const dividendsValue = parseCurrencyInput(dividendsRaw);
      const rentProvValue = parsePercentInput(rentProvRaw);
      const rentBrutaValue = parsePercentInput(rentBrutaRaw);

      await importPosition.mutateAsync({
        assetId,
        brokerId,
        quantity: parseFloat(quantity),
        averagePrice: parseCurrencyInput(averagePriceRaw),
        dividendsAccumulated: dividendsValue > 0 ? dividendsValue : undefined,
        rentComProventos: rentProvRaw ? rentProvValue : undefined,
        rentBruta: rentBrutaRaw ? rentBrutaValue : undefined,
      });
    } else {
      // Stocks, ETFs, BDRs, Crypto — use auto-calculated values
      await importPosition.mutateAsync({
        assetId,
        brokerId,
        quantity: qty,
        averagePrice: avgPrice,
        rentComProventos: calcRentPercent ?? undefined,
        rentBruta: calcRentValue ?? undefined,
      });
    }

    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Importar Posicao</DialogTitle>
            <DialogDescription>
              Importe uma posicao existente da sua corretora com todos os dados de uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mercado */}
            <div className="space-y-2">
              <Label>Mercado</Label>
              <Select
                value={market}
                onValueChange={(v) => {
                  setMarket(v);
                  setAssetId("");
                  setSearchTerm("");
                  setCurrentPrice(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o mercado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="br">Brasil</SelectItem>
                  <SelectItem value="us">Internacional</SelectItem>
                  <SelectItem value="crypto">Criptomoedas</SelectItem>
                  <SelectItem value="fixed">Renda Fixa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Asset search */}
            {showAssetSearch && (
              <div className="space-y-2">
                <Label>Ativo</Label>
                <Input
                  placeholder="Buscar... (ticker ou nome)"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setAssetId("");
                    setCurrentPrice(null);
                  }}
                />
                {selectedAsset && (
                  <div className="text-sm text-primary font-medium">
                    Selecionado: {selectedAsset.ticker} - {selectedAsset.name}
                  </div>
                )}
                {searchTerm.length >= 2 && assets.length > 0 && !selectedAsset && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                        onClick={() => {
                          setAssetId(asset.id);
                          setSearchTerm(asset.ticker);
                          setSelectedAssetCache(asset);
                        }}
                      >
                        <span className="font-medium">{asset.ticker}</span>
                        <span className="text-muted-foreground flex-1">{asset.name}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Broker */}
            {market && (
              <div className="space-y-2">
                <Label>Corretora</Label>
                <Select value={brokerId} onValueChange={setBrokerId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a corretora" />
                  </SelectTrigger>
                  <SelectContent>
                    {(brokers || []).map((broker) => (
                      <SelectItem key={broker.id} value={broker.id}>
                        {broker.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Position data */}
            {assetId && brokerId && (
              <>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Dados da Posicao</h3>
                </div>

                {/* Preco Atual (auto-fetched, nao para renda fixa) */}
                {!isFixedIncome && currentPrice !== null && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <div className="text-sm text-muted-foreground">Preco Atual</div>
                    <div className="text-lg font-bold">
                      {currencySymbol} {currentPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
                {!isFixedIncome && fetchingPrice && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando preco atual...
                  </div>
                )}

                {/* === RENDA FIXA: campos especificos === */}
                {isFixedIncome ? (
                  <>
                    <div className="space-y-2">
                      <Label>Total Aplicado (R$)</Label>
                      <p className="text-xs text-muted-foreground">
                        Valor total que voce investiu (soma de todos os aportes)
                      </p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={formatCurrencyInput(averagePriceRaw)}
                          onChange={(e) => handleMaskedChange(e, setAveragePriceRaw)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Posicao Atual (R$)</Label>
                      <p className="text-xs text-muted-foreground">
                        Valor atual na corretora (inclui rendimentos acumulados)
                      </p>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={formatCurrencyInput(snapshotValueRaw)}
                          onChange={(e) => handleMaskedChange(e, setSnapshotValueRaw)}
                        />
                      </div>
                    </div>

                    {/* Rendimento calculado da importacao */}
                    {parseCurrencyInput(averagePriceRaw) > 0 && parseCurrencyInput(snapshotValueRaw) > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-sm text-muted-foreground">Rendimento Acumulado</div>
                        <div className={`text-lg font-bold ${parseCurrencyInput(snapshotValueRaw) >= parseCurrencyInput(averagePriceRaw) ? "text-emerald-600" : "text-red-600"}`}>
                          R$ {(parseCurrencyInput(snapshotValueRaw) - parseCurrencyInput(averagePriceRaw)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {" "}
                          ({(((parseCurrencyInput(snapshotValueRaw) / parseCurrencyInput(averagePriceRaw)) - 1) * 100).toFixed(2)}%)
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Indice</Label>
                        <Select value={fixedIncomeIndex} onValueChange={setFixedIncomeIndex}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {FIXED_INCOME_INDICES.map((idx) => (
                              <SelectItem key={idx.value} value={idx.value}>
                                {idx.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>
                          {fixedIncomeIndex === "cdi" ? "% do CDI" :
                           fixedIncomeIndex === "ipca" ? "Taxa + IPCA (% a.a.)" :
                           fixedIncomeIndex === "selic" ? "Spread SELIC (% a.a.)" :
                           "Taxa (% a.a.)"}
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder={fixedIncomeIndex === "cdi" ? "100" : "0,00"}
                            value={fixedIncomeRateRaw}
                            onChange={(e) => setFixedIncomeRateRaw(e.target.value)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Vencimento</Label>
                        <Input
                          type="date"
                          value={maturityDate}
                          onChange={(e) => setMaturityDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Preco Medio ({currencySymbol})</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            {currencySymbol}
                          </span>
                          <Input
                            className="pl-10"
                            placeholder="0,00"
                            value={formatCurrencyInput(averagePriceRaw)}
                            onChange={(e) => handleMaskedChange(e, setAveragePriceRaw)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Total investido */}
                    {totalInvested > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-sm text-muted-foreground">Total Investido</div>
                        <div className="text-lg font-bold">
                          {currencySymbol} {totalInvested.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* === FII: Proventos + Rent c/ Prov + Rent Bruta === */}
                {isFII && (
                  <>
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-3">Rentabilidade (opcional)</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Copie os valores da sua corretora. Deixe vazio para calcular automaticamente.
                        Para valores negativos, digite (-) antes.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Proventos Acumulados ({currencySymbol})</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          {currencySymbol}
                        </span>
                        <Input
                          className="pl-10"
                          placeholder="0,00"
                          value={formatCurrencyInput(dividendsRaw)}
                          onChange={(e) => handleMaskedChange(e, setDividendsRaw)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Rent. c/ Proventos</Label>
                        <div className="relative">
                          <Input
                            className="pr-8"
                            placeholder="0,00"
                            value={formatPercentInput(rentProvRaw)}
                            onChange={(e) => handleMaskedChange(e, setRentProvRaw)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Rent. Bruta</Label>
                        <div className="relative">
                          <Input
                            className="pr-8"
                            placeholder="0,00"
                            value={formatPercentInput(rentBrutaRaw)}
                            onChange={(e) => handleMaskedChange(e, setRentBrutaRaw)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* === Stocks/ETFs/BDRs/Crypto: Rentabilidade auto-calculada === */}
                {(isStock || selectedAsset?.asset_type === "crypto") && calcRentValue !== null && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium mb-3">Rentabilidade</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Rentabilidade</div>
                        <div className={`text-lg font-bold ${calcRentPercent !== null && calcRentPercent >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {calcRentPercent !== null
                            ? `${calcRentPercent >= 0 ? "+" : ""}${calcRentPercent.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
                            : "--"}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Rentabilidade ({currencySymbol})</div>
                        <div className={`text-lg font-bold ${calcRentValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {currencySymbol} {calcRentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { resetForm(); onOpenChange(false); }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={importPosition.isPending || !assetId || !brokerId || (!isFixedIncome && !quantity) || (isFixedIncome && !averagePriceRaw)}>
              {importPosition.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Importar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
