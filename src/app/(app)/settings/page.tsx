"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Database } from "lucide-react";

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingBr, setSyncingBr] = useState(false);
  const [syncingUs, setSyncingUs] = useState(false);
  const [syncingFunds, setSyncingFunds] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("invest_profiles")
        .select("display_name, preferred_currency")
        .eq("id", user.id)
        .single();

      if (data) {
        setDisplayName((data as Record<string, string>).display_name || "");
        setCurrency((data as Record<string, string>).preferred_currency || "BRL");
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("invest_profiles")
      .update({
        display_name: displayName,
        preferred_currency: currency,
      })
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Configuracoes salvas!");
    }
    setSaving(false);
  };

  const handleSyncBr = async () => {
    setSyncingBr(true);
    try {
      const res = await fetch("/api/seed-assets", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Ativos BR sincronizados!", {
          description: `${data.totalInserted} novos, ${data.totalSkipped} ja existentes.`,
        });
      } else {
        toast.error("Erro ao sincronizar BR", { description: data.error });
      }
    } catch {
      toast.error("Erro ao sincronizar ativos BR");
    } finally {
      setSyncingBr(false);
    }
  };

  const handleSyncUs = async () => {
    setSyncingUs(true);
    try {
      const res = await fetch("/api/seed-us-assets", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Ativos US sincronizados!", {
          description: `${data.totalInserted} novos, ${data.totalSkipped} ja existentes.`,
        });
      } else {
        toast.error("Erro ao sincronizar US", { description: data.error });
      }
    } catch {
      toast.error("Erro ao sincronizar ativos US");
    } finally {
      setSyncingUs(false);
    }
  };

  const handleSyncFunds = async () => {
    setSyncingFunds(true);
    try {
      const res = await fetch("/api/funds/sync-registry", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Cadastro de fundos sincronizado!", {
          description: `${data.totalActive.toLocaleString("pt-BR")} fundos ativos importados.`,
        });
      } else {
        toast.error("Erro ao sincronizar fundos", { description: data.error });
      }
    } catch {
      toast.error("Erro ao sincronizar cadastro de fundos");
    } finally {
      setSyncingFunds(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-muted-foreground">
          Gerencie suas preferencias
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Base de Ativos</CardTitle>
          <CardDescription>
            Sincronize os ativos para que aparecam na busca ao importar posicoes. Ativos ja existentes nao serao duplicados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleSyncBr} disabled={syncingBr} variant="outline">
              {syncingBr ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {syncingBr ? "Sincronizando..." : "Sincronizar B3 (Brasil)"}
            </Button>
            <Button onClick={handleSyncUs} disabled={syncingUs} variant="outline">
              {syncingUs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              {syncingUs ? "Sincronizando..." : "Sincronizar US (EUA)"}
            </Button>
            <Button onClick={handleSyncFunds} disabled={syncingFunds} variant="outline">
              {syncingFunds ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {syncingFunds ? "Sincronizando..." : "Sincronizar Fundos CVM"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            B3: Puxa acoes, FIIs, ETFs e BDRs via Brapi. US: Adiciona ~350 acoes (S&P 500), ~130 ETFs e ~50 REITs americanos. Fundos CVM: Baixa o cadastro completo (~30 mil fundos ativos) para busca instantanea ao importar fundos de investimento.
          </p>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
          <CardDescription>Suas informacoes pessoais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Moeda Principal</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BRL">Real (BRL)</SelectItem>
                <SelectItem value="USD">Dolar (USD)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
