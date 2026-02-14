"use client";

import { useState } from "react";
import { useTransactions, useDeleteTransaction } from "@/hooks/useTransactions";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { CsvImportDialog } from "@/components/transactions/CsvImportDialog";
import { XpImportDialog } from "@/components/transactions/XpImportDialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, ArrowLeftRight, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/utils/format";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  buy: "Compra",
  sell: "Venda",
  dividend: "Dividendo",
  split: "Desdobramento",
  transfer_in: "Transf. Entrada",
  transfer_out: "Transf. Saida",
};

const TYPE_COLORS: Record<string, string> = {
  buy: "bg-emerald-100 text-emerald-700",
  sell: "bg-red-100 text-red-700",
  dividend: "bg-blue-100 text-blue-700",
  split: "bg-purple-100 text-purple-700",
  transfer_in: "bg-cyan-100 text-cyan-700",
  transfer_out: "bg-orange-100 text-orange-700",
};

export default function TransactionsPage() {
  const { data: transactions, isLoading } = useTransactions();
  const deleteTransaction = useDeleteTransaction();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [xpImportOpen, setXpImportOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja remover esta transacao?")) {
      await deleteTransaction.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transacoes</h1>
          <p className="text-muted-foreground">
            Historico de compras, vendas e movimentacoes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setXpImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar XP
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Transacao
          </Button>
        </div>
      </div>

      <TransactionForm open={formOpen} onOpenChange={setFormOpen} />
      <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <XpImportDialog open={xpImportOpen} onOpenChange={setXpImportOpen} />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : transactions && transactions.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Preco Un.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    Taxas
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: Record<string, unknown>) => {
                  const holdings = tx.invest_holdings as Record<string, unknown> | null;
                  const assets = holdings?.invest_assets as Record<string, unknown> | null;
                  return (
                    <TableRow key={tx.id as string}>
                      <TableCell className="text-sm">
                        {format(
                          new Date(tx.executed_at as string),
                          "dd/MM/yyyy",
                          { locale: ptBR }
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={TYPE_COLORS[tx.type as string] || ""}
                        >
                          {TYPE_LABELS[tx.type as string] || String(tx.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {(assets?.ticker as string) || "--"}
                        <div className="text-xs text-muted-foreground">
                          {(assets?.name as string) || ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatQuantity(tx.quantity as number)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(tx.price_per_unit as number)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium">
                        {formatCurrency(tx.total_value as number)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground hidden sm:table-cell">
                        {formatCurrency((tx.fees as number) || 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(tx.id as string)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
            <ArrowLeftRight className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2 text-lg">
              Nenhuma transacao registrada
            </CardTitle>
            <CardDescription className="mb-4 text-center">
              Registre suas compras e vendas para comecar a acompanhar seu
              portfolio.
            </CardDescription>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Primeira Transacao
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
