"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdjustPrice } from "@/hooks/useAdjustPrice";
import { formatCurrency } from "@/lib/utils/format";
import type { Currency } from "@/types/database";
import type { PriceAdjustment } from "@/types/database";

interface PriceAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingId: string;
  ticker: string;
  currentAvgPrice: number;
  currency: Currency;
  adjustments: PriceAdjustment[];
}

export function PriceAdjustDialog({
  open,
  onOpenChange,
  holdingId,
  ticker,
  currentAvgPrice,
  currency,
  adjustments,
}: PriceAdjustDialogProps) {
  const [newPrice, setNewPrice] = useState("");
  const [note, setNote] = useState("");
  const adjustPrice = useAdjustPrice();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;

    adjustPrice.mutate(
      { holdingId, newPrice: price, note: note || undefined },
      {
        onSuccess: () => {
          setNewPrice("");
          setNote("");
          onOpenChange(false);
        },
      }
    );
  }

  const currencySymbol = currency === "USD" ? "US$" : "R$";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar Preco Medio - {ticker}</DialogTitle>
          <DialogDescription>
            Preco medio atual: {currentAvgPrice > 0 ? formatCurrency(currentAvgPrice, currency) : "Nao definido"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPrice">Novo Preco Medio ({currencySymbol})</Label>
            <Input
              id="newPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Input
              id="note"
              type="text"
              placeholder="Ex: Preco de compra na Binance"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={adjustPrice.isPending}>
              {adjustPrice.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>

        {adjustments.length > 0 && (
          <div className="mt-2 border-t pt-4">
            <h4 className="text-sm font-medium mb-2">Historico de ajustes</h4>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {[...adjustments].reverse().map((adj, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground border-l-2 border-muted pl-3 py-1"
                >
                  <div className="font-medium text-foreground">
                    {formatCurrency(adj.oldPrice, currency)} → {formatCurrency(adj.newPrice, currency)}
                  </div>
                  <div>
                    {new Date(adj.date).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {adj.note && <div className="italic">{adj.note}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
