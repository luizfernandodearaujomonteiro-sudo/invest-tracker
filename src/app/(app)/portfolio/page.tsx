"use client";

import { useState } from "react";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useBrokers } from "@/hooks/useBrokers";
import { useWalletSync } from "@/hooks/useWalletSync";
import { createClient } from "@/lib/supabase/client";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PortfolioPage() {
  const { data: assets, isLoading } = usePortfolio();
  const { data: brokers } = useBrokers();
  const walletSync = useWalletSync();
  const [brokerFilter, setBrokerFilter] = useState("all");
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [syncingWallets, setSyncingWallets] = useState(false);

  const walletBrokers = (brokers || []).filter(
    (b) => b.broker_type === "wallet" && b.wallet_addresses && b.wallet_addresses.length > 0
  );

  const handleSyncCryptos = async () => {
    if (walletBrokers.length === 0) {
      toast.info("Nenhuma carteira com enderecos configurados");
      return;
    }

    setSyncingWallets(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSyncingWallets(false); return; }

    try {
      for (const broker of walletBrokers) {
        await walletSync.mutateAsync({ brokerId: broker.id, userId: user.id });
      }
    } catch {
      // errors already handled by the mutation's onError
    } finally {
      setSyncingWallets(false);
    }
  };

  const filteredAssets = (assets || []).filter((a) =>
    brokerFilter === "all" ? true : a.brokerId === brokerFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground">
            Todos os seus ativos em detalhe
          </p>
        </div>
        <div className="flex items-center gap-2">
          {walletBrokers.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSyncCryptos}
              disabled={syncingWallets}
            >
              {syncingWallets ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar Criptos
            </Button>
          )}
          <Button onClick={() => setTxFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transacao
          </Button>
        </div>
      </div>

      {/* Broker filter */}
      <div className="flex items-center gap-4">
        <Select value={brokerFilter} onValueChange={setBrokerFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todas corretoras" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Corretoras</SelectItem>
            {(brokers || []).map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {filteredAssets.length} ativo(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="br">BR</TabsTrigger>
                <TabsTrigger value="us">US</TabsTrigger>
                <TabsTrigger value="crypto">Cripto</TabsTrigger>
                <TabsTrigger value="fixed">Renda Fixa</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4">
                <PortfolioTable assets={filteredAssets} />
              </TabsContent>
              <TabsContent value="br" className="mt-4">
                <PortfolioTable
                  assets={filteredAssets.filter((a) =>
                    ["br_stock", "br_fii", "br_bdr", "br_etf"].includes(
                      a.assetType
                    )
                  )}
                />
              </TabsContent>
              <TabsContent value="us" className="mt-4">
                <PortfolioTable
                  assets={filteredAssets.filter((a) =>
                    ["us_stock", "us_etf"].includes(a.assetType)
                  )}
                />
              </TabsContent>
              <TabsContent value="crypto" className="mt-4">
                <PortfolioTable
                  assets={filteredAssets.filter(
                    (a) => a.assetType === "crypto"
                  )}
                />
              </TabsContent>
              <TabsContent value="fixed" className="mt-4">
                <PortfolioTable
                  assets={filteredAssets.filter(
                    (a) => a.assetType === "fixed_income"
                  )}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <TransactionForm open={txFormOpen} onOpenChange={setTxFormOpen} />
    </div>
  );
}
