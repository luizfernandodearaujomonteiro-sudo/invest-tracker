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
import { useManualOverrides } from "@/hooks/useManualOverrides";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import type { Currency, ManualOverrides } from "@/types/database";

interface ManualOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holdingId: string;
  ticker: string;
  currency: Currency;
  currentOverrides: ManualOverrides | null;
  calculatedDividends: number;
  calculatedRentProv: number | null;
  calculatedRentBruta: number | null;
}

export function ManualOverrideDialog({
  open,
  onOpenChange,
  holdingId,
  ticker,
  currency,
  currentOverrides,
  calculatedDividends,
  calculatedRentProv,
  calculatedRentBruta,
}: ManualOverrideDialogProps) {
  const [dividends, setDividends] = useState(
    currentOverrides?.dividendsAccumulated?.toString() ?? ""
  );
  const [rentProv, setRentProv] = useState(
    currentOverrides?.rentComProventos?.toString() ?? ""
  );
  const [rentBruta, setRentBruta] = useState(
    currentOverrides?.rentBruta?.toString() ?? ""
  );
  const mutation = useManualOverrides();

  const currencySymbol = currency === "USD" ? "US$" : "R$";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const overrides: ManualOverrides = {};

    if (dividends.trim()) overrides.dividendsAccumulated = parseFloat(dividends);
    if (rentProv.trim()) overrides.rentComProventos = parseFloat(rentProv);
    if (rentBruta.trim()) overrides.rentBruta = parseFloat(rentBruta);

    mutation.mutate(
      { holdingId, overrides },
      {
        onSuccess: () => onOpenChange(false),
      }
    );
  }

  function handleClear() {
    mutation.mutate(
      {
        holdingId,
        overrides: {
          dividendsAccumulated: undefined,
          rentComProventos: undefined,
          rentBruta: undefined,
        },
      },
      {
        onSuccess: () => {
          setDividends("");
          setRentProv("");
          setRentBruta("");
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Valores - {ticker}</DialogTitle>
          <DialogDescription>
            Ajuste os valores manualmente. Deixe vazio para usar o calculo automatico.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Proventos Acumulados ({currencySymbol})</Label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder={calculatedDividends > 0 ? `Calculado: ${formatCurrency(calculatedDividends, currency)}` : "0.00"}
              value={dividends}
              onChange={(e) => setDividends(e.target.value)}
            />
            {calculatedDividends > 0 && (
              <div className="text-xs text-muted-foreground">
                Via transacoes: {formatCurrency(calculatedDividends, currency)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Rent. com Proventos (%)</Label>
            <Input
              type="number"
              step="any"
              placeholder={calculatedRentProv !== null ? `Calculado: ${formatPercent(calculatedRentProv)}` : "0.00"}
              value={rentProv}
              onChange={(e) => setRentProv(e.target.value)}
            />
            {calculatedRentProv !== null && (
              <div className="text-xs text-muted-foreground">
                Calculado: {formatPercent(calculatedRentProv)}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Rent. Bruta (%)</Label>
            <Input
              type="number"
              step="any"
              placeholder={calculatedRentBruta !== null ? `Calculado: ${formatPercent(calculatedRentBruta)}` : "0.00"}
              value={rentBruta}
              onChange={(e) => setRentBruta(e.target.value)}
            />
            {calculatedRentBruta !== null && (
              <div className="text-xs text-muted-foreground">
                Calculado: {formatPercent(calculatedRentBruta)}
              </div>
            )}
          </div>

          <DialogFooter className="flex gap-2">
            {currentOverrides && Object.keys(currentOverrides).length > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={mutation.isPending}
                className="mr-auto text-muted-foreground"
              >
                Limpar manuais
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
