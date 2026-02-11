import Link from "next/link";
import {
  TrendingUp,
  PieChart,
  Search,
  Star,
  BarChart3,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: PieChart,
    title: "Portfolio Unificado",
    description:
      "Veja todos os seus investimentos em um so lugar: acoes BR, US, cripto e renda fixa.",
  },
  {
    icon: TrendingUp,
    title: "Precos em Tempo Real",
    description:
      "Acompanhe precos atualizados via APIs publicas com cache inteligente.",
  },
  {
    icon: BarChart3,
    title: "Graficos Detalhados",
    description:
      "Visualize a performance dos seus ativos com graficos interativos por periodo.",
  },
  {
    icon: Search,
    title: "Busca de Ativos",
    description:
      "Pesquise qualquer ativo diretamente no sistema, sem precisar sair.",
  },
  {
    icon: Star,
    title: "Favoritos",
    description:
      "Marque os ativos que mais te interessam para acesso rapido.",
  },
  {
    icon: Shield,
    title: "Seguro e Privado",
    description:
      "Seus dados ficam protegidos com autenticacao e Row Level Security.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">InvestTracker</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Criar Conta</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Todos os seus investimentos em{" "}
            <span className="text-primary">um so lugar</span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Acompanhe acoes, criptomoedas, FIIs e renda fixa de todas as suas
            corretoras e carteiras. Precos em tempo real, graficos e controle
            total.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild>
              <Link href="/register">Comecar Gratis</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Ja tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/50 px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Tudo que voce precisa
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-lg border bg-card p-6 shadow-sm"
              >
                <feature.icon className="mb-3 h-8 w-8 text-primary" />
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          InvestTracker &copy; {new Date().getFullYear()} - Sistema de Gestao de
          Investimentos
        </div>
      </footer>
    </div>
  );
}
