"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { BrokerType, WalletAddress } from "@/types/database";
import { toast } from "sonner";

export interface Broker {
  id: string;
  name: string;
  broker_type: BrokerType;
  icon_url: string | null;
  notes: string | null;
  wallet_addresses: WalletAddress[] | null;
  last_synced_at: string | null;
  created_at: string;
}

export function useBrokers() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { data, error } = await supabase
        .from("invest_brokers")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Broker[];
    },
  });
}

export function useCreateBroker() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      broker_type: BrokerType;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { data, error } = await supabase
        .from("invest_brokers")
        .insert({
          user_id: user.id,
          name: input.name,
          broker_type: input.broker_type,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Corretora adicionada!");
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast.error("Voce ja tem uma corretora com esse nome.");
      } else {
        toast.error("Erro ao adicionar corretora", {
          description: error.message,
        });
      }
    },
  });
}

export function useUpdateBroker() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      broker_type: BrokerType;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("invest_brokers")
        .update({
          name: input.name,
          broker_type: input.broker_type,
          notes: input.notes || null,
        })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Corretora atualizada!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar corretora", {
        description: error.message,
      });
    },
  });
}

export function useDeleteBroker() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invest_brokers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brokers"] });
      toast.success("Corretora removida!");
    },
    onError: (error: Error) => {
      if (error.message.includes("violates foreign key")) {
        toast.error(
          "Nao e possivel remover: existem investimentos nesta corretora."
        );
      } else {
        toast.error("Erro ao remover corretora", {
          description: error.message,
        });
      }
    },
  });
}
