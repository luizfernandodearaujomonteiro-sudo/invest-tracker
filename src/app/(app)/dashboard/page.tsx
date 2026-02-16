"use client";

import { usePortfolio, usePortfolioSummary, usePortfolioSummaryByCurrency } from "@/hooks/usePortfolio";
import { PortfolioSummaryCards, CurrencySummaryCards } from "@/components/dashboard/PortfolioSummaryCards";
import { AllocationPieChart } from "@/components/dashboard/AllocationPieChart";
import { PortfolioTable } from "@/components/portfolio/PortfolioTable";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DashboardPage() {
  const { data: assets, isLoading } = usePortfolio();
  const summary = usePortfolioSummary(assets);
  const currencySummaries = usePortfolioSummaryByCurrency(assets);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visao geral dos seus investimentos
        </p>
      </div>

      {/* Summary Cards por Moeda */}
      <CurrencySummaryCards summaries={currencySummaries} />

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <AllocationPieChart assets={assets || []} groupBy="type" />
        <AllocationPieChart assets={assets || []} groupBy="broker" />
      </div>

      {/* Portfolio Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seus Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="br">Acoes BR</TabsTrigger>
              <TabsTrigger value="us">Acoes US</TabsTrigger>
              <TabsTrigger value="crypto">Cripto</TabsTrigger>
              <TabsTrigger value="fixed">Renda Fixa</TabsTrigger>
              <TabsTrigger value="funds">Fundos</TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <PortfolioTable assets={assets || []} />
            </TabsContent>
            <TabsContent value="br" className="mt-4">
              <PortfolioTable
                assets={(assets || []).filter((a) =>
                  ["br_stock", "br_fii", "br_bdr", "br_etf"].includes(
                    a.assetType
                  )
                )}
              />
            </TabsContent>
            <TabsContent value="us" className="mt-4">
              <PortfolioTable
                assets={(assets || []).filter((a) =>
                  ["us_stock", "us_etf"].includes(a.assetType)
                )}
              />
            </TabsContent>
            <TabsContent value="crypto" className="mt-4">
              <PortfolioTable
                assets={(assets || []).filter(
                  (a) => a.assetType === "crypto"
                )}
              />
            </TabsContent>
            <TabsContent value="fixed" className="mt-4">
              <PortfolioTable
                assets={(assets || []).filter(
                  (a) => a.assetType === "fixed_income"
                )}
              />
            </TabsContent>
            <TabsContent value="funds" className="mt-4">
              <PortfolioTable
                assets={(assets || []).filter(
                  (a) => a.assetType === "fund"
                )}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
