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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useCreateTransaction } from "@/hooks/useTransactions";
import { useBrokers } from "@/hooks/useBrokers";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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

// Subcategorias por mercado
const SUBCATEGORIES: Record<string, { label: string; types: AssetType[] }[]> = {
  br: [
    { label: "Acoes", types: ["br_stock"] },
    { label: "FIIs", types: ["br_fii"] },
    { label: "ETFs", types: ["br_etf"] },
    { label: "BDRs", types: ["br_bdr"] },
  ],
  us: [
    { label: "Acoes US", types: ["us_stock"] },
    { label: "ETFs US", types: ["us_etf"] },
  ],
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
  const [market, setMarket] = useState(""); // br, us, crypto, fixed
  const [subCategory, setSubCategory] = useState(""); // br_stock, br_fii, etc.
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
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [newTicker, setNewTicker] = useState("");
  const [newName, setNewName] = useState("");
  const [assetComboOpen, setAssetComboOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const fetchAssets = async () => {
      const { data } = await supabase
        .from("invest_assets")
        .select("id, ticker, name, asset_type, currency")
        .eq("is_active", true)
        .order("ticker");
      if (data) setAssets(data as Asset[]);
    };
    if (open) fetchAssets();
  }, [open]);

  const selectedAsset = assets.find((a) => a.id === assetId);
  const isFixedIncome = selectedAsset?.asset_type === "fixed_income";
  const isCrypto = selectedAsset?.asset_type === "crypto";
  const currencySymbol = selectedAsset?.currency === "USD" ? "US$" : "R$";

  // Tipos ativos baseados no mercado + subcategoria
  const activeTypes: AssetType[] = useMemo(() => {
    if (market === "crypto") return ["crypto"];
    if (market === "fixed") return ["fixed_income"];
    if (subCategory) return [subCategory as AssetType];
    if (market === "br") return ["br_stock", "br_fii", "br_bdr", "br_etf"];
    if (market === "us") return ["us_stock", "us_etf"];
    return [];
  }, [market, subCategory]);

  // Filtra ativos por tipo (Command faz a busca por texto)
  const filteredAssets = useMemo(() => {
    if (activeTypes.length === 0) return [];
    return assets.filter((a) => activeTypes.includes(a.asset_type));
  }, [assets, activeTypes]);

  const showSubCategory = market === "br" || market === "us";
  const showAssetSearch = market === "crypto" || market === "fixed" || subCategory !== "";

  // For crypto: user enters total paid, we calculate unit price
  const computedPricePerUnit = isCrypto
    ? (parseFloat(quantity) || 0) > 0
      ? (parseFloat(totalPaid) || 0) / (parseFloat(quantity) || 1)
      : 0
    : parseFloat(pricePerUnit) || 0;

  const totalValue = isCrypto
    ? (parseFloat(totalPaid) || 0) + (parseFloat(fees) || 0)
    : (parseFloat(quantity) || 0) * (parseFloat(pricePerUnit) || 0) + (parseFloat(fees) || 0);

  // Determina o asset_type baseado no mercado + subcategoria
  const getAssetTypeForCreation = (): AssetType => {
    if (subCategory) return subCategory as AssetType;
    if (market === "crypto") return "crypto";
    if (market === "fixed") return "fixed_income";
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
    setAssets((prev) => [...prev, data as Asset].sort((a, b) => a.ticker.localeCompare(b.ticker)));
    setAssetId(data.id);
    setCreatingAsset(false);
    setNewTicker("");
    setNewName("");
    toast.success(`${data.ticker} criado com sucesso!`);
  };

  const resetForm = () => {
    setMarket("");
    setSubCategory("");
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
      quantity: isFixedIncome ? 1 : parseFloat(quantity),
      pricePerUnit: isCrypto ? computedPricePerUnit : parseFloat(pricePerUnit),
      fees: parseFloat(fees) || 0,
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
                  setSubCategory("");
                  setAssetId("");
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

            {/* Subcategoria (BR ou US) */}
            {showSubCategory && (
              <div className="space-y-2">
                <Label>Tipo de Ativo</Label>
                <Select
                  value={subCategory}
                  onValueChange={(v) => {
                    setSubCategory(v);
                    setAssetId("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(SUBCATEGORIES[market] || []).map((sub) => (
                      <SelectItem key={sub.types[0]} value={sub.types[0]}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Asset search - Combobox com busca integrada */}
            {showAssetSearch && !creatingAsset && (
              <div className="space-y-2">
                <Label>Ativo</Label>
                <Popover open={assetComboOpen} onOpenChange={setAssetComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={assetComboOpen}
                      className="w-full justify-between font-normal"
                      type="button"
                    >
                      {selectedAsset
                        ? `${selectedAsset.ticker} - ${selectedAsset.name}`
                        : "Buscar ativo..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder={
                          market === "crypto"
                            ? "Buscar... (BTC, Bitcoin)"
                            : market === "fixed"
                              ? "Buscar... (CDB, Tesouro)"
                              : "Buscar... (ticker ou nome)"
                        }
                      />
                      <CommandList>
                        <CommandEmpty>Nenhum ativo encontrado</CommandEmpty>
                        <CommandGroup>
                          {filteredAssets.map((asset) => (
                            <CommandItem
                              key={asset.id}
                              value={`${asset.ticker} ${asset.name}`}
                              onSelect={() => {
                                setAssetId(asset.id);
                                setAssetComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  assetId === asset.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="font-medium">{asset.ticker}</span>
                              <span className="ml-1.5 text-muted-foreground">{asset.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                      placeholder="0.00"
                      value={isCrypto ? totalPaid : pricePerUnit}
                      onChange={(e) => isCrypto ? setTotalPaid(e.target.value) : setPricePerUnit(e.target.value)}
                      required
                    />
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

                {/* Total */}
                <div className="rounded-lg border bg-muted/50 p-3">
                  <div className="text-sm text-muted-foreground">Valor Total</div>
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
