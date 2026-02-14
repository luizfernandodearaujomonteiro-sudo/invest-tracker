"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { WalletAddress } from "@/types/database";
import { toast } from "sonner";

export function useUpdateWalletAddresses() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { brokerId: string; addresses: WalletAddress[] }) => {
      const { data, error } = await supabase
        .from("invest_brokers")
        .update({ wallet_addresses: input.addresses })
        .eq("id", input.brokerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Enderecos atualizados!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar enderecos", { description: error.message });
    },
  });
}

export function useWalletSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { brokerId: string; userId: string }) => {
      const res = await fetch("/api/wallet-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      const synced = data.synced?.length || 0;
      const errors = data.errors?.length || 0;
      if (errors > 0) {
        toast.warning(`Sincronizado ${synced} ativo(s), ${errors} erro(s)`);
      } else {
        toast.success(`${synced} ativo(s) sincronizado(s)!`);
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao sincronizar carteira", { description: error.message });
    },
  });
}
