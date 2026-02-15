"use client";

import { useState, useEffect, useMemo } from "react";
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
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useBrokers } from "@/hooks/useBrokers";
import { createClient } from "@/lib/supabase/client";
import { Loader2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import type { TransactionType, AssetType } from "@/types/database";

interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_type: AssetType;
  currency: "BRL" | "USD";
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssetId?: string;
  defaultBrokerId?: string;
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

export function TransactionForm({
  open,
  onOpenChange,
  defaultAssetId,
  defaultBrokerId,
}: TransactionFormProps) {
  const createTransaction = useCreateTransaction();
  const { data: brokers } = useBrokers();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetCache, setSelectedAssetCache] = useState<Asset | null>(null);
  const [market, setMarket] = useState(""); // br, us, crypto, fixed
  const [assetId, setAssetId] = useState(defaultAssetId || "");
  const [brokerId, setBrokerId] = useState(defaultBrokerId || "");
  const [type, setType] = useState<TransactionType>("buy");
  const [quantity, setQuantity] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [fees, setFees] = useState("");
  const [executedAt, setExecutedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = useState("");
  const [totalPaid, setTotalPaid] = useState("");
  const [fixedIncomeIndex, setFixedIncomeIndex] = useState("");
  const [fixedIncomeRate, setFixedIncomeRate] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Busca preco atual quando um ativo e selecionado
  useEffect(() => {
    if (!selectedAssetCache || selectedAssetCache.asset_type === "fixed_income") return;
    let cancelled = false;
    setFetchingPrice(true);
    fetch(`/api/prices?tickers=${selectedAssetCache.ticker}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const priceInfo = data[selectedAssetCache.ticker];
        if (priceInfo?.currentPrice) {
          setPricePerUnit(String(priceInfo.currentPrice));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setFetchingPrice(false); });
    return () => { cancelled = true; };
  }, [selectedAssetCache]);

  // Tipos ativos baseados no mercado
  const activeTypes: AssetType[] = useMemo(() => {
    if (market === "crypto") return ["crypto"];
    if (market === "fixed") return ["fixed_income"];
    if (market === "br") return ["br_stock", "br_fii", "br_bdr", "br_etf"];
    if (market === "us") return ["us_stock", "us_etf"];
    return [];
  }, [market]);

  // Busca ativos no Supabase quando o usuario digita 2+ caracteres
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

  const selectedAsset = selectedAssetCache?.id === assetId
    ? selectedAssetCache
    : assets.find((a) => a.id === assetId) || null;
  const isFixedIncome = selectedAsset?.asset_type === "fixed_income";
  const isCrypto = selectedAsset?.asset_type === "crypto";
  const isDividend = type === "dividend";
  const currencySymbol = selectedAsset?.currency === "USD" ? "US$" : "R$";

  const filteredAssets = assets;

  const showAssetSearch = market !== "";

  // For crypto: user enters total paid, we calculate unit price
  const computedPricePerUnit = isCrypto
    ? (parseFloat(quantity) || 0) > 0
      ? (parseFloat(totalPaid) || 0) / (parseFloat(quantity) || 1)
      : 0
    : parseFloat(pricePerUnit) || 0;

  const totalValue = isDividend
    ? (parseFloat(pricePerUnit) || 0)
    : isCrypto
      ? (parseFloat(totalPaid) || 0) + (parseFloat(fees) || 0)
      : (parseFloat(quantity) || 0) * (parseFloat(pricePerUnit) || 0) + (parseFloat(fees) || 0);

  // Determina o asset_type baseado no mercado
  const getAssetTypeForCreation = (): AssetType => {
    if (market === "crypto") return "crypto";
    if (market === "fixed") return "fixed_income";
    if (market === "us") return "us_stock";
    return "br_stock";
  };

  const handleCreateAsset = async () => {
    if (!newTicker.trim()) return;
    const supabase = createClient();
    const assetType = getAssetTypeForCreation();
    const currency = (market === "us" || market === "crypto") ? "USD" : "BRL";
    const exchange = market === "br" ? "B3" : market === "us" ? "NYSE" : market === "crypto" ? "CoinGecko" : "Outros";

    const { data, error } = await supabase
      .from("invest_assets")
      .insert({
        ticker: newTicker.trim().toUpperCase(),
        name: newName.trim() || newTicker.trim().toUpperCase(),
        asset_type: assetType,
        currency,
        exchange,
      })
      .select("id, ticker, name, asset_type, currency")
      .single();

    if (error) {
      toast.error(`Erro ao criar ativo: ${error.message}`);
      return;
    }

    // Adiciona ao array local e seleciona
    const created = data as Asset;
    setAssets((prev) => [...prev, created].sort((a, b) => a.ticker.localeCompare(b.ticker)));
    setAssetId(created.id);
    setSelectedAssetCache(created);
    setSearchTerm(created.ticker);
    setCreatingAsset(false);
    setNewTicker("");
    setNewName("");
    toast.success(`${data.ticker} criado com sucesso!`);
  };

  const resetForm = () => {
    setMarket("");
    setSearchTerm("");
    setSelectedAssetCache(null);
    setAssetId(defaultAssetId || "");
    setBrokerId(defaultBrokerId || "");
    setType("buy");
    setQuantity("");
    setPricePerUnit("");
    setTotalPaid("");
    setFees("");
    setNotes("");
    setFixedIncomeIndex("");
    setFixedIncomeRate("");
    setMaturityDate("");
    setCreatingAsset(false);
    setNewTicker("");
    setNewName("");
    setExecutedAt(new Date().toISOString().split("T")[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTransaction.mutateAsync({
      assetId,
      brokerId,
      type,
      quantity: isFixedIncome || isDividend ? 1 : parseFloat(quantity),
      pricePerUnit: isDividend
        ? parseFloat(pricePerUnit)
        : isCrypto ? computedPricePerUnit : parseFloat(pricePerUnit),
      fees: isDividend ? 0 : parseFloat(fees) || 0,
      executedAt: new Date(executedAt).toISOString(),
      notes: notes || undefined,
      fixedIncomeIndex: isFixedIncome ? fixedIncomeIndex : undefined,
      fixedIncomeRate: isFixedIncome && fixedIncomeRate ? parseFloat(fixedIncomeRate) : undefined,
      maturityDate: isFixedIncome && maturityDate ? maturityDate : undefined,
    });
    onOpenChange(false);
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Transacao</DialogTitle>
            <DialogDescription>
              Registre uma compra, venda ou outro movimento
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TransactionType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Compra</SelectItem>
                  <SelectItem value="sell">Venda</SelectItem>
                  <SelectItem value="dividend">Dividendo</SelectItem>
                  <SelectItem value="transfer_in">Transferencia Entrada</SelectItem>
                  <SelectItem value="transfer_out">Transferencia Saida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mercado */}
            <div className="space-y-2">
              <Label>Mercado</Label>
              <Select
                value={market}
                onValueChange={(v) => {
                  setMarket(v);
                  setAssetId("");
                  setSearchTerm("");
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

            {/* Asset search - Input com filtro */}
            {showAssetSearch && !creatingAsset && (
              <div className="space-y-2">
                <Label>Ativo</Label>
                <Input
                  placeholder={
                    market === "crypto"
                      ? "Buscar... (BTC, Bitcoin)"
                      : market === "fixed"
                        ? "Buscar... (CDB, Tesouro)"
                        : "Buscar... (ticker ou nome)"
                  }
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setAssetId("");
                  }}
                />
                {selectedAsset && (
                  <div className="text-sm text-primary font-medium">
                    Selecionado: {selectedAsset.ticker} - {selectedAsset.name}
                  </div>
                )}
                {searchTerm.length >= 2 && filteredAssets.length > 0 && !selectedAsset && (
                  <div className="max-h-48 overflow-y-auto rounded-md border">
                    {filteredAssets.map((asset) => (
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
                {searchTerm.length >= 2 && filteredAssets.length === 0 && !selectedAsset && (
                  <div className="text-sm text-muted-foreground py-2">
                    Nenhum ativo encontrado
                  </div>
                )}
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  onClick={() => {
                    setCreatingAsset(true);
                    setNewTicker("");
                  }}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  Ativo nao encontrado? Cadastrar novo
                </button>
              </div>
            )}

            {/* Criar novo ativo inline */}
            {showAssetSearch && creatingAsset && (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <Label className="text-primary font-medium">Cadastrar Novo Ativo</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Ticker</Label>
                    <Input
                      placeholder="Ex: KNCR11"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nome (opcional)</Label>
                    <Input
                      placeholder="Ex: Kinea Rendimentos"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateAsset}
                    disabled={!newTicker.trim()}
                  >
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                    Criar e Selecionar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreatingAsset(false);
                      setNewTicker("");
                      setNewName("");
                    }}
                  >
                    Voltar
                  </Button>
                </div>
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

            {/* Campos de Renda Fixa (condicionais) */}
            {isFixedIncome && (
              <>
                <div className="space-y-2">
                  <Label>Indexador</Label>
                  <Select value={fixedIncomeIndex} onValueChange={setFixedIncomeIndex}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o indexador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cdi">CDI</SelectItem>
                      <SelectItem value="ipca">IPCA+</SelectItem>
                      <SelectItem value="selic">Selic</SelectItem>
                      <SelectItem value="prefixado">Prefixado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {fixedIncomeIndex === "cdi"
                        ? "% do CDI (ex: 110)"
                        : fixedIncomeIndex === "prefixado"
                          ? "Taxa a.a. % (ex: 12.5)"
                          : "Spread a.a. % (ex: 5.5)"}
                    </Label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder={fixedIncomeIndex === "cdi" ? "110" : "12.5"}
                      value={fixedIncomeRate}
                      onChange={(e) => setFixedIncomeRate(e.target.value)}
                      required
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
            )}

            {/* Quantity & Price - so mostra apos selecionar ativo */}
            {assetId && (
              <>
                {isDividend ? (
                  /* Dividendo: campo unico de valor */
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Proventos Acumulados ({currencySymbol})</Label>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="0.00"
                        value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={executedAt}
                        onChange={(e) => setExecutedAt(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  /* Compra/Venda/Transfer: campos normais */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {!isFixedIncome && (
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
                      )}
                      <div className={isFixedIncome ? "col-span-2 space-y-2" : "space-y-2"}>
                        <Label>
                          {isFixedIncome
                            ? "Valor Aplicado (R$)"
                            : isCrypto
                              ? `Valor Pago (${currencySymbol})`
                              : `Preco Unitario (${currencySymbol})`}
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder={fetchingPrice ? "Buscando..." : "0.00"}
                          value={isCrypto ? totalPaid : pricePerUnit}
                          onChange={(e) => isCrypto ? setTotalPaid(e.target.value) : setPricePerUnit(e.target.value)}
                          required
                        />
                        {!isCrypto && !isFixedIncome && pricePerUnit && !fetchingPrice && (
                          <div className="text-xs text-muted-foreground">Preco atual preenchido automaticamente</div>
                        )}
                      </div>
                    </div>

                    {/* Fees & Date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Taxas</Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0.00"
                          value={fees}
                          onChange={(e) => setFees(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={executedAt}
                          onChange={(e) => setExecutedAt(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Total */}
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-sm text-muted-foreground">
                    {isDividend ? "Valor dos Proventos" : "Valor Total"}
                  </div>
                  <div className="text-lg font-bold">
                    {currencySymbol} {totalValue.toFixed(2)}
                  </div>
                  {isCrypto && computedPricePerUnit > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Preco unitario: {currencySymbol} {computedPricePerUnit.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            {assetId && (
              <div className="space-y-2">
                <Label>Observacoes (opcional)</Label>
                <Input
                  placeholder="Anotacoes sobre esta transacao"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
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
            <Button type="submit" disabled={createTransaction.isPending || !assetId || !brokerId}>
              {createTransaction.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
