"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TransactionType } from "@/types/database";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  holding_id: string;
  type: TransactionType;
  quantity: number;
  price_per_unit: number;
  total_value: number;
  fees: number;
  currency: string;
  executed_at: string;
  notes: string | null;
  created_at: string;
}

export function useTransactions(holdingId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["transactions", holdingId],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      let query = supabase
        .from("invest_transactions")
        .select(
          `
          *,
          invest_holdings (
            invest_assets ( ticker, name )
          )
        `
        )
        .order("executed_at", { ascending: false });

      if (holdingId) {
        query = query.eq("holding_id", holdingId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      assetId: string;
      brokerId: string;
      type: TransactionType;
      quantity: number;
      pricePerUnit: number;
      fees: number;
      executedAt: string;
      notes?: string;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      // Find or create holding
      let { data: holding } = await supabase
        .from("invest_holdings")
        .select("id")
        .eq("user_id", user.id)
        .eq("broker_id", input.brokerId)
        .eq("asset_id", input.assetId)
        .single();

      if (!holding) {
        const { data: newHolding, error: holdingError } = await supabase
          .from("invest_holdings")
          .insert({
            user_id: user.id,
            broker_id: input.brokerId,
            asset_id: input.assetId,
          })
          .select("id")
          .single();

        if (holdingError) throw holdingError;
        holding = newHolding;
      }

      const totalValue =
        input.quantity * input.pricePerUnit + (input.fees || 0);

      const { data, error } = await supabase
        .from("invest_transactions")
        .insert({
          user_id: user.id,
          holding_id: holding.id,
          type: input.type,
          quantity: input.quantity,
          price_per_unit: input.pricePerUnit,
          total_value: totalValue,
          fees: input.fees || 0,
          executed_at: input.executedAt,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Transacao registrada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao registrar transacao", {
        description: error.message,
      });
    },
  });
}

export function useDeleteTransaction() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invest_transactions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Transacao removida!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover transacao", {
        description: error.message,
      });
    },
  });
}
