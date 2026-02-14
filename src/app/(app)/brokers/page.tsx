"use client";

import { useState } from "react";
import {
  useBrokers,
  useCreateBroker,
  useUpdateBroker,
  useDeleteBroker,
} from "@/hooks/useBrokers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Building2,
  Wallet,
  ArrowRightLeft,
  Pencil,
  Trash2,
  Loader2,
  Link2,
  RefreshCw,
} from "lucide-react";
import { BROKER_SUGGESTIONS } from "@/lib/utils/constants";
import { WalletAddressManager } from "@/components/wallet/WalletAddressManager";
import type { BrokerType } from "@/types/database";

const BROKER_TYPE_LABELS: Record<BrokerType, string> = {
  broker: "Corretora",
  exchange: "Exchange",
  wallet: "Carteira",
};

const BROKER_TYPE_ICONS: Record<BrokerType, typeof Building2> = {
  broker: Building2,
  exchange: ArrowRightLeft,
  wallet: Wallet,
};

export default function BrokersPage() {
  const { data: brokers, isLoading } = useBrokers();
  const createBroker = useCreateBroker();
  const updateBroker = useUpdateBroker();
  const deleteBroker = useDeleteBroker();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [brokerType, setBrokerType] = useState<BrokerType>("broker");
  const [notes, setNotes] = useState("");
  const [walletManagerBrokerId, setWalletManagerBrokerId] = useState<string | null>(null);

  const walletManagerBroker = brokers?.find((b) => b.id === walletManagerBrokerId);

  const resetForm = () => {
    setName("");
    setBrokerType("broker");
    setNotes("");
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleOpenEdit = (broker: {
    id: string;
    name: string;
    broker_type: BrokerType;
    notes: string | null;
  }) => {
    setEditingId(broker.id);
    setName(broker.name);
    setBrokerType(broker.broker_type);
    setNotes(broker.notes || "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateBroker.mutateAsync({
        id: editingId,
        name,
        broker_type: brokerType,
        notes,
      });
    } else {
      await createBroker.mutateAsync({
        name,
        broker_type: brokerType,
        notes,
      });
    }
    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta corretora?")) {
      await deleteBroker.mutateAsync(id);
    }
  };

  const isSubmitting = createBroker.isPending || updateBroker.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Corretoras & Carteiras</h1>
          <p className="text-muted-foreground">
            Gerencie suas corretoras, exchanges e carteiras
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingId ? "Editar Corretora" : "Nova Corretora"}
                </DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Atualize os dados da corretora"
                    : "Adicione uma corretora, exchange ou carteira"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Ex: XP Investimentos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    list="broker-suggestions"
                  />
                  <datalist id="broker-suggestions">
                    {BROKER_SUGGESTIONS.map((s) => (
                      <option key={s.name} value={s.name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select
                    value={brokerType}
                    onValueChange={(v) => setBrokerType(v as BrokerType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broker">Corretora</SelectItem>
                      <SelectItem value="exchange">Exchange</SelectItem>
                      <SelectItem value="wallet">Carteira / Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observacoes (opcional)</Label>
                  <Input
                    id="notes"
                    placeholder="Anotacoes sobre esta corretora"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {editingId ? "Salvar" : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : brokers && brokers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Observacoes
                  </TableHead>
                  <TableHead className="w-24 text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brokers.map((broker) => {
                  const Icon = BROKER_TYPE_ICONS[broker.broker_type];
                  return (
                    <TableRow key={broker.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div>
                            {broker.name}
                            {broker.broker_type === "wallet" && broker.wallet_addresses && broker.wallet_addresses.length > 0 && (
                              <div className="text-xs text-muted-foreground font-normal">
                                {broker.wallet_addresses.length} endereco(s)
                                {broker.last_synced_at && (
                                  <> &middot; Sync: {new Date(broker.last_synced_at).toLocaleDateString("pt-BR")}</>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {BROKER_TYPE_LABELS[broker.broker_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {broker.notes || "--"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {broker.broker_type === "wallet" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Gerenciar enderecos"
                              onClick={() => setWalletManagerBrokerId(broker.id)}
                            >
                              <Link2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(broker)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(broker.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2 text-lg">
              Nenhuma corretora cadastrada
            </CardTitle>
            <CardDescription className="mb-4 text-center">
              Adicione suas corretoras, exchanges ou carteiras para comecar a
              registrar seus investimentos.
            </CardDescription>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Corretora
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick suggestions */}
      {brokers && brokers.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sugestoes rapidas</CardTitle>
            <CardDescription>
              Clique para adicionar rapidamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {BROKER_SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion.name}
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    createBroker.mutate({
                      name: suggestion.name,
                      broker_type: suggestion.type,
                    })
                  }
                  disabled={createBroker.isPending}
                >
                  {suggestion.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet Address Manager Dialog */}
      {walletManagerBroker && (
        <WalletAddressManager
          open={!!walletManagerBrokerId}
          onOpenChange={(open) => {
            if (!open) setWalletManagerBrokerId(null);
          }}
          brokerId={walletManagerBroker.id}
          brokerName={walletManagerBroker.name}
          initialAddresses={walletManagerBroker.wallet_addresses || []}
          lastSyncedAt={walletManagerBroker.last_synced_at}
        />
      )}
    </div>
  );
}
