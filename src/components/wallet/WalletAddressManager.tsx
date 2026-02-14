"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useUpdateWalletAddresses, useWalletSync } from "@/hooks/useWalletSync";
import { createClient } from "@/lib/supabase/client";
import { validateAddress } from "@/lib/api/blockchain";
import { CHAIN_OPTIONS } from "@/lib/utils/constants";
import { Loader2, Plus, Trash2, RefreshCw, Save } from "lucide-react";
import type { ChainId, WalletAddress } from "@/types/database";

interface WalletAddressManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerId: string;
  brokerName: string;
  initialAddresses: WalletAddress[];
  lastSyncedAt: string | null;
}

export function WalletAddressManager({
  open,
  onOpenChange,
  brokerId,
  brokerName,
  initialAddresses,
  lastSyncedAt,
}: WalletAddressManagerProps) {
  const updateAddresses = useUpdateWalletAddresses();
  const walletSync = useWalletSync();

  const [addresses, setAddresses] = useState<WalletAddress[]>(initialAddresses);
  const [newChain, setNewChain] = useState<ChainId>("arbitrum");
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [validationError, setValidationError] = useState("");

  const handleAdd = () => {
    setValidationError("");

    if (!newAddress.trim()) {
      setValidationError("Endereco obrigatorio");
      return;
    }

    if (!validateAddress(newChain, newAddress.trim())) {
      setValidationError("Endereco invalido para esta rede");
      return;
    }

    const exists = addresses.some(
      (a) => a.chain === newChain && a.address.toLowerCase() === newAddress.trim().toLowerCase()
    );
    if (exists) {
      setValidationError("Este endereco ja foi adicionado nesta rede");
      return;
    }

    setAddresses([
      ...addresses,
      { chain: newChain, address: newAddress.trim(), label: newLabel.trim() || undefined },
    ]);
    setNewAddress("");
    setNewLabel("");
  };

  const handleRemove = (index: number) => {
    setAddresses(addresses.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    await updateAddresses.mutateAsync({ brokerId, addresses });
  };

  const handleSync = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Save first, then sync
    await updateAddresses.mutateAsync({ brokerId, addresses });
    await walletSync.mutateAsync({ brokerId, userId: user.id });
  };

  const chainLabel = (chain: ChainId) =>
    CHAIN_OPTIONS.find((c) => c.value === chain)?.label || chain;

  const isSyncing = walletSync.isPending || updateAddresses.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enderecos - {brokerName}</DialogTitle>
          <DialogDescription>
            Adicione os enderecos publicos da sua carteira para sincronizar saldos automaticamente.
          </DialogDescription>
        </DialogHeader>

        {/* Sync button - prominent */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <Button
            className="flex-1"
            size="lg"
            onClick={handleSync}
            disabled={addresses.length === 0 || isSyncing}
          >
            {walletSync.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar Saldos
          </Button>
          {lastSyncedAt && (
            <p className="shrink-0 text-xs text-muted-foreground">
              Ultimo sync:<br />
              {new Date(lastSyncedAt).toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          {/* Existing addresses */}
          {addresses.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Enderecos cadastrados ({addresses.length})</Label>
              <div className="space-y-2">
                {addresses.map((addr, i) => (
                  <div
                    key={`${addr.chain}-${addr.address}`}
                    className="flex items-center gap-2 rounded-lg border p-2"
                  >
                    <Badge variant="secondary" className="shrink-0">
                      {chainLabel(addr.chain)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-mono">{addr.address}</div>
                      {addr.label && (
                        <div className="text-xs text-muted-foreground">{addr.label}</div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive"
                      onClick={() => handleRemove(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new address */}
          <div className="space-y-3 rounded-lg border p-3">
            <Label>Adicionar endereco</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rede</Label>
                <Select value={newChain} onValueChange={(v) => setNewChain(v as ChainId)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAIN_OPTIONS.map((chain) => (
                      <SelectItem key={chain.value} value={chain.value}>
                        {chain.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Label (opcional)</Label>
                <Input
                  placeholder="Ex: Ledger"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {newChain === "bitcoin" ? "Endereco ou xpub (recomendado)" : "Endereco publico"}
              </Label>
              <Input
                placeholder={
                  newChain === "bitcoin"
                    ? "xpub6... ou zpub... (Ledger Live > Conta > xpub)"
                    : newChain === "solana"
                      ? "7xKp..."
                      : newChain === "xrpl"
                        ? "r..."
                        : "0x..."
                }
                value={newAddress}
                onChange={(e) => {
                  setNewAddress(e.target.value);
                  setValidationError("");
                }}
                className="font-mono text-sm"
              />
              {validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleAdd} className="w-full">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateAddresses.isPending}
          >
            {updateAddresses.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
