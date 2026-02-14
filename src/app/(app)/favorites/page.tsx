"use client";

import Link from "next/link";
import { useFavorites, useToggleFavorite } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/shared/FavoriteButton";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star } from "lucide-react";
import { ASSET_TYPE_LABELS } from "@/lib/utils/constants";
import type { AssetType } from "@/types/database";

export default function FavoritesPage() {
  const { data: favorites, isLoading } = useFavorites();
  const toggleFavorite = useToggleFavorite();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Favoritos</h1>
        <p className="text-muted-foreground">
          Ativos que voce marcou como favoritos
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : favorites && favorites.length > 0 ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {favorites.map((fav: any) => {
            const asset = Array.isArray(fav.invest_assets) ? fav.invest_assets[0] : fav.invest_assets;
            if (!asset) return null;
            return (
              <Card
                key={fav.id}
                className="transition-colors hover:bg-accent/50"
              >
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
                        {ASSET_TYPE_LABELS[asset.asset_type as AssetType]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {asset.currency}
                      </Badge>
                    </div>
                  </Link>
                  <FavoriteButton
                    isFavorite={true}
                    onToggle={() =>
                      toggleFavorite.mutate({
                        assetId: fav.asset_id,
                        isFavorite: true,
                      })
                    }
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Star className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2 text-lg">Nenhum favorito</CardTitle>
            <CardDescription className="text-center">
              Busque ativos e clique na estrela para adicionar aos favoritos.
            </CardDescription>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
