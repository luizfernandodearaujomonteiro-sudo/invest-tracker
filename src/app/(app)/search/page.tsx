"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSearch } from "@/hooks/useSearch";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/shared/FavoriteButton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { ASSET_TYPE_LABELS } from "@/lib/utils/constants";
import type { AssetType } from "@/types/database";

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);

  const { data: results, isLoading } = useSearch(query);
  const { data: favorites } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  const favoriteIds = new Set(
    (favorites || []).map(
      (f: { asset_id: string }) => f.asset_id
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Buscar Ativos</h1>
        <p className="text-muted-foreground">
          Pesquise acoes, criptomoedas, FIIs e muito mais
        </p>
      </div>

      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar... (ex: PETR4, Apple, Bitcoin)"
          className="pl-9 text-base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : results && results.length > 0 ? (
        <div className="space-y-2">
          {results.map(
            (asset: {
              id: string;
              ticker: string;
              name: string;
              asset_type: AssetType;
              currency: string;
            }) => (
              <Card key={asset.id} className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between p-4">
                  <Link
                    href={`/asset/${asset.ticker}`}
                    className="flex flex-1 items-center gap-4"
                  >
                    <div>
                      <div className="font-semibold">{asset.ticker}</div>
                      <div className="text-sm text-muted-foreground">
                        {asset.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {ASSET_TYPE_LABELS[asset.asset_type]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {asset.currency}
                      </Badge>
                    </div>
                  </Link>
                  <FavoriteButton
                    isFavorite={favoriteIds.has(asset.id)}
                    onToggle={() =>
                      toggleFavorite.mutate({
                        assetId: asset.id,
                        isFavorite: favoriteIds.has(asset.id),
                      })
                    }
                  />
                </CardContent>
              </Card>
            )
          )}
        </div>
      ) : query.length > 0 ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Nenhum ativo encontrado para &quot;{query}&quot;
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          Digite o nome ou ticker de um ativo para pesquisar
        </div>
      )}
    </div>
  );
}
