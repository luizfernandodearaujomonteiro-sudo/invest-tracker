"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function useFavorites() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["favorites"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const { data, error } = await supabase
        .from("invest_favorites")
        .select(
          `
          id,
          asset_id,
          invest_assets ( id, ticker, name, asset_type, currency, logo_url )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useToggleFavorite() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      assetId,
      isFavorite,
    }: {
      assetId: string;
      isFavorite: boolean;
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      if (isFavorite) {
        // Remove from favorites
        const { error } = await supabase
          .from("invest_favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("asset_id", assetId);
        if (error) throw error;
      } else {
        // Add to favorites
        const { error } = await supabase
          .from("invest_favorites")
          .insert({ user_id: user.id, asset_id: assetId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar favorito", {
        description: error.message,
      });
    },
  });
}
