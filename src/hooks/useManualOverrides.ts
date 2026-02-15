"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { ManualOverrides } from "@/types/database";

export function useManualOverrides() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      holdingId: string;
      overrides: ManualOverrides;
    }) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nao autenticado");

      const res = await fetch("/api/holdings/manual-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdingId: input.holdingId,
          userId: user.id,
          overrides: input.overrides,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erro ao salvar valores");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Valores atualizados!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao salvar valores", {
        description: error.message,
      });
    },
  });
}
