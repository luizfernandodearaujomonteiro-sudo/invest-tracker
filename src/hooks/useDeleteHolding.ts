"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export function useDeleteHolding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (holdingId: string) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const res = await fetch(
        `/api/holdings/delete?holdingId=${holdingId}&userId=${user.id}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao deletar posicao");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Posicao deletada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao deletar posicao", { description: error.message });
    },
  });
}
