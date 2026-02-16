"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function useImportPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assetId: string;
      brokerId: string;
      quantity: number;
      averagePrice: number;
      dividendsAccumulated?: number;
      rentComProventos?: number;
      rentBruta?: number;
      fixedIncomeIndex?: string;
      fixedIncomeRate?: number;
      maturityDate?: string;
      snapshotValue?: number;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const res = await fetch("/api/holdings/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...input }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao importar posicao");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Posicao importada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao importar posicao", { description: error.message });
    },
  });
}
