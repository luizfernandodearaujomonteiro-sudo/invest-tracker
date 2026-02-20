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
import { toast } from "sonner";
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
  fund: "Fundo",
};

interface CvmFundResult {
  cnpj: string;
  name: string;
  classe: string;
  gestor: string;
  admin: string;
}

const FII_TYPES: AssetType[] = ["br_fii"];
const STOCK_TYPES: AssetType[] = ["br_stock", "us_stock", "br_etf", "us_etf", "br_bdr"];
const US_TYPES: AssetType[] = ["us_stock", "us_etf"];
const FIXED_INCOME_INDICES = [
  { value: "cdi", label: "CDI" },
  { value: "selic", label: "SELIC" },
  { value: "ipca", label: "IPCA+" },
  { value: "prefixado", label: "Prefixado" },
];

// Auto-detecta indice e taxa pelo ticker/nome do ativo de renda fixa
function detectFixedIncomeIndex(ticker: string, name: string): { index: string; rate: string; rateEditable: boolean } {
  const t = ticker.toUpperCase();
  const n = name.toUpperCase();

  // Tesouro Selic / LFT → sempre 100% da SELIC
  if (t.includes("SELIC") || n.includes("LFT")) {
    return { index: "selic", rate: "100", rateEditable: false };
  }
  // Tesouro IPCA+ / NTN-B → IPCA + spread (usuario precisa informar)
  if (t.includes("IPCA") || n.includes("NTNB") || n.includes("NTN-B") || t === "TD-RENDA") {
    return { index: "ipca", rate: "", rateEditable: true };
  }
  // Tesouro Prefixado / LTN / NTN-F
  if (t.includes("PRE") || n.includes("LTN") || n.includes("NTNF") || n.includes("NTN-F") || n.includes("PREFIXADO")) {
    return { index: "prefixado", rate: "", rateEditable: true };
  }
  // CDB/LCI/LCA/CRA/LC CDI (CDB sem IPCA/PRE no nome = CDI por padrao)
  if (t.includes("CDI") || n.includes("CDI")) {
    return { index: "cdi", rate: "100", rateEditable: true };
  }
  if (t.includes("CDB") || n.includes("CDB")) {
    return { index: "cdi", rate: "100", rateEditable: true };
  }
  if (t.includes("LCI") || t.includes("LCA") || t.includes("CRI") || t.includes("CRA") || t.includes("LC-")) {
    return { index: "cdi", rate: "100", rateEditable: true };
  }
  // Fallback: nao conseguiu detectar
  return { index: "", rate: "", rateEditable: true };
}

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
  // Criar novo ativo de renda fixa
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [creatingAsset, setCreatingAsset] = useState(false);
  // Fund-specific state
  const [fundSearchResults, setFundSearchResults] = useState<CvmFundResult[]>([]);
  const [searchingFunds, setSearchingFunds] = useState(false);
  const [fundTotalAppliedRaw, setFundTotalAppliedRaw] = useState("");
  const [fundCurrentValueRaw, setFundCurrentValueRaw] = useState("");
  const [fundVlQuota, setFundVlQuota] = useState<number | null>(null);
  const [fetchingQuota, setFetchingQuota] = useState(false);
  const [fundCnpj, setFundCnpj] = useState("");
  // US-specific state
  const [usValueAppliedRaw, setUsValueAppliedRaw] = useState("");

  const isFundMarket = market === "funds";

  const activeTypes: AssetType[] = useMemo(() => {
    if (market === "crypto") return ["crypto"];
    if (market === "fixed") return ["fixed_income"];
    if (market === "funds") return ["fund"];
    if (market === "br") return ["br_stock", "br_fii", "br_bdr", "br_etf"];
    if (market === "us") return ["us_stock", "us_etf"];
    return [];
  }, [market]);

  // Search assets (Supabase for non-fund, CVM API for funds)
  useEffect(() => {
    if (searchTerm.length < 2 || activeTypes.length === 0) {
      setAssets([]);
      setFundSearchResults([]);
      return;
    }

    if (isFundMarket) {
      // Fund search via CVM API
      if (searchTerm.length < 3) return;
      const timer = setTimeout(async () => {
        setSearchingFunds(true);
        try {
          const res = await fetch(`/api/funds/search?q=${encodeURIComponent(searchTerm)}`);
          if (res.ok) {
            const data = await res.json();
            setFundSearchResults(data.results || []);
          }
        } catch {
          setFundSearchResults([]);
        } finally {
          setSearchingFunds(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }

    // Regular asset search via Supabase
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
  }, [searchTerm, activeTypes, isFundMarket]);

  // Auto-fetch current price when asset is selected
  useEffect(() => {
    if (!selectedAssetCache || selectedAssetCache.asset_type === "fixed_income" || selectedAssetCache.asset_type === "fund") {
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

  // Auto-fetch VL_QUOTA when a fund is selected
  useEffect(() => {
    if (!fundCnpj || !selectedAssetCache || selectedAssetCache.asset_type !== "fund") {
      setFundVlQuota(null);
      return;
    }
    let cancelled = false;
    setFetchingQuota(true);
    fetch(`/api/funds/quota?cnpj=${fundCnpj}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.vlQuota) setFundVlQuota(data.vlQuota);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetchingQuota(false);
      });
    return () => { cancelled = true; };
  }, [fundCnpj, selectedAssetCache]);

  const selectedAsset = selectedAssetCache?.id === assetId
    ? selectedAssetCache
    : assets.find((a) => a.id === assetId) || null;
  const currencySymbol = selectedAsset?.currency === "USD" ? "US$" : "R$";
  const showAssetSearch = market !== "";

  const isFII = selectedAsset ? FII_TYPES.includes(selectedAsset.asset_type) : false;
  const isStock = selectedAsset ? STOCK_TYPES.includes(selectedAsset.asset_type) : false;
  const isUS = selectedAsset ? US_TYPES.includes(selectedAsset.asset_type) : false;
  const isFixedIncome = selectedAsset?.asset_type === "fixed_income";
  const isFund = selectedAsset?.asset_type === "fund";

  // Detecta se a taxa e editavel baseado no ativo selecionado
  const fixedIncomeDetected = useMemo(() => {
    if (!selectedAsset || selectedAsset.asset_type !== "fixed_income") return null;
    return detectFixedIncomeIndex(selectedAsset.ticker, selectedAsset.name);
  }, [selectedAsset]);

  const isRateEditable = fixedIncomeDetected?.rateEditable ?? true;
  const detectedIndexLabel = FIXED_INCOME_INDICES.find(i => i.value === fixedIncomeIndex)?.label || fixedIncomeIndex;

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

  // US: user enters Valor Aplicado + Preço Médio → compute quantity
  const usValueApplied = parseCurrencyInput(usValueAppliedRaw);
  const usCalcQty = isUS && avgPrice > 0 ? usValueApplied / avgPrice : 0;
  const usCalcRentValue = isUS && currentPrice && usCalcQty > 0
    ? (currentPrice - avgPrice) * usCalcQty
    : null;
  const usCalcRentPercent = isUS && currentPrice && avgPrice > 0
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
    setShowCreateAsset(false);
    setNewAssetName("");
    setFundSearchResults([]);
    setSearchingFunds(false);
    setFundTotalAppliedRaw("");
    setFundCurrentValueRaw("");
    setFundVlQuota(null);
    setFetchingQuota(false);
    setFundCnpj("");
    setUsValueAppliedRaw("");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isUS) {
      // US stocks/ETFs: user entered Valor Aplicado + Preço Médio
      const computedQty = avgPrice > 0 ? usValueApplied / avgPrice : 0;
      const dividendsValue = parseCurrencyInput(dividendsRaw);
      await importPosition.mutateAsync({
        assetId,
        brokerId,
        quantity: computedQty,
        averagePrice: avgPrice,
        dividendsAccumulated: dividendsValue > 0 ? dividendsValue : undefined,
        rentComProventos: usCalcRentPercent ?? undefined,
        rentBruta: usCalcRentValue ?? undefined,
      });
    } else if (isFund) {
      const totalApplied = parseCurrencyInput(fundTotalAppliedRaw);
      const currentVal = parseCurrencyInput(fundCurrentValueRaw);

      // Derive cotas from current position / VL_QUOTA
      let cotas = 1;
      let avgPrice = totalApplied;
      if (fundVlQuota && fundVlQuota > 0 && currentVal > 0) {
        cotas = currentVal / fundVlQuota;
        avgPrice = totalApplied / cotas;
      }

      await importPosition.mutateAsync({
        assetId,
        brokerId,
        quantity: cotas,
        averagePrice: avgPrice,
      });
    } else if (isFixedIncome) {
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
                  <SelectItem value="funds">Fundos de Investimento</SelectItem>
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
                {/* Fund search results (from CVM) */}
                {isFundMarket && searchingFunds && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Buscando fundos...
                  </div>
                )}
                {isFundMarket && !searchingFunds && searchTerm.length >= 3 && fundSearchResults.length > 0 && !selectedAsset && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {fundSearchResults.map((fund) => (
                      <button
                        key={fund.cnpj}
                        type="button"
                        className="flex w-full flex-col gap-0.5 px-3 py-2 text-sm hover:bg-accent text-left"
                        onClick={async () => {
                          // Create fund asset via API
                          setCreatingAsset(true);
                          try {
                            const ticker = fund.name
                              .toUpperCase()
                              .replace(/[^A-Z0-9\s]/g, "")
                              .split(/\s+/)
                              .filter((w: string) => !["DE", "EM", "DO", "DA", "E", "A", "O", "FUNDO", "INVESTIMENTO", "INVESTIMENTOS", "RESPONSABILIDADE", "LIMITADA", "RL"].includes(w))
                              .slice(0, 3)
                              .join("-") || "FUNDO";
                            const res = await fetch("/api/assets/create", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                ticker,
                                name: fund.name,
                                assetType: "fund",
                                currency: "BRL",
                                exchange: "CVM",
                                cnpj: fund.cnpj,
                              }),
                            });
                            const data = await res.json();
                            if (!res.ok || data.error) {
                              toast.error("Erro ao criar ativo", {
                                description: data.error || "Verifique se a migration 010 foi rodada no Supabase",
                              });
                              return;
                            }
                            if (data.asset) {
                              const created = data.asset as Asset;
                              setAssetId(created.id);
                              setSearchTerm(created.name);
                              setSelectedAssetCache(created);
                              setFundSearchResults([]);
                              setFundCnpj(fund.cnpj);
                            }
                          } catch (err) {
                            toast.error("Erro ao criar ativo de fundo", {
                              description: String(err),
                            });
                          } finally {
                            setCreatingAsset(false);
                          }
                        }}
                      >
                        <span className="font-medium text-xs">{fund.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">CNPJ: {fund.cnpj}</span>
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{fund.classe}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {isFundMarket && !searchingFunds && searchTerm.length >= 3 && fundSearchResults.length === 0 && !selectedAsset && (
                  <div className="text-sm text-muted-foreground py-2">
                    <p>Nenhum fundo encontrado.</p>
                    <p className="text-xs mt-1">Dica: Use o nome oficial CVM (ex: &quot;TREND VALOR BRASIL&quot; em vez de nomes comerciais). Sincronize o cadastro CVM nas Configuracoes primeiro.</p>
                  </div>
                )}

                {/* Regular asset search results (Supabase) */}
                {!isFundMarket && searchTerm.length >= 2 && assets.length > 0 && !selectedAsset && (
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
                          setShowCreateAsset(false);
                          // Auto-detectar indice para renda fixa
                          if (asset.asset_type === "fixed_income") {
                            const detected = detectFixedIncomeIndex(asset.ticker, asset.name);
                            setFixedIncomeIndex(detected.index);
                            setFixedIncomeRateRaw(detected.rate);
                          }
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

                {/* Criar novo ativo US */}
                {market === "us" && searchTerm.length >= 2 && !selectedAsset && !showCreateAsset && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      setShowCreateAsset(true);
                      setNewAssetName(searchTerm.toUpperCase());
                    }}
                  >
                    Nao encontrou? Cadastrar novo ativo US
                  </button>
                )}

                {market === "us" && showCreateAsset && !selectedAsset && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="text-sm font-medium">Novo ativo US</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Ticker</Label>
                        <Input
                          placeholder="Ex: AAPL"
                          value={newAssetName}
                          onChange={(e) => setNewAssetName(e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={fixedIncomeIndex || "us_stock"} onValueChange={setFixedIncomeIndex}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us_stock">Acao US</SelectItem>
                            <SelectItem value="us_etf">ETF US</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newAssetName.trim() || creatingAsset}
                      onClick={async () => {
                        setCreatingAsset(true);
                        const ticker = newAssetName.trim().toUpperCase();
                        const assetType = fixedIncomeIndex === "us_etf" ? "us_etf" : "us_stock";
                        try {
                          const res = await fetch("/api/assets/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ticker,
                              name: ticker,
                              assetType,
                              currency: "USD",
                              exchange: "NYSE",
                            }),
                          });
                          const data = await res.json();
                          if (data.asset) {
                            const created = data.asset as Asset;
                            setAssetId(created.id);
                            setSearchTerm(created.ticker);
                            setSelectedAssetCache(created);
                            setShowCreateAsset(false);
                          }
                        } catch {
                          toast.error("Erro ao criar ativo US");
                        } finally {
                          setCreatingAsset(false);
                        }
                      }}
                    >
                      {creatingAsset && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Criar e selecionar
                    </Button>
                  </div>
                )}

                {/* Criar novo ativo de renda fixa */}
                {market === "fixed" && searchTerm.length >= 2 && !selectedAsset && !showCreateAsset && (
                  <button
                    type="button"
                    className="text-sm text-primary hover:underline"
                    onClick={() => {
                      setShowCreateAsset(true);
                      setNewAssetName(searchTerm);
                    }}
                  >
                    Nao encontrou? Criar novo ativo de renda fixa
                  </button>
                )}

                {showCreateAsset && !selectedAsset && (
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="text-sm font-medium">Novo ativo de renda fixa</div>
                    <div className="space-y-2">
                      <Label>Nome do produto</Label>
                      <Input
                        placeholder="Ex: CDB Banco XP JUN/2027"
                        value={newAssetName}
                        onChange={(e) => setNewAssetName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use o nome que aparece na sua corretora
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!newAssetName.trim() || creatingAsset}
                      onClick={async () => {
                        setCreatingAsset(true);
                        // Gerar ticker a partir do nome
                        const ticker = newAssetName
                          .trim()
                          .toUpperCase()
                          .replace(/[^A-Z0-9/\- ]/g, "")
                          .replace(/\s+/g, "-")
                          .slice(0, 30);
                        try {
                          const res = await fetch("/api/assets/create", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              ticker,
                              name: newAssetName.trim(),
                              assetType: "fixed_income",
                              currency: "BRL",
                              exchange: "Renda Fixa",
                            }),
                          });
                          const data = await res.json();
                          if (data.asset) {
                            const created = data.asset as Asset;
                            setAssetId(created.id);
                            setSearchTerm(created.ticker);
                            setSelectedAssetCache(created);
                            setShowCreateAsset(false);
                            // Auto-detectar indice
                            const detected = detectFixedIncomeIndex(created.ticker, created.name);
                            setFixedIncomeIndex(detected.index);
                            setFixedIncomeRateRaw(detected.rate);
                          }
                        } catch {
                          // silently fail
                        } finally {
                          setCreatingAsset(false);
                        }
                      }}
                    >
                      {creatingAsset && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Criar e selecionar
                    </Button>
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

                {/* === FUNDO DE INVESTIMENTO: campos especificos === */}
                {isFund ? (
                  <>
                    {/* VL_QUOTA loading/display */}
                    {fetchingQuota && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Buscando valor da cota na CVM...
                      </div>
                    )}
                    {fundVlQuota && !fetchingQuota && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Valor da Cota (VL_QUOTA CVM)</div>
                        <div className="text-lg font-bold">
                          R$ {fundVlQuota.toLocaleString("pt-BR", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor Aplicado</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input
                            className="pl-10"
                            placeholder="0,00"
                            value={formatCurrencyInput(fundTotalAppliedRaw)}
                            onChange={(e) => handleMaskedChange(e, setFundTotalAppliedRaw)}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Copie da XP</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Posicao Atual</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                          <Input
                            className="pl-10"
                            placeholder="0,00"
                            value={formatCurrencyInput(fundCurrentValueRaw)}
                            onChange={(e) => handleMaskedChange(e, setFundCurrentValueRaw)}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Copie da XP</p>
                      </div>
                    </div>

                    {/* Resumo calculado */}
                    {parseCurrencyInput(fundTotalAppliedRaw) > 0 && parseCurrencyInput(fundCurrentValueRaw) > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                        {fundVlQuota && fundVlQuota > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground">Cotas calculadas</div>
                            <div className="text-sm font-medium">
                              {(parseCurrencyInput(fundCurrentValueRaw) / fundVlQuota).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} cotas
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-xs text-muted-foreground">Rentabilidade</div>
                          <div className={`text-lg font-bold ${parseCurrencyInput(fundCurrentValueRaw) >= parseCurrencyInput(fundTotalAppliedRaw) ? "text-emerald-600" : "text-red-600"}`}>
                            R$ {(parseCurrencyInput(fundCurrentValueRaw) - parseCurrencyInput(fundTotalAppliedRaw)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {" "}
                            ({(((parseCurrencyInput(fundCurrentValueRaw) / parseCurrencyInput(fundTotalAppliedRaw)) - 1) * 100).toFixed(2)}%)
                          </div>
                        </div>
                        {!fundVlQuota && !fetchingQuota && (
                          <p className="text-xs text-amber-500">
                            Nao foi possivel buscar o VL_QUOTA da CVM. O fundo sera importado sem calculo automatico de cotas.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                <>
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

                {/* === US STOCKS/ETFs: Valor Aplicado + Preço Médio === */}
                {isUS ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Valor Aplicado (US$)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">US$</span>
                          <Input
                            className="pl-12"
                            placeholder="0,00"
                            value={formatCurrencyInput(usValueAppliedRaw)}
                            onChange={(e) => handleMaskedChange(e, setUsValueAppliedRaw)}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Total investido neste ativo</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Preco Medio (US$)</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">US$</span>
                          <Input
                            className="pl-12"
                            placeholder="0,00"
                            value={formatCurrencyInput(averagePriceRaw)}
                            onChange={(e) => handleMaskedChange(e, setAveragePriceRaw)}
                            required
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Preco medio por acao/cota</p>
                      </div>
                    </div>

                    {/* Dividendos recebidos (opcional) */}
                    <div className="space-y-2">
                      <Label>Dividendos Recebidos (US$) <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">US$</span>
                        <Input
                          className="pl-12"
                          placeholder="0,00"
                          value={formatCurrencyInput(dividendsRaw)}
                          onChange={(e) => handleMaskedChange(e, setDividendsRaw)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Total de dividendos ja recebidos</p>
                    </div>

                    {/* Resumo calculado */}
                    {usValueApplied > 0 && avgPrice > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Quantidade calculada</div>
                          <div className="text-sm font-medium">
                            {usCalcQty.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} acoes/cotas
                          </div>
                        </div>
                        {currentPrice && usCalcRentValue !== null && (
                          <div>
                            <div className="text-xs text-muted-foreground">Rentabilidade</div>
                            <div className={`text-lg font-bold ${usCalcRentValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              US$ {usCalcRentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {" "}
                              ({usCalcRentPercent !== null ? `${usCalcRentPercent >= 0 ? "+" : ""}${usCalcRentPercent.toFixed(2)}%` : "--"})
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : isFixedIncome ? (
                  <>
                    {/* Badge mostrando indice detectado */}
                    {fixedIncomeIndex && (
                      <div className="rounded-lg border bg-muted/50 p-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-muted-foreground">Indice detectado</div>
                          <div className="text-sm font-medium">
                            {detectedIndexLabel}
                            {!isRateEditable && ` ${fixedIncomeRateRaw}%`}
                          </div>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                          Automatico
                        </span>
                      </div>
                    )}

                    {/* Indice manual (so aparece se nao foi detectado) */}
                    {!fixedIncomeIndex && (
                      <div className="space-y-2">
                        <Label>Indice</Label>
                        <Select
                          value={fixedIncomeIndex}
                          onValueChange={(v) => {
                            setFixedIncomeIndex(v);
                            if (v === "selic") setFixedIncomeRateRaw("100");
                            else if (v === "cdi") setFixedIncomeRateRaw("100");
                            else setFixedIncomeRateRaw("");
                          }}
                        >
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
                    )}

                    {/* Taxa/Spread (so aparece quando editavel) */}
                    {isRateEditable && fixedIncomeIndex && (
                      <div className="space-y-2">
                        <Label>
                          {fixedIncomeIndex === "cdi" ? "% do CDI" :
                           fixedIncomeIndex === "ipca" ? "Spread IPCA+ (% a.a.)" :
                           "Taxa (% a.a.)"}
                          <span className="text-muted-foreground font-normal ml-1">(opcional)</span>
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {fixedIncomeIndex === "cdi" ? "Ex: CDB 100% do CDI" :
                           fixedIncomeIndex === "ipca" ? "Ex: IPCA + 6,50% → digite 6.50. Se nao souber, deixe vazio." :
                           fixedIncomeIndex === "prefixado" ? "Taxa fixa contratada" :
                           "Deixe vazio se nao souber"}
                        </p>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={fixedIncomeRateRaw}
                            onChange={(e) => setFixedIncomeRateRaw(e.target.value)}
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Total Aplicado</Label>
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
                        <Label>Posicao Atual</Label>
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
                    </div>

                    {/* Rendimento calculado da importacao */}
                    {parseCurrencyInput(averagePriceRaw) > 0 && parseCurrencyInput(snapshotValueRaw) > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-3">
                        <div className="text-xs text-muted-foreground">Rendimento Acumulado</div>
                        <div className={`text-lg font-bold ${parseCurrencyInput(snapshotValueRaw) >= parseCurrencyInput(averagePriceRaw) ? "text-emerald-600" : "text-red-600"}`}>
                          R$ {(parseCurrencyInput(snapshotValueRaw) - parseCurrencyInput(averagePriceRaw)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {" "}
                          ({(((parseCurrencyInput(snapshotValueRaw) / parseCurrencyInput(averagePriceRaw)) - 1) * 100).toFixed(2)}%)
                        </div>
                      </div>
                    )}

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
                {((isStock && !isUS) || selectedAsset?.asset_type === "crypto") && calcRentValue !== null && (
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
            <Button type="submit" disabled={importPosition.isPending || !assetId || !brokerId || (!isFixedIncome && !isFund && !isUS && !quantity) || (isUS && (!usValueAppliedRaw || !averagePriceRaw)) || (isFixedIncome && !averagePriceRaw) || (isFund && (!fundTotalAppliedRaw || !fundCurrentValueRaw))}>
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
