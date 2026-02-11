export type AssetType =
  | "br_stock"
  | "br_fii"
  | "br_bdr"
  | "br_etf"
  | "us_stock"
  | "us_etf"
  | "crypto"
  | "fixed_income";

export type TransactionType =
  | "buy"
  | "sell"
  | "dividend"
  | "split"
  | "transfer_in"
  | "transfer_out";

export type BrokerType = "broker" | "exchange" | "wallet";

export type Currency = "BRL" | "USD";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          preferred_currency: Currency;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          preferred_currency?: Currency;
        };
        Update: {
          display_name?: string | null;
          preferred_currency?: Currency;
        };
      };
      brokers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          broker_type: BrokerType;
          icon_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          broker_type?: BrokerType;
          icon_url?: string | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          broker_type?: BrokerType;
          icon_url?: string | null;
          notes?: string | null;
        };
      };
      assets: {
        Row: {
          id: string;
          ticker: string;
          name: string;
          asset_type: AssetType;
          currency: Currency;
          exchange: string | null;
          coingecko_id: string | null;
          logo_url: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticker: string;
          name: string;
          asset_type: AssetType;
          currency?: Currency;
          exchange?: string | null;
          coingecko_id?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          ticker?: string;
          name?: string;
          asset_type?: AssetType;
          currency?: Currency;
          exchange?: string | null;
          coingecko_id?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
        };
      };
      holdings: {
        Row: {
          id: string;
          user_id: string;
          broker_id: string;
          asset_id: string;
          total_quantity: number;
          average_price: number;
          total_invested: number;
          fixed_income_rate: number | null;
          fixed_income_index: string | null;
          maturity_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          broker_id: string;
          asset_id: string;
          total_quantity?: number;
          average_price?: number;
          total_invested?: number;
          fixed_income_rate?: number | null;
          fixed_income_index?: string | null;
          maturity_date?: string | null;
          notes?: string | null;
        };
        Update: {
          total_quantity?: number;
          average_price?: number;
          total_invested?: number;
          fixed_income_rate?: number | null;
          fixed_income_index?: string | null;
          maturity_date?: string | null;
          notes?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          holding_id: string;
          type: TransactionType;
          quantity: number;
          price_per_unit: number;
          total_value: number;
          fees: number;
          currency: Currency;
          executed_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          holding_id: string;
          type: TransactionType;
          quantity: number;
          price_per_unit: number;
          total_value: number;
          fees?: number;
          currency?: Currency;
          executed_at: string;
          notes?: string | null;
        };
        Update: {
          type?: TransactionType;
          quantity?: number;
          price_per_unit?: number;
          total_value?: number;
          fees?: number;
          currency?: Currency;
          executed_at?: string;
          notes?: string | null;
        };
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          asset_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_id: string;
        };
        Update: Record<string, never>;
      };
      price_cache: {
        Row: {
          id: string;
          asset_id: string;
          current_price: number | null;
          open_price: number | null;
          high_price: number | null;
          low_price: number | null;
          previous_close: number | null;
          change_percent: number | null;
          volume: number | null;
          market_cap: number | null;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          asset_id: string;
          current_price?: number | null;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          previous_close?: number | null;
          change_percent?: number | null;
          volume?: number | null;
          market_cap?: number | null;
        };
        Update: {
          current_price?: number | null;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          previous_close?: number | null;
          change_percent?: number | null;
          volume?: number | null;
          market_cap?: number | null;
        };
      };
      price_history: {
        Row: {
          id: string;
          asset_id: string;
          date: string;
          open_price: number | null;
          high_price: number | null;
          low_price: number | null;
          close_price: number;
          volume: number | null;
        };
        Insert: {
          id?: string;
          asset_id: string;
          date: string;
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          close_price: number;
          volume?: number | null;
        };
        Update: {
          open_price?: number | null;
          high_price?: number | null;
          low_price?: number | null;
          close_price?: number;
          volume?: number | null;
        };
      };
    };
  };
}
