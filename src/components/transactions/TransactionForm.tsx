"use client";

import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import type { TransactionType, AssetType } from "@/types/database";

interface Asset {
  id: string;
  ticker: string;
  name: string;
  asset_type: AssetType;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAssetId?: string;
  defaultBrokerId?: string;
}

export function TransactionForm({
  open,
  onOpenChange,
  defaultAssetId,
  defaultBrokerId,
}: TransactionFormProps) {
  const createTransaction = useCreateTransaction();
  const { data: brokers } = useBrokers();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
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

  useEffect(() => {
    const supabase = createClient();
    const fetchAssets = async () => {
      const { data } = await supabase
        .from("assets")
        .select("id, ticker, name, asset_type")
        .eq("is_active", true)
        .order("ticker");
      if (data) setAssets(data as Asset[]);
    };
    if (open) fetchAssets();
  }, [open]);

  const filteredAssets = searchTerm
    ? assets.filter(
        (a) =>
          a.ticker.toLowerCase().includes(searchTerm.toLowerCase()) ||
          a.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : assets;

  const totalValue =
    (parseFloat(quantity) || 0) * (parseFloat(pricePerUnit) || 0) +
    (parseFloat(fees) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTransaction.mutateAsync({
      assetId,
      brokerId,
      type,
      quantity: parseFloat(quantity),
      pricePerUnit: parseFloat(pricePerUnit),
      fees: parseFloat(fees) || 0,
      executedAt: new Date(executedAt).toISOString(),
      notes: notes || undefined,
    });
    onOpenChange(false);
    // Reset form
    setAssetId(defaultAssetId || "");
    setBrokerId(defaultBrokerId || "");
    setType("buy");
    setQuantity("");
    setPricePerUnit("");
    setFees("");
    setNotes("");
    setExecutedAt(new Date().toISOString().split("T")[0]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

            {/* Asset search */}
            <div className="space-y-2">
              <Label>Ativo</Label>
              <Input
                placeholder="Buscar... (PETR4, AAPL, Bitcoin)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Select value={assetId} onValueChange={setAssetId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o ativo" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.ticker} - {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Broker */}
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

            {/* Quantity & Price */}
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
                <Label>Preco Unitario</Label>
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
                R$ {totalValue.toFixed(2)}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observacoes (opcional)</Label>
              <Input
                placeholder="Anotacoes sobre esta transacao"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={createTransaction.isPending}>
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
