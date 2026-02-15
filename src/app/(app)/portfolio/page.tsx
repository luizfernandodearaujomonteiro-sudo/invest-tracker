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
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, RefreshCw, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImportPositionDialog } from "@/components/portfolio/ImportPositionDialog";

export default function PortfolioPage() {
  const { data: assets, isLoading } = usePortfolio();
  const { data: brokers } = useBrokers();
  const walletSync = useWalletSync();
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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

  const allAssets = assets || [];

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
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Posicao
          </Button>
          <Button onClick={() => setTxFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transacao
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-96" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {allAssets.length} ativo(s)
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
                <PortfolioTable assets={allAssets} />
              </TabsContent>
              <TabsContent value="br" className="mt-4">
                <PortfolioTable
                  assets={allAssets.filter((a) =>
                    ["br_stock", "br_fii", "br_bdr", "br_etf"].includes(a.assetType)
                  )}
                />
              </TabsContent>
              <TabsContent value="us" className="mt-4">
                <PortfolioTable
                  assets={allAssets.filter((a) =>
                    ["us_stock", "us_etf"].includes(a.assetType)
                  )}
                />
              </TabsContent>
              <TabsContent value="crypto" className="mt-4">
                <PortfolioTable
                  assets={allAssets.filter((a) => a.assetType === "crypto")}
                />
              </TabsContent>
              <TabsContent value="fixed" className="mt-4">
                <PortfolioTable
                  assets={allAssets.filter((a) => a.assetType === "fixed_income")}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <TransactionForm open={txFormOpen} onOpenChange={setTxFormOpen} />
      <ImportPositionDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
