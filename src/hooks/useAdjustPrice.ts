"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function useAdjustPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      holdingId: string;
      newPrice: number;
      note?: string;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const res = await fetch("/api/holdings/adjust-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: input.holdingId,
          userId: user.id,
          newPrice: input.newPrice,
          note: input.note,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao ajustar preco");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Preco medio atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao ajustar preco", {
        description: error.message,
      });
    },
  });
}
