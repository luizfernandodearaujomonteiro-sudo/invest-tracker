"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";

// Balance visibility context
interface BalanceVisibilityContextType {
  balanceVisible: boolean;
  toggleBalance: () => void;
}

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType>({
  balanceVisible: true,
  toggleBalance: () => {},
});

export function useBalanceVisibility() {
  return useContext(BalanceVisibilityContext);
}

function BalanceVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("balanceVisible");
    if (stored !== null) setBalanceVisible(stored === "true");
    setMounted(true);
  }, []);

  const toggleBalance = useCallback(() => {
    setBalanceVisible((prev) => {
      const next = !prev;
      localStorage.setItem("balanceVisible", String(next));
      return next;
    });
  }, []);

  // Avoid hydration mismatch
  if (!mounted) return <>{children}</>;

  return (
    <BalanceVisibilityContext.Provider value={{ balanceVisible, toggleBalance }}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BalanceVisibilityProvider>{children}</BalanceVisibilityProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
