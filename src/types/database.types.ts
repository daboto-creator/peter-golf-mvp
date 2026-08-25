export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          archived_at: string | null;
          city: string;
          country_code: string;
          created_at: string;
          delivery_references: string | null;
          exterior_number: string | null;
          id: string;
          is_default: boolean;
          label: string;
          line_1: string;
          line_2: string | null;
          neighborhood: string | null;
          phone: string | null;
          postal_code: string;
          recipient_name: string;
          state: string;
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          archived_at?: string | null;
          city: string;
          country_code?: string;
          created_at?: string;
          delivery_references?: string | null;
          exterior_number?: string | null;
          id?: string;
          is_default?: boolean;
          label: string;
          line_1: string;
          line_2?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          postal_code: string;
          recipient_name: string;
          state: string;
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          archived_at?: string | null;
          city?: string;
          country_code?: string;
          created_at?: string;
          delivery_references?: string | null;
          exterior_number?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string;
          line_1?: string;
          line_2?: string | null;
          neighborhood?: string | null;
          phone?: string | null;
          postal_code?: string;
          recipient_name?: string;
          state?: string;
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      advisory_answers: {
        Row: {
          answer: Json;
          created_at: string;
          id: string;
          question_key: string;
          session_id: string;
          updated_at: string;
        };
        Insert: {
          answer: Json;
          created_at?: string;
          id?: string;
          question_key: string;
          session_id: string;
          updated_at?: string;
        };
        Update: {
          answer?: Json;
          created_at?: string;
          id?: string;
          question_key?: string;
          session_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advisory_answers_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "advisory_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      advisory_recommendations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          product_id: string;
          rank: number;
          rationale: string;
          session_id: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id: string;
          rank: number;
          rationale: string;
          session_id: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id?: string;
          rank?: number;
          rationale?: string;
          session_id?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "advisory_recommendations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_recommendations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_recommendations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "advisory_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_recommendations_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      advisory_requests: {
        Row: {
          assigned_to: string | null;
          consent_at: string;
          created_at: string;
          email: string | null;
          id: string;
          message: string | null;
          name: string;
          phone: string | null;
          preferred_channel: Database["public"]["Enums"]["contact_channel"];
          product_id: string | null;
          resolved_at: string | null;
          session_id: string | null;
          status: Database["public"]["Enums"]["advisory_request_status"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          consent_at: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          message?: string | null;
          name: string;
          phone?: string | null;
          preferred_channel: Database["public"]["Enums"]["contact_channel"];
          product_id?: string | null;
          resolved_at?: string | null;
          session_id?: string | null;
          status?: Database["public"]["Enums"]["advisory_request_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          consent_at?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          message?: string | null;
          name?: string;
          phone?: string | null;
          preferred_channel?: Database["public"]["Enums"]["contact_channel"];
          product_id?: string | null;
          resolved_at?: string | null;
          session_id?: string | null;
          status?: Database["public"]["Enums"]["advisory_request_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "advisory_requests_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_requests_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "advisory_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "advisory_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      advisory_sessions: {
        Row: {
          completed_at: string | null;
          context: Json;
          created_at: string;
          id: string;
          status: Database["public"]["Enums"]["advisory_session_status"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["advisory_session_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          context?: Json;
          created_at?: string;
          id?: string;
          status?: Database["public"]["Enums"]["advisory_session_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "advisory_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: Json;
          request_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: Json;
          request_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: Json;
          request_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["catalog_record_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      cart_idempotency_keys: {
        Row: {
          actor_id: string;
          cart_id: string | null;
          cart_item_id: string | null;
          created_at: string;
          idempotency_key: string;
          operation: string;
          payload_hash: string;
        };
        Insert: {
          actor_id: string;
          cart_id?: string | null;
          cart_item_id?: string | null;
          created_at?: string;
          idempotency_key: string;
          operation: string;
          payload_hash: string;
        };
        Update: {
          actor_id?: string;
          cart_id?: string | null;
          cart_item_id?: string | null;
          created_at?: string;
          idempotency_key?: string;
          operation?: string;
          payload_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_idempotency_keys_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_idempotency_keys_cart_item_id_fkey";
            columns: ["cart_item_id"];
            isOneToOne: false;
            referencedRelation: "cart_items";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          cart_id: string;
          created_at: string;
          currency_seen: string;
          id: string;
          price_seen: number;
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          currency_seen?: string;
          id?: string;
          price_seen?: number;
          quantity: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          currency_seen?: string;
          id?: string;
          price_seen?: number;
          quantity?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          currency: string;
          expires_at: string | null;
          id: string;
          status: Database["public"]["Enums"]["cart_status"];
          updated_at: string;
          user_id: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          updated_at?: string;
          user_id: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          updated_at?: string;
          user_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          parent_id: string | null;
          slug: string;
          sort_order: number;
          status: Database["public"]["Enums"]["catalog_record_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          parent_id?: string | null;
          slug: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_pricing_profiles: {
        Row: {
          category_id: string;
          created_at: string;
          new_rule_code: string | null;
          updated_at: string;
          used_rule_code: string | null;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          new_rule_code?: string | null;
          updated_at?: string;
          used_rule_code?: string | null;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          new_rule_code?: string | null;
          updated_at?: string;
          used_rule_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "category_pricing_profiles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: true;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "category_pricing_profiles_new_rule_code_fkey";
            columns: ["new_rule_code"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "category_pricing_profiles_used_rule_code_fkey";
            columns: ["used_rule_code"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["code"];
          },
        ];
      };
      category_spec_profiles: {
        Row: {
          bag_type: Database["public"]["Enums"]["golf_bag_type"] | null;
          category_id: string;
          club_type: Database["public"]["Enums"]["golf_club_type"] | null;
          created_at: string;
          family: Database["public"]["Enums"]["golf_product_family"];
          set_type: Database["public"]["Enums"]["golf_set_type"] | null;
          updated_at: string;
        };
        Insert: {
          bag_type?: Database["public"]["Enums"]["golf_bag_type"] | null;
          category_id: string;
          club_type?: Database["public"]["Enums"]["golf_club_type"] | null;
          created_at?: string;
          family: Database["public"]["Enums"]["golf_product_family"];
          set_type?: Database["public"]["Enums"]["golf_set_type"] | null;
          updated_at?: string;
        };
        Update: {
          bag_type?: Database["public"]["Enums"]["golf_bag_type"] | null;
          category_id?: string;
          club_type?: Database["public"]["Enums"]["golf_club_type"] | null;
          created_at?: string;
          family?: Database["public"]["Enums"]["golf_product_family"];
          set_type?: Database["public"]["Enums"]["golf_set_type"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_spec_profiles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: true;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: {
          created_at: string;
          id: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          reorder_point: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          reorder_point?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          reorder_point?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          idempotency_key: string | null;
          inventory_id: string;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity_delta: number;
          quantity_on_hand_after: number;
          quantity_reserved_after: number;
          reason: string;
          reference_id: string | null;
          reference_type: string | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          inventory_id: string;
          movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          quantity_delta: number;
          quantity_on_hand_after: number;
          quantity_reserved_after: number;
          reason: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string | null;
          inventory_id?: string;
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"];
          quantity_delta?: number;
          quantity_on_hand_after?: number;
          quantity_reserved_after?: number;
          reason?: string;
          reference_id?: string | null;
          reference_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "inventory";
            referencedColumns: ["id"];
          },
        ];
      };
      market_price_researches: {
        Row: {
          average_price: number | null;
          brand_id: string;
          category_id: string;
          checked_at: string;
          confidence: Database["public"]["Enums"]["market_price_confidence"];
          created_at: string;
          created_by: string;
          excluded_count: number;
          expires_at: string;
          high_price: number | null;
          id: string;
          input_fingerprint: string;
          input_snapshot: Json;
          low_price: number | null;
          median_price: number | null;
          product_condition: Database["public"]["Enums"]["product_condition"];
          product_id: string | null;
          provider: string;
          result_snapshot: Json;
          sample_size: number;
          search_query: string | null;
        };
        Insert: {
          average_price?: number | null;
          brand_id: string;
          category_id: string;
          checked_at: string;
          confidence?: Database["public"]["Enums"]["market_price_confidence"];
          created_at?: string;
          created_by: string;
          excluded_count?: number;
          expires_at: string;
          high_price?: number | null;
          id?: string;
          input_fingerprint: string;
          input_snapshot: Json;
          low_price?: number | null;
          median_price?: number | null;
          product_condition: Database["public"]["Enums"]["product_condition"];
          product_id?: string | null;
          provider: string;
          result_snapshot: Json;
          sample_size?: number;
          search_query?: string | null;
        };
        Update: {
          average_price?: number | null;
          brand_id?: string;
          category_id?: string;
          checked_at?: string;
          confidence?: Database["public"]["Enums"]["market_price_confidence"];
          created_at?: string;
          created_by?: string;
          excluded_count?: number;
          expires_at?: string;
          high_price?: number | null;
          id?: string;
          input_fingerprint?: string;
          input_snapshot?: Json;
          low_price?: number | null;
          median_price?: number | null;
          product_condition?: Database["public"]["Enums"]["product_condition"];
          product_id?: string | null;
          provider?: string;
          result_snapshot?: Json;
          sample_size?: number;
          search_query?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "market_price_researches_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_price_researches_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "market_price_researches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_config_versions: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_from: string | null;
          effective_to: string | null;
          id: string;
          publication_reason: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["marketplace_config_status"];
          updated_at: string;
          version_number: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          id?: string;
          publication_reason?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["marketplace_config_status"];
          updated_at?: string;
          version_number?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_from?: string | null;
          effective_to?: string | null;
          id?: string;
          publication_reason?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["marketplace_config_status"];
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_config_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_config_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_financial_rules: {
        Row: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          commission_tax_bps: number | null;
          config_version_id: string;
          currency: string;
          minimum_marketplace_revenue: number | null;
          partner_processing_share_bps: number;
        };
        Insert: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          commission_tax_bps?: number | null;
          config_version_id: string;
          currency?: string;
          minimum_marketplace_revenue?: number | null;
          partner_processing_share_bps: number;
        };
        Update: {
          admin_fee_bps?: number;
          admin_fixed_fee?: number;
          commission_tax_bps?: number | null;
          config_version_id?: string;
          currency?: string;
          minimum_marketplace_revenue?: number | null;
          partner_processing_share_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_financial_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_operational_rules: {
        Row: {
          acceptance_window_hours: number | null;
          config_version_id: string;
          listing_expiry_days: number | null;
          payout_interval_days: number | null;
          score_provisional_completed_orders: number | null;
          tier_averaging_window_days: number;
        };
        Insert: {
          acceptance_window_hours?: number | null;
          config_version_id: string;
          listing_expiry_days?: number | null;
          payout_interval_days?: number | null;
          score_provisional_completed_orders?: number | null;
          tier_averaging_window_days: number;
        };
        Update: {
          acceptance_window_hours?: number | null;
          config_version_id?: string;
          listing_expiry_days?: number | null;
          payout_interval_days?: number | null;
          score_provisional_completed_orders?: number | null;
          tier_averaging_window_days?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_operational_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_score_weight_rules: {
        Row: {
          config_version_id: string;
          metric_code: string;
          weight_bps: number;
        };
        Insert: {
          config_version_id: string;
          metric_code: string;
          weight_bps: number;
        };
        Update: {
          config_version_id?: string;
          metric_code?: string;
          weight_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_score_weight_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_tier_rules: {
        Row: {
          commission_rate_bps: number;
          config_version_id: string;
          maximum_average_active_listings: number | null;
          minimum_average_active_listings: number | null;
          minimum_score: number | null;
          tier: Database["public"]["Enums"]["marketplace_partner_tier"];
        };
        Insert: {
          commission_rate_bps: number;
          config_version_id: string;
          maximum_average_active_listings?: number | null;
          minimum_average_active_listings?: number | null;
          minimum_score?: number | null;
          tier: Database["public"]["Enums"]["marketplace_partner_tier"];
        };
        Update: {
          commission_rate_bps?: number;
          config_version_id?: string;
          maximum_average_active_listings?: number | null;
          minimum_average_active_listings?: number | null;
          minimum_score?: number | null;
          tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_tier_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempt_count: number;
          channel: Database["public"]["Enums"]["notification_channel"];
          created_at: string;
          id: string;
          last_error_at: string | null;
          last_error_code: string | null;
          lease_token: string | null;
          max_attempts: number;
          next_attempt_at: string | null;
          notification_event_id: string;
          processing_started_at: string | null;
          provider: string | null;
          provider_message_id: string | null;
          recipient_email: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["notification_delivery_status"];
          updated_at: string;
        };
        Insert: {
          attempt_count?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          last_error_at?: string | null;
          last_error_code?: string | null;
          lease_token?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          notification_event_id: string;
          processing_started_at?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient_email: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_delivery_status"];
          updated_at?: string;
        };
        Update: {
          attempt_count?: number;
          channel?: Database["public"]["Enums"]["notification_channel"];
          created_at?: string;
          id?: string;
          last_error_at?: string | null;
          last_error_code?: string | null;
          lease_token?: string | null;
          max_attempts?: number;
          next_attempt_at?: string | null;
          notification_event_id?: string;
          processing_started_at?: string | null;
          provider?: string | null;
          provider_message_id?: string | null;
          recipient_email?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["notification_delivery_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_event_id_fkey";
            columns: ["notification_event_id"];
            isOneToOne: false;
            referencedRelation: "notification_events";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_events: {
        Row: {
          created_at: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          id: string;
          occurred_at: string;
          order_id: string;
          order_status_history_id: string | null;
          payload_version: number;
          payment_id: string | null;
          payment_status_history_id: string | null;
          template_data: Json;
        };
        Insert: {
          created_at?: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          id?: string;
          occurred_at: string;
          order_id: string;
          order_status_history_id?: string | null;
          payload_version?: number;
          payment_id?: string | null;
          payment_status_history_id?: string | null;
          template_data: Json;
        };
        Update: {
          created_at?: string;
          event_type?: Database["public"]["Enums"]["notification_event_type"];
          id?: string;
          occurred_at?: string;
          order_id?: string;
          order_status_history_id?: string | null;
          payload_version?: number;
          payment_id?: string | null;
          payment_status_history_id?: string | null;
          template_data?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "notification_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_order_status_history_id_fkey";
            columns: ["order_status_history_id"];
            isOneToOne: false;
            referencedRelation: "order_status_history";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_events_payment_status_history_id_fkey";
            columns: ["payment_status_history_id"];
            isOneToOne: false;
            referencedRelation: "payment_status_history";
            referencedColumns: ["id"];
          },
        ];
      };
      order_idempotency_keys: {
        Row: {
          actor_id: string;
          created_at: string;
          idempotency_key: string;
          operation: string;
          order_id: string | null;
          payload_hash: string;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          idempotency_key: string;
          operation: string;
          order_id?: string | null;
          payload_hash: string;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          idempotency_key?: string;
          operation?: string;
          order_id?: string | null;
          payload_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_idempotency_keys_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          condition_grade_snapshot:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot: Database["public"]["Enums"]["product_condition"];
          created_at: string;
          currency: string;
          id: string;
          line_total: number;
          order_id: string;
          product_id: string;
          product_name_snapshot: string;
          quantity: number;
          sku_snapshot: string;
          unit_price_snapshot: number;
          variant_id: string | null;
          variant_name_snapshot: string | null;
        };
        Insert: {
          condition_grade_snapshot?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot: Database["public"]["Enums"]["product_condition"];
          created_at?: string;
          currency?: string;
          id?: string;
          line_total: number;
          order_id: string;
          product_id: string;
          product_name_snapshot: string;
          quantity: number;
          sku_snapshot: string;
          unit_price_snapshot: number;
          variant_id?: string | null;
          variant_name_snapshot?: string | null;
        };
        Update: {
          condition_grade_snapshot?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot?: Database["public"]["Enums"]["product_condition"];
          created_at?: string;
          currency?: string;
          id?: string;
          line_total?: number;
          order_id?: string;
          product_id?: string;
          product_name_snapshot?: string;
          quantity?: number;
          sku_snapshot?: string;
          unit_price_snapshot?: number;
          variant_id?: string | null;
          variant_name_snapshot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      order_payments: {
        Row: {
          created_at: string;
          currency: string;
          expected_amount: number;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          paid_at: string | null;
          provider: Database["public"]["Enums"]["payment_provider"];
          refunded_amount: number;
          refunded_at: string | null;
          rejected_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          submitted_at: string | null;
          under_review_at: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          currency: string;
          expected_amount: number;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          order_id: string;
          paid_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          refunded_amount?: number;
          refunded_at?: string | null;
          rejected_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          submitted_at?: string | null;
          under_review_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          expected_amount?: number;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          order_id?: string;
          paid_at?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"];
          refunded_amount?: number;
          refunded_at?: string | null;
          rejected_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          submitted_at?: string | null;
          under_review_at?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_payments_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: string;
          note: string | null;
          order_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          customer_email: string | null;
          customer_name: string | null;
          customer_note: string | null;
          customer_phone: string | null;
          delivery_type: string;
          discount_reason: string | null;
          discount_total: number;
          id: string;
          internal_note: string | null;
          order_number: string;
          origin: Database["public"]["Enums"]["order_origin"];
          origin_channel:
            Database["public"]["Enums"]["manual_order_channel"] | null;
          origin_channel_detail: string | null;
          payment_method: Database["public"]["Enums"]["manual_payment_method"];
          payment_status: Database["public"]["Enums"]["manual_payment_status"];
          shipping_address_id: string | null;
          shipping_address_snapshot: Json;
          shipping_method_id: string | null;
          shipping_total: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          version: number;
        };
        Insert: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_note?: string | null;
          customer_phone?: string | null;
          delivery_type?: string;
          discount_reason?: string | null;
          discount_total?: number;
          id?: string;
          internal_note?: string | null;
          order_number: string;
          origin?: Database["public"]["Enums"]["order_origin"];
          origin_channel?:
            Database["public"]["Enums"]["manual_order_channel"] | null;
          origin_channel_detail?: string | null;
          payment_method?: Database["public"]["Enums"]["manual_payment_method"];
          payment_status?: Database["public"]["Enums"]["manual_payment_status"];
          shipping_address_id?: string | null;
          shipping_address_snapshot: Json;
          shipping_method_id?: string | null;
          shipping_total?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total?: number;
          total: number;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          version?: number;
        };
        Update: {
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          customer_email?: string | null;
          customer_name?: string | null;
          customer_note?: string | null;
          customer_phone?: string | null;
          delivery_type?: string;
          discount_reason?: string | null;
          discount_total?: number;
          id?: string;
          internal_note?: string | null;
          order_number?: string;
          origin?: Database["public"]["Enums"]["order_origin"];
          origin_channel?:
            Database["public"]["Enums"]["manual_order_channel"] | null;
          origin_channel_detail?: string | null;
          payment_method?: Database["public"]["Enums"]["manual_payment_method"];
          payment_status?: Database["public"]["Enums"]["manual_payment_status"];
          shipping_address_id?: string | null;
          shipping_address_snapshot?: Json;
          shipping_method_id?: string | null;
          shipping_total?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_shipping_address_id_fkey";
            columns: ["shipping_address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_shipping_method_id_fkey";
            columns: ["shipping_method_id"];
            isOneToOne: false;
            referencedRelation: "shipping_methods";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          published_at: string | null;
          seo_description: string | null;
          seo_title: string | null;
          slug: string;
          status: Database["public"]["Enums"]["page_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["page_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          published_at?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["page_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      partner_documents: {
        Row: {
          created_at: string;
          document_kind: string;
          id: string;
          mime_type: string;
          partner_id: string;
          review_reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          sha256: string | null;
          size_bytes: number;
          status: Database["public"]["Enums"]["partner_document_status"];
          storage_path: string;
          updated_at: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          document_kind: string;
          id?: string;
          mime_type: string;
          partner_id: string;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sha256?: string | null;
          size_bytes: number;
          status?: Database["public"]["Enums"]["partner_document_status"];
          storage_path: string;
          updated_at?: string;
          uploaded_by: string;
        };
        Update: {
          created_at?: string;
          document_kind?: string;
          id?: string;
          mime_type?: string;
          partner_id?: string;
          review_reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          sha256?: string | null;
          size_bytes?: number;
          status?: Database["public"]["Enums"]["partner_document_status"];
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_documents_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_profiles: {
        Row: {
          created_at: string;
          id: string;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          rejected_at: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          suspended_at: string | null;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          rejected_at?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          suspended_at?: string | null;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
          version?: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          legal_type?: Database["public"]["Enums"]["partner_legal_type"];
          rejected_at?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          suspended_at?: string | null;
          updated_at?: string;
          user_id?: string;
          verified_at?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["partner_status"] | null;
          id: string;
          partner_id: string;
          reason: string | null;
          to_status: Database["public"]["Enums"]["partner_status"];
          version: number;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["partner_status"] | null;
          id?: string;
          partner_id: string;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["partner_status"];
          version: number;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["partner_status"] | null;
          id?: string;
          partner_id?: string;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["partner_status"];
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_status_history_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_fee_configs: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          display_name: string;
          fixed_fee: number;
          percentage_bps: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          display_name: string;
          fixed_fee: number;
          percentage_bps: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          display_name?: string;
          fixed_fee?: number;
          percentage_bps?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_idempotency_keys: {
        Row: {
          actor_id: string;
          created_at: string;
          idempotency_key: string;
          operation: string;
          payload_hash: string;
          payment_id: string;
          submission_id: string | null;
        };
        Insert: {
          actor_id: string;
          created_at?: string;
          idempotency_key: string;
          operation: string;
          payload_hash: string;
          payment_id: string;
          submission_id?: string | null;
        };
        Update: {
          actor_id?: string;
          created_at?: string;
          idempotency_key?: string;
          operation?: string;
          payload_hash?: string;
          payment_id?: string;
          submission_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_idempotency_keys_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_idempotency_keys_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "payment_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["payment_status"] | null;
          id: string;
          note: string | null;
          payment_id: string;
          submission_id: string | null;
          to_status: Database["public"]["Enums"]["payment_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["payment_status"] | null;
          id?: string;
          note?: string | null;
          payment_id: string;
          submission_id?: string | null;
          to_status: Database["public"]["Enums"]["payment_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["payment_status"] | null;
          id?: string;
          note?: string | null;
          payment_id?: string;
          submission_id?: string | null;
          to_status?: Database["public"]["Enums"]["payment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "payment_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_status_history_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_status_history_submission_id_fkey";
            columns: ["submission_id"];
            isOneToOne: false;
            referencedRelation: "payment_submissions";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_submissions: {
        Row: {
          attempt_number: number;
          created_at: string;
          id: string;
          payment_id: string;
          sender_bank: string | null;
          sender_name: string | null;
          submitted_by: string;
          transfer_reference: string;
          transferred_at: string;
        };
        Insert: {
          attempt_number: number;
          created_at?: string;
          id?: string;
          payment_id: string;
          sender_bank?: string | null;
          sender_name?: string | null;
          submitted_by: string;
          transfer_reference: string;
          transferred_at: string;
        };
        Update: {
          attempt_number?: number;
          created_at?: string;
          id?: string;
          payment_id?: string;
          sender_bank?: string | null;
          sender_name?: string | null;
          submitted_by?: string;
          transfer_reference?: string;
          transferred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_submissions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_submissions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_calculations: {
        Row: {
          actor_id: string | null;
          calculated_at: string;
          final_price: number;
          id: string;
          manual_override: boolean;
          pricing_rule_code: string;
          product_id: string;
          snapshot: Json;
          status: Database["public"]["Enums"]["pricing_status"];
          variant_id: string;
        };
        Insert: {
          actor_id?: string | null;
          calculated_at?: string;
          final_price: number;
          id?: string;
          manual_override: boolean;
          pricing_rule_code: string;
          product_id: string;
          snapshot: Json;
          status: Database["public"]["Enums"]["pricing_status"];
          variant_id: string;
        };
        Update: {
          actor_id?: string | null;
          calculated_at?: string;
          final_price?: number;
          id?: string;
          manual_override?: boolean;
          pricing_rule_code?: string;
          product_id?: string;
          snapshot?: Json;
          status?: Database["public"]["Enums"]["pricing_status"];
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_calculations_pricing_rule_code_fkey";
            columns: ["pricing_rule_code"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "pricing_calculations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_calculations_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      pricing_rules: {
        Row: {
          active: boolean;
          code: string;
          created_at: string;
          display_name: string;
          target_return_bps: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          display_name: string;
          target_return_bps: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          code?: string;
          created_at?: string;
          display_name?: string;
          target_return_bps?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_bag_specs: {
        Row: {
          bag_type: Database["public"]["Enums"]["golf_bag_type"];
          cart_compatible: boolean | null;
          color: string | null;
          created_at: string;
          divider_count: number | null;
          model: string | null;
          model_year: number | null;
          notes: string | null;
          pocket_count: number | null;
          product_id: string;
          rain_hood_included: boolean | null;
          strap_included: boolean | null;
          updated_at: string;
          waterproof: boolean | null;
          weight_kg: number | null;
        };
        Insert: {
          bag_type: Database["public"]["Enums"]["golf_bag_type"];
          cart_compatible?: boolean | null;
          color?: string | null;
          created_at?: string;
          divider_count?: number | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          pocket_count?: number | null;
          product_id: string;
          rain_hood_included?: boolean | null;
          strap_included?: boolean | null;
          updated_at?: string;
          waterproof?: boolean | null;
          weight_kg?: number | null;
        };
        Update: {
          bag_type?: Database["public"]["Enums"]["golf_bag_type"];
          cart_compatible?: boolean | null;
          color?: string | null;
          created_at?: string;
          divider_count?: number | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          pocket_count?: number | null;
          product_id?: string;
          rain_hood_included?: boolean | null;
          strap_included?: boolean | null;
          updated_at?: string;
          waterproof?: boolean | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_bag_specs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_club_specs: {
        Row: {
          adjustable_hosel: boolean | null;
          adjustable_loft: boolean | null;
          adjustment_tool_included: boolean | null;
          bounce_degrees: number | null;
          club_length_inches: number | null;
          club_number: string | null;
          club_type: Database["public"]["Enums"]["golf_club_type"];
          created_at: string;
          grind: string | null;
          grip_brand: string | null;
          grip_condition: string | null;
          grip_model: string | null;
          handedness: Database["public"]["Enums"]["golfer_handedness"] | null;
          headcover_included: boolean | null;
          iron_number: string | null;
          length_inches: number | null;
          lie_degrees: number | null;
          loft_degrees: number | null;
          model: string | null;
          model_year: number | null;
          neck_type: string | null;
          notes: string | null;
          product_id: string;
          putter_head_type:
            Database["public"]["Enums"]["golf_putter_head_type"] | null;
          shaft_brand: string | null;
          shaft_flex: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          shaft_model: string | null;
          shaft_weight_grams: number | null;
          updated_at: string;
        };
        Insert: {
          adjustable_hosel?: boolean | null;
          adjustable_loft?: boolean | null;
          adjustment_tool_included?: boolean | null;
          bounce_degrees?: number | null;
          club_length_inches?: number | null;
          club_number?: string | null;
          club_type: Database["public"]["Enums"]["golf_club_type"];
          created_at?: string;
          grind?: string | null;
          grip_brand?: string | null;
          grip_condition?: string | null;
          grip_model?: string | null;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          headcover_included?: boolean | null;
          iron_number?: string | null;
          length_inches?: number | null;
          lie_degrees?: number | null;
          loft_degrees?: number | null;
          model?: string | null;
          model_year?: number | null;
          neck_type?: string | null;
          notes?: string | null;
          product_id: string;
          putter_head_type?:
            Database["public"]["Enums"]["golf_putter_head_type"] | null;
          shaft_brand?: string | null;
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          shaft_model?: string | null;
          shaft_weight_grams?: number | null;
          updated_at?: string;
        };
        Update: {
          adjustable_hosel?: boolean | null;
          adjustable_loft?: boolean | null;
          adjustment_tool_included?: boolean | null;
          bounce_degrees?: number | null;
          club_length_inches?: number | null;
          club_number?: string | null;
          club_type?: Database["public"]["Enums"]["golf_club_type"];
          created_at?: string;
          grind?: string | null;
          grip_brand?: string | null;
          grip_condition?: string | null;
          grip_model?: string | null;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          headcover_included?: boolean | null;
          iron_number?: string | null;
          length_inches?: number | null;
          lie_degrees?: number | null;
          loft_degrees?: number | null;
          model?: string | null;
          model_year?: number | null;
          neck_type?: string | null;
          notes?: string | null;
          product_id?: string;
          putter_head_type?:
            Database["public"]["Enums"]["golf_putter_head_type"] | null;
          shaft_brand?: string | null;
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          shaft_model?: string | null;
          shaft_weight_grams?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_club_specs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_components: {
        Row: {
          bag_type: Database["public"]["Enums"]["golf_bag_type"] | null;
          brand: string | null;
          club_type: Database["public"]["Enums"]["golf_club_type"] | null;
          component_kind: Database["public"]["Enums"]["product_component_kind"];
          component_number: string | null;
          condition: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          created_at: string;
          handedness: Database["public"]["Enums"]["golfer_handedness"] | null;
          id: string;
          loft_degrees: number | null;
          model: string | null;
          quantity: number;
          set_product_id: string;
          shaft_flex: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          bag_type?: Database["public"]["Enums"]["golf_bag_type"] | null;
          brand?: string | null;
          club_type?: Database["public"]["Enums"]["golf_club_type"] | null;
          component_kind: Database["public"]["Enums"]["product_component_kind"];
          component_number?: string | null;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          created_at?: string;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          id?: string;
          loft_degrees?: number | null;
          model?: string | null;
          quantity?: number;
          set_product_id: string;
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          bag_type?: Database["public"]["Enums"]["golf_bag_type"] | null;
          brand?: string | null;
          club_type?: Database["public"]["Enums"]["golf_club_type"] | null;
          component_kind?: Database["public"]["Enums"]["product_component_kind"];
          component_number?: string | null;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          created_at?: string;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          id?: string;
          loft_degrees?: number | null;
          model?: string | null;
          quantity?: number;
          set_product_id?: string;
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_components_set_product_id_fkey";
            columns: ["set_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string;
          created_at: string;
          id: string;
          is_condition_evidence: boolean;
          is_primary: boolean;
          product_id: string;
          sort_order: number;
          storage_path: string;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          alt_text: string;
          created_at?: string;
          id?: string;
          is_condition_evidence?: boolean;
          is_primary?: boolean;
          product_id: string;
          sort_order?: number;
          storage_path: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          alt_text?: string;
          created_at?: string;
          id?: string;
          is_condition_evidence?: boolean;
          is_primary?: boolean;
          product_id?: string;
          sort_order?: number;
          storage_path?: string;
          updated_at?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_pricing: {
        Row: {
          acquisition_channel: Database["public"]["Enums"]["acquisition_channel"];
          conditioning_cost: number;
          created_at: string;
          estimated_payment_fee: number;
          expected_contribution: number;
          final_price: number;
          financial_price: number;
          health: Database["public"]["Enums"]["pricing_health"];
          manual_override: boolean;
          manual_price_reason: string | null;
          margin_on_sale_bps: number;
          market_average: number | null;
          market_checked_at: string | null;
          market_confidence: Database["public"]["Enums"]["market_price_confidence"];
          market_delta_bps: number | null;
          market_high: number | null;
          market_low: number | null;
          market_provider: string | null;
          market_reference: number | null;
          market_research_id: string | null;
          market_sample_size: number;
          market_source: string | null;
          market_source_url: string | null;
          overridden_at: string | null;
          overridden_by: string | null;
          packaging_cost: number;
          payment_fee_config_code: string;
          pricing_rule_code: string;
          product_id: string;
          return_on_cost_bps: number;
          shipping_subsidy: number;
          status: Database["public"]["Enums"]["pricing_status"];
          suggested_price: number;
          updated_at: string;
          variant_id: string;
          version: number;
        };
        Insert: {
          acquisition_channel?: Database["public"]["Enums"]["acquisition_channel"];
          conditioning_cost?: number;
          created_at?: string;
          estimated_payment_fee: number;
          expected_contribution: number;
          final_price: number;
          financial_price: number;
          health: Database["public"]["Enums"]["pricing_health"];
          manual_override?: boolean;
          manual_price_reason?: string | null;
          margin_on_sale_bps: number;
          market_average?: number | null;
          market_checked_at?: string | null;
          market_confidence?: Database["public"]["Enums"]["market_price_confidence"];
          market_delta_bps?: number | null;
          market_high?: number | null;
          market_low?: number | null;
          market_provider?: string | null;
          market_reference?: number | null;
          market_research_id?: string | null;
          market_sample_size?: number;
          market_source?: string | null;
          market_source_url?: string | null;
          overridden_at?: string | null;
          overridden_by?: string | null;
          packaging_cost?: number;
          payment_fee_config_code: string;
          pricing_rule_code: string;
          product_id: string;
          return_on_cost_bps: number;
          shipping_subsidy?: number;
          status: Database["public"]["Enums"]["pricing_status"];
          suggested_price: number;
          updated_at?: string;
          variant_id: string;
          version?: number;
        };
        Update: {
          acquisition_channel?: Database["public"]["Enums"]["acquisition_channel"];
          conditioning_cost?: number;
          created_at?: string;
          estimated_payment_fee?: number;
          expected_contribution?: number;
          final_price?: number;
          financial_price?: number;
          health?: Database["public"]["Enums"]["pricing_health"];
          manual_override?: boolean;
          manual_price_reason?: string | null;
          margin_on_sale_bps?: number;
          market_average?: number | null;
          market_checked_at?: string | null;
          market_confidence?: Database["public"]["Enums"]["market_price_confidence"];
          market_delta_bps?: number | null;
          market_high?: number | null;
          market_low?: number | null;
          market_provider?: string | null;
          market_reference?: number | null;
          market_research_id?: string | null;
          market_sample_size?: number;
          market_source?: string | null;
          market_source_url?: string | null;
          overridden_at?: string | null;
          overridden_by?: string | null;
          packaging_cost?: number;
          payment_fee_config_code?: string;
          pricing_rule_code?: string;
          product_id?: string;
          return_on_cost_bps?: number;
          shipping_subsidy?: number;
          status?: Database["public"]["Enums"]["pricing_status"];
          suggested_price?: number;
          updated_at?: string;
          variant_id?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_pricing_market_research_id_fkey";
            columns: ["market_research_id"];
            isOneToOne: false;
            referencedRelation: "market_price_researches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_pricing_payment_fee_config_code_fkey";
            columns: ["payment_fee_config_code"];
            isOneToOne: false;
            referencedRelation: "payment_fee_configs";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "product_pricing_pricing_rule_code_fkey";
            columns: ["pricing_rule_code"];
            isOneToOne: false;
            referencedRelation: "pricing_rules";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "product_pricing_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_pricing_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: true;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_set_specs: {
        Row: {
          created_at: string;
          handedness: Database["public"]["Enums"]["golfer_handedness"] | null;
          model: string | null;
          model_year: number | null;
          notes: string | null;
          product_id: string;
          set_type: Database["public"]["Enums"]["golf_set_type"];
          shaft_flex: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          product_id: string;
          set_type: Database["public"]["Enums"]["golf_set_type"];
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          handedness?: Database["public"]["Enums"]["golfer_handedness"] | null;
          model?: string | null;
          model_year?: number | null;
          notes?: string | null;
          product_id?: string;
          set_type?: Database["public"]["Enums"]["golf_set_type"];
          shaft_flex?: Database["public"]["Enums"]["golf_shaft_flex"] | null;
          shaft_material?:
            Database["public"]["Enums"]["golf_shaft_material"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_set_specs_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: true;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          active: boolean;
          archived_at: string | null;
          attributes: Json;
          compare_at_price: number | null;
          cost: number | null;
          created_at: string;
          id: string;
          name: string;
          price: number | null;
          product_id: string;
          sku: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          archived_at?: string | null;
          attributes?: Json;
          compare_at_price?: number | null;
          cost?: number | null;
          created_at?: string;
          id?: string;
          name: string;
          price?: number | null;
          product_id: string;
          sku: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          archived_at?: string | null;
          attributes?: Json;
          compare_at_price?: number | null;
          cost?: number | null;
          created_at?: string;
          id?: string;
          name?: string;
          price?: number | null;
          product_id?: string;
          sku?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          brand_id: string;
          category_id: string;
          compare_at_price: number | null;
          condition: Database["public"]["Enums"]["product_condition"];
          condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes: string | null;
          condition_score: number | null;
          cost: number | null;
          created_at: string;
          currency: string;
          description: string | null;
          featured: boolean;
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          id: string;
          lead_time_max_days: number | null;
          lead_time_min_days: number | null;
          name: string;
          price: number;
          price_is_estimate: boolean;
          published: boolean;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          sku: string;
          slug: string;
          status: Database["public"]["Enums"]["product_status"];
          target_player:
            Database["public"]["Enums"]["product_target_player"] | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          brand_id: string;
          category_id: string;
          compare_at_price?: number | null;
          condition: Database["public"]["Enums"]["product_condition"];
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes?: string | null;
          condition_score?: number | null;
          cost?: number | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          featured?: boolean;
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          id?: string;
          lead_time_max_days?: number | null;
          lead_time_min_days?: number | null;
          name: string;
          price: number;
          price_is_estimate?: boolean;
          published?: boolean;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          sku: string;
          slug: string;
          status?: Database["public"]["Enums"]["product_status"];
          target_player?:
            Database["public"]["Enums"]["product_target_player"] | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          brand_id?: string;
          category_id?: string;
          compare_at_price?: number | null;
          condition?: Database["public"]["Enums"]["product_condition"];
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes?: string | null;
          condition_score?: number | null;
          cost?: number | null;
          created_at?: string;
          currency?: string;
          description?: string | null;
          featured?: boolean;
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"];
          id?: string;
          lead_time_max_days?: number | null;
          lead_time_min_days?: number | null;
          name?: string;
          price?: number;
          price_is_estimate?: boolean;
          published?: boolean;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          sku?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["product_status"];
          target_player?:
            Database["public"]["Enums"]["product_target_player"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          archived_at: string | null;
          created_at: string;
          display_name: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          locale: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          display_name?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          locale?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shipping_methods: {
        Row: {
          active: boolean;
          base_price: number;
          code: string;
          created_at: string;
          currency: string;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          base_price?: number;
          code: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          base_price?: number;
          code?: string;
          created_at?: string;
          currency?: string;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      stripe_checkout_sessions: {
        Row: {
          abandoned_at: string | null;
          amount_total: number;
          attempt_number: number;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          currency: string;
          expired_at: string | null;
          expires_at: string;
          failed_at: string | null;
          id: string;
          idempotency_key: string;
          payload_hash: string;
          payment_id: string;
          status: Database["public"]["Enums"]["stripe_checkout_status"];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
        };
        Insert: {
          abandoned_at?: string | null;
          amount_total: number;
          attempt_number: number;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          currency: string;
          expired_at?: string | null;
          expires_at: string;
          failed_at?: string | null;
          id?: string;
          idempotency_key: string;
          payload_hash: string;
          payment_id: string;
          status?: Database["public"]["Enums"]["stripe_checkout_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          abandoned_at?: string | null;
          amount_total?: number;
          attempt_number?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          currency?: string;
          expired_at?: string | null;
          expires_at?: string;
          failed_at?: string | null;
          id?: string;
          idempotency_key?: string;
          payload_hash?: string;
          payment_id?: string;
          status?: Database["public"]["Enums"]["stripe_checkout_status"];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stripe_checkout_sessions_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_refunds: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          failure_reason: string | null;
          id: string;
          last_event_created_at: string;
          payment_id: string;
          status: Database["public"]["Enums"]["stripe_refund_status"];
          stripe_created_at: string;
          stripe_payment_intent_id: string;
          stripe_refund_id: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          failure_reason?: string | null;
          id?: string;
          last_event_created_at: string;
          payment_id: string;
          status: Database["public"]["Enums"]["stripe_refund_status"];
          stripe_created_at: string;
          stripe_payment_intent_id: string;
          stripe_refund_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          failure_reason?: string | null;
          id?: string;
          last_event_created_at?: string;
          payment_id?: string;
          status?: Database["public"]["Enums"]["stripe_refund_status"];
          stripe_created_at?: string;
          stripe_payment_intent_id?: string;
          stripe_refund_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_refunds_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          api_version: string | null;
          created_at: string;
          error_code: string | null;
          event_type: string;
          id: string;
          livemode: boolean;
          payload_hash: string;
          processed_at: string | null;
          processing_status: Database["public"]["Enums"]["stripe_event_processing_status"];
          stripe_created_at: string;
          stripe_event_id: string;
        };
        Insert: {
          api_version?: string | null;
          created_at?: string;
          error_code?: string | null;
          event_type: string;
          id?: string;
          livemode: boolean;
          payload_hash: string;
          processed_at?: string | null;
          processing_status?: Database["public"]["Enums"]["stripe_event_processing_status"];
          stripe_created_at: string;
          stripe_event_id: string;
        };
        Update: {
          api_version?: string | null;
          created_at?: string;
          error_code?: string | null;
          event_type?: string;
          id?: string;
          livemode?: boolean;
          payload_hash?: string;
          processed_at?: string | null;
          processing_status?: Database["public"]["Enums"]["stripe_event_processing_status"];
          stripe_created_at?: string;
          stripe_event_id?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          assigned_by: string | null;
          created_at: string;
          id: string;
          role_id: string;
          user_id: string;
        };
        Insert: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          role_id: string;
          user_id: string;
        };
        Update: {
          assigned_by?: string | null;
          created_at?: string;
          id?: string;
          role_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_customer_cart_item: {
        Args: {
          requested_idempotency_key: string;
          requested_product_id: string;
          requested_quantity: number;
          requested_variant_id: string;
        };
        Returns: {
          cart_id: string;
          cart_item_id: string;
          quantity: number;
          replayed: boolean;
          version: number;
        }[];
      };
      adjust_inventory: {
        Args: {
          requested_idempotency_key: string;
          requested_movement_type: Database["public"]["Enums"]["inventory_movement_type"];
          requested_quantity_delta: number;
          requested_reason: string;
          requested_reference_id?: string;
          requested_reference_type?: string;
          requested_variant_id: string;
        };
        Returns: {
          available_after: number;
          inventory_id: string;
          movement_id: string;
          quantity_on_hand_after: number;
          quantity_on_hand_before: number;
          quantity_reserved_after: number;
          replayed: boolean;
        }[];
      };
      apply_product_pricing: {
        Args: {
          requested_category_id: string;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_final_price: unknown;
          requested_pricing: Json;
          requested_product_id: string;
          requested_variant_id: string;
        };
        Returns: Json;
      };
      backfill_legacy_order_payments: { Args: never; Returns: undefined };
      calculate_product_pricing: {
        Args: {
          requested_acquisition_cost: unknown;
          requested_conditioning_cost: unknown;
          requested_final_price: unknown;
          requested_manual_reason: string;
          requested_market_confidence: Database["public"]["Enums"]["market_price_confidence"];
          requested_market_high: unknown;
          requested_market_low: unknown;
          requested_market_reference: unknown;
          requested_market_sample_size: number;
          requested_packaging_cost: unknown;
          requested_rule_code: string;
          requested_shipping_subsidy: unknown;
        };
        Returns: Json;
      };
      can_create_catalog_base_variant: {
        Args: {
          requested_name: string;
          requested_product_id: string;
          requested_sku: string;
        };
        Returns: boolean;
      };
      can_manage_catalog: { Args: never; Returns: boolean };
      can_manage_catalog_references: {
        Args: { requested_brand_id: string; requested_category_id: string };
        Returns: boolean;
      };
      can_manage_marketplace_configuration: { Args: never; Returns: boolean };
      can_manage_marketplace_partners: { Args: never; Returns: boolean };
      can_manage_orders: { Args: never; Returns: boolean };
      can_override_pricing_floor: { Args: never; Returns: boolean };
      can_review_partner_documents: { Args: never; Returns: boolean };
      cancel_manual_order: {
        Args: {
          expected_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
          requested_reason: string;
        };
        Returns: {
          order_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["order_status"];
        }[];
      };
      cancel_operational_order: {
        Args: {
          expected_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
          requested_reason: string;
        };
        Returns: {
          order_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["order_status"];
        }[];
      };
      cart_payload_hash: { Args: { payload: Json }; Returns: string };
      change_customer_cart: {
        Args: {
          expected_version: number;
          requested_cart_item_id: string;
          requested_idempotency_key: string;
          requested_operation: string;
          requested_quantity: number;
        };
        Returns: {
          cart_id: string;
          replayed: boolean;
          version: number;
        }[];
      };
      claim_notification_deliveries: {
        Args: { requested_limit?: number };
        Returns: {
          attempt_count: number;
          customer_name: string;
          delivery_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          lease_token: string;
          occurred_at: string;
          order_id: string;
          order_origin: Database["public"]["Enums"]["order_origin"];
          recipient_email: string;
          template_data: Json;
        }[];
      };
      clear_customer_cart: {
        Args: { expected_version: number; requested_idempotency_key: string };
        Returns: {
          cart_id: string;
          replayed: boolean;
          version: number;
        }[];
      };
      complete_notification_delivery: {
        Args: {
          requested_lease_token: string;
          requested_provider_message_id: string;
        };
        Returns: string;
      };
      confirm_manual_order: {
        Args: {
          expected_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
        };
        Returns: {
          order_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["order_status"];
        }[];
      };
      confirm_operational_order: {
        Args: {
          expected_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
        };
        Returns: {
          order_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["order_status"];
        }[];
      };
      create_customer_checkout_order:
        | {
            Args: {
              expected_version: number;
              requested_address: Json;
              requested_cart_id: string;
              requested_idempotency_key: string;
              requested_save_address: boolean;
              requested_shipping_method_id: string;
            };
            Returns: {
              order_id: string;
              order_number: string;
              replayed: boolean;
            }[];
          }
        | {
            Args: {
              expected_version: number;
              requested_address: Json;
              requested_cart_id: string;
              requested_idempotency_key: string;
              requested_save_address: boolean;
              requested_saved_address_id: string;
              requested_shipping_method_id: string;
            };
            Returns: {
              order_id: string;
              order_number: string;
              replayed: boolean;
            }[];
          }
        | {
            Args: {
              expected_version: number;
              requested_address: Json;
              requested_cart_id: string;
              requested_idempotency_key: string;
              requested_payment_method: Database["public"]["Enums"]["payment_method"];
              requested_save_address: boolean;
              requested_saved_address_id: string;
              requested_shipping_method_id: string;
            };
            Returns: {
              order_id: string;
              order_number: string;
              replayed: boolean;
            }[];
          };
      create_golf_product_with_base_variant: {
        Args: {
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_components?: Json;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_condition_score: number | null;
          requested_currency: unknown;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
          requested_specifications: Json;
          requested_target_player:
            Database["public"]["Enums"]["product_target_player"] | null;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      create_manual_order: {
        Args: { requested_idempotency_key: string; requested_payload: Json };
        Returns: {
          order_id: string;
          order_number: string;
          replayed: boolean;
        }[];
      };
      create_marketplace_config_draft: {
        Args: { requested_reason: string };
        Returns: string;
      };
      create_priced_golf_product_with_base_variant: {
        Args: {
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_components: Json;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_condition_score: number | null;
          requested_currency: unknown;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_pricing: Json;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
          requested_specifications: Json;
          requested_target_player:
            Database["public"]["Enums"]["product_target_player"] | null;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      create_product_with_base_variant: {
        Args: {
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade: Database["public"]["Enums"]["product_condition_grade"];
          requested_condition_notes: string;
          requested_currency: unknown;
          requested_description: string;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number;
          requested_lead_time_min_days: number;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_published: boolean;
          requested_short_description: string;
          requested_sku: string;
          requested_slug: string;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      fail_notification_delivery: {
        Args: { requested_error_code: string; requested_lease_token: string };
        Returns: {
          delivery_id: string;
          next_attempt_at: string;
          status: Database["public"]["Enums"]["notification_delivery_status"];
        }[];
      };
      get_customer_cart: { Args: never; Returns: Json };
      get_customer_order: {
        Args: { requested_order_id: string };
        Returns: Json;
      };
      get_customer_shipping_method: {
        Args: never;
        Returns: {
          base_price: number;
          currency: string;
          description: string;
          name: string;
          shipping_method_id: string;
        }[];
      };
      get_or_create_active_cart: {
        Args: never;
        Returns: {
          created_at: string;
          currency: string;
          expires_at: string | null;
          id: string;
          status: Database["public"]["Enums"]["cart_status"];
          updated_at: string;
          user_id: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "carts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_product_pricing_private: {
        Args: { requested_product_id: string };
        Returns: Json;
      };
      initialize_inventory: {
        Args: { requested_variant_id: string };
        Returns: {
          available: number;
          initialized: boolean;
          inventory_id: string;
          quantity_on_hand: number;
          quantity_reserved: number;
          reorder_point: number;
        }[];
      };
      is_marketplace_enabled: { Args: never; Returns: boolean };
      link_stripe_checkout_session: {
        Args: {
          requested_checkout_attempt_id: string;
          requested_expires_at: string;
          requested_idempotency_key: string;
          requested_stripe_checkout_session_id: string;
        };
        Returns: {
          checkout_attempt_id: string;
          linked: boolean;
        }[];
      };
      list_customer_orders: {
        Args: never;
        Returns: {
          created_at: string;
          currency: string;
          discount_total: number;
          id: string;
          order_number: string;
          payment_method: Database["public"]["Enums"]["payment_method"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          shipping_address_snapshot: Json;
          shipping_total: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
        }[];
      };
      list_operational_notification_deliveries: {
        Args: { requested_limit?: number };
        Returns: {
          attempt_count: number;
          created_at: string;
          delivery_id: string;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          last_error_code: string;
          max_attempts: number;
          next_attempt_at: string;
          occurred_at: string;
          order_number: string;
          processing_started_at: string;
          recipient_email_masked: string;
          sent_at: string;
          status: Database["public"]["Enums"]["notification_delivery_status"];
          updated_at: string;
        }[];
      };
      lock_customer_order_for_payment: {
        Args: { requested_order_id: string };
        Returns: undefined;
      };
      manage_customer_address: {
        Args: {
          expected_version: number | null;
          requested_address: Json;
          requested_address_id: string | null;
          requested_operation: string;
        };
        Returns: {
          address_id: string;
          version: number;
        }[];
      };
      mask_notification_email: { Args: { email: string }; Returns: string };
      normalize_checkout_address: { Args: { requested: Json }; Returns: Json };
      normalize_customer_address: { Args: { requested: Json }; Returns: Json };
      normalize_manual_order_payload: {
        Args: { requested_payload: Json };
        Returns: Json;
      };
      payments_test_mode_enabled: { Args: never; Returns: boolean };
      populate_manual_order: {
        Args: {
          normalized_payload: Json;
          replacing: boolean;
          requested_order_id: string;
        };
        Returns: undefined;
      };
      prepare_stripe_checkout_session: {
        Args: { requested_idempotency_key: string; requested_order_id: string };
        Returns: {
          amount_minor_units: number;
          checkout_attempt_id: string;
          checkout_idempotency_key: string;
          currency: string;
          payment_id: string;
          replayed: boolean;
          stripe_checkout_session_id: string;
          stripe_idempotency_key: string;
        }[];
      };
      process_stripe_webhook_event: {
        Args: {
          requested_amount: number;
          requested_api_version: string;
          requested_checkout_attempt_id: string;
          requested_checkout_session_id: string;
          requested_currency: string;
          requested_event_created_at: string;
          requested_event_id: string;
          requested_event_type: string;
          requested_failure_reason: string;
          requested_livemode: boolean;
          requested_payload_hash: string;
          requested_payment_id: string;
          requested_payment_intent_id: string;
          requested_payment_status: string;
          requested_refund_created_at: string;
          requested_refund_id: string;
          requested_refund_status: string;
        };
        Returns: {
          outcome: string;
          processed: boolean;
          replayed: boolean;
        }[];
      };
      publish_marketplace_config_version: {
        Args: { requested_config_id: string; requested_reason: string };
        Returns: {
          created_at: string;
          created_by: string | null;
          effective_from: string | null;
          effective_to: string | null;
          id: string;
          publication_reason: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["marketplace_config_status"];
          updated_at: string;
          version_number: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_config_versions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_market_price_research: {
        Args: {
          requested_average_price: unknown;
          requested_brand_id: string;
          requested_category_id: string;
          requested_checked_at: string;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_confidence: Database["public"]["Enums"]["market_price_confidence"];
          requested_excluded_count: number;
          requested_expires_at: string;
          requested_high_price: unknown;
          requested_input_fingerprint: string;
          requested_input_snapshot: Json;
          requested_low_price: unknown;
          requested_median_price: unknown;
          requested_product_id: string | null;
          requested_provider: string;
          requested_result_snapshot: Json;
          requested_sample_size: number;
          requested_search_query: string | null;
        };
        Returns: string;
      };
      recover_expired_notification_leases: { Args: never; Returns: number };
      register_partner_profile: {
        Args: {
          requested_legal_type: Database["public"]["Enums"]["partner_legal_type"];
        };
        Returns: {
          created_at: string;
          id: string;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          rejected_at: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          suspended_at: string | null;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "partner_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_product_image: {
        Args: {
          requested_alt_text: string;
          requested_is_condition_evidence: boolean;
          requested_product_id: string;
          requested_storage_path: string;
        };
        Returns: string;
      };
      remove_product_image: {
        Args: { requested_image_id: string; requested_product_id: string };
        Returns: {
          alt_text: string;
          id: string;
          is_condition_evidence: boolean;
          is_primary: boolean;
          sort_order: number;
          storage_path: string;
        }[];
      };
      reorder_product_images: {
        Args: { requested_image_ids: string[]; requested_product_id: string };
        Returns: boolean;
      };
      repair_product_base_variant: {
        Args: { requested_product_id: string };
        Returns: {
          created: boolean;
          product_id: string;
          variant_id: string;
        }[];
      };
      reserve_brps_product_sku: {
        Args: { requested_base: string };
        Returns: string;
      };
      resolve_product_pricing_rule: {
        Args: {
          requested_acquisition_channel: Database["public"]["Enums"]["acquisition_channel"];
          requested_category_id: string;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_product_id: string;
        };
        Returns: string;
      };
      restore_product_image: {
        Args: {
          requested_alt_text: string;
          requested_image_id: string;
          requested_is_condition_evidence: boolean;
          requested_is_primary: boolean;
          requested_product_id: string;
          requested_sort_order: number;
          requested_storage_path: string;
        };
        Returns: boolean;
      };
      retry_failed_notification_deliveries: { Args: never; Returns: number };
      review_order_payment: {
        Args: {
          expected_payment_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["payment_status"];
        };
        Returns: {
          payment_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["payment_status"];
          version: number;
        }[];
      };
      round_up_commercial_price: {
        Args: { requested_market_upper?: unknown; requested_minimum: unknown };
        Returns: unknown;
      };
      stripe_checkout_test_mode_enabled: { Args: never; Returns: boolean };
      submit_bank_transfer: {
        Args: {
          expected_payment_version: number;
          requested_idempotency_key: string;
          requested_order_id: string;
          requested_sender_bank: string;
          requested_sender_name: string;
          requested_transfer_reference: string;
          requested_transferred_at: string;
        };
        Returns: {
          payment_id: string;
          replayed: boolean;
          status: Database["public"]["Enums"]["payment_status"];
          submission_id: string;
          version: number;
        }[];
      };
      sync_product_golf_details: {
        Args: {
          requested_components?: Json;
          requested_condition_score: number;
          requested_product_id: string;
          requested_specifications: Json;
          requested_target_player: Database["public"]["Enums"]["product_target_player"];
        };
        Returns: undefined;
      };
      transition_partner_status: {
        Args: {
          expected_version: number;
          requested_partner_id: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["partner_status"];
        };
        Returns: {
          created_at: string;
          id: string;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          rejected_at: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          suspended_at: string | null;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "partner_profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_customer_profile: {
        Args: {
          requested_first_name: string;
          requested_last_name: string;
          requested_phone: string;
        };
        Returns: undefined;
      };
      update_golf_product_with_base_variant: {
        Args: {
          expected_published: boolean;
          expected_status: Database["public"]["Enums"]["product_status"];
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_components?: Json;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_condition_score: number | null;
          requested_currency: unknown;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_product_id: string;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
          requested_specifications: Json;
          requested_target_player:
            Database["public"]["Enums"]["product_target_player"] | null;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      update_manual_order_draft: {
        Args: {
          expected_version: number;
          requested_order_id: string;
          requested_payload: Json;
        };
        Returns: {
          order_id: string;
          version: number;
        }[];
      };
      update_manual_order_payment: {
        Args: {
          expected_version: number;
          requested_method: Database["public"]["Enums"]["manual_payment_method"];
          requested_order_id: string;
          requested_status: Database["public"]["Enums"]["manual_payment_status"];
        };
        Returns: {
          order_id: string;
          version: number;
        }[];
      };
      update_operational_order_payment: {
        Args: {
          expected_version: number;
          requested_method: Database["public"]["Enums"]["manual_payment_method"];
          requested_order_id: string;
          requested_status: Database["public"]["Enums"]["manual_payment_status"];
        };
        Returns: {
          order_id: string;
          version: number;
        }[];
      };
      update_priced_golf_product_with_base_variant: {
        Args: {
          expected_published: boolean;
          expected_status: Database["public"]["Enums"]["product_status"];
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_components: Json;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_condition_score: number | null;
          requested_currency: unknown;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_pricing: Json;
          requested_product_id: string;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
          requested_specifications: Json;
          requested_target_player:
            Database["public"]["Enums"]["product_target_player"] | null;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      update_product_image: {
        Args: {
          requested_alt_text: string;
          requested_image_id: string;
          requested_is_condition_evidence: boolean;
          requested_is_primary: boolean;
          requested_product_id: string;
        };
        Returns: boolean;
      };
      update_product_with_base_variant: {
        Args: {
          expected_published: boolean;
          expected_status: Database["public"]["Enums"]["product_status"];
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: unknown;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade: Database["public"]["Enums"]["product_condition_grade"];
          requested_condition_notes: string;
          requested_currency: unknown;
          requested_description: string;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number;
          requested_lead_time_min_days: number;
          requested_name: string;
          requested_price: unknown;
          requested_price_is_estimate: boolean;
          requested_product_id: string;
          requested_published: boolean;
          requested_short_description: string;
          requested_sku: string;
          requested_slug: string;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
    };
    Enums: {
      acquisition_channel: "purchase" | "trade_in";
      advisory_request_status: "new" | "in_contact" | "resolved" | "closed";
      advisory_session_status: "active" | "completed" | "abandoned";
      cart_status: "active" | "converted" | "abandoned";
      catalog_record_status: "active" | "archived";
      contact_channel: "email" | "phone" | "whatsapp";
      fulfillment_type: "in_stock" | "special_order" | "preorder";
      golf_bag_type:
        "cart_bag" | "stand_bag" | "tour_bag" | "pencil_bag" | "travel_bag";
      golf_club_type:
        "driver" | "fairway_wood" | "hybrid" | "iron" | "wedge" | "putter";
      golf_product_family: "club" | "bag" | "set";
      golf_putter_head_type: "blade" | "mallet";
      golf_set_type: "complete_set" | "iron_set" | "starter_set" | "junior_set";
      golf_shaft_flex:
        "ladies" | "senior" | "regular" | "stiff" | "x_stiff" | "other";
      golf_shaft_material: "graphite" | "steel" | "other";
      golfer_handedness: "right" | "left";
      inventory_movement_type:
        | "receipt"
        | "adjustment"
        | "reservation"
        | "release"
        | "sale"
        | "return";
      manual_order_channel:
        | "whatsapp"
        | "instagram"
        | "phone"
        | "in_person"
        | "bank_transfer"
        | "other";
      manual_payment_method:
        "none" | "bank_transfer" | "cash" | "external_terminal";
      manual_payment_status:
        | "pending"
        | "transfer_pending"
        | "transfer_verified"
        | "cash_received"
        | "external_terminal_received";
      market_price_confidence: "high" | "medium" | "low" | "unavailable";
      marketplace_config_status: "DRAFT" | "PUBLISHED" | "RETIRED";
      marketplace_partner_tier:
        "BOGEY" | "PAR" | "BIRDIE" | "ALBATROSS" | "HOLE_IN_ONE";
      notification_channel: "email";
      notification_delivery_status:
        "pending" | "processing" | "sent" | "failed" | "dead_letter";
      notification_event_type:
        | "order_created"
        | "order_confirmed"
        | "transfer_submitted"
        | "payment_under_review"
        | "payment_paid"
        | "payment_rejected"
        | "payment_refunded"
        | "order_cancelled";
      order_origin: "manual" | "web";
      order_status:
        | "created"
        | "pending_confirmation"
        | "simulated_payment_approved"
        | "preparing"
        | "ready_to_ship"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned";
      page_status: "draft" | "published" | "archived";
      partner_document_status:
        "UPLOADED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED";
      partner_legal_type: "INDIVIDUAL" | "SOLE_PROPRIETOR" | "LEGAL_ENTITY";
      partner_status:
        | "REGISTERED"
        | "IDENTITY_PENDING"
        | "UNDER_REVIEW"
        | "VERIFIED"
        | "SUSPENDED"
        | "REJECTED";
      payment_method: "bank_transfer" | "cash" | "external_terminal" | "card";
      payment_provider: "manual" | "stripe";
      payment_status:
        | "pending"
        | "submitted"
        | "under_review"
        | "paid"
        | "rejected"
        | "refunded"
        | "failed"
        | "partially_refunded";
      pricing_health: "GREEN" | "YELLOW" | "RED";
      pricing_status:
        | "AUTO_COMPETITIVE"
        | "ABOVE_MARKET_WARNING"
        | "AUTO_MARKET_ADJUSTED_UP"
        | "NO_MARKET_REFERENCE";
      product_component_kind: "club" | "bag";
      product_condition: "new" | "used";
      product_condition_grade:
        "like_new" | "excellent" | "very_good" | "good" | "fair";
      product_status: "draft" | "active" | "archived";
      product_target_player: "men" | "women" | "junior" | "unisex";
      stripe_checkout_status:
        | "creating"
        | "open"
        | "payment_failed"
        | "completed"
        | "expired"
        | "abandoned";
      stripe_event_processing_status: "processing" | "processed" | "rejected";
      stripe_refund_status:
        "pending" | "requires_action" | "succeeded" | "failed" | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      acquisition_channel: ["purchase", "trade_in"],
      advisory_request_status: ["new", "in_contact", "resolved", "closed"],
      advisory_session_status: ["active", "completed", "abandoned"],
      cart_status: ["active", "converted", "abandoned"],
      catalog_record_status: ["active", "archived"],
      contact_channel: ["email", "phone", "whatsapp"],
      fulfillment_type: ["in_stock", "special_order", "preorder"],
      golf_bag_type: [
        "cart_bag",
        "stand_bag",
        "tour_bag",
        "pencil_bag",
        "travel_bag",
      ],
      golf_club_type: [
        "driver",
        "fairway_wood",
        "hybrid",
        "iron",
        "wedge",
        "putter",
      ],
      golf_product_family: ["club", "bag", "set"],
      golf_putter_head_type: ["blade", "mallet"],
      golf_set_type: ["complete_set", "iron_set", "starter_set", "junior_set"],
      golf_shaft_flex: [
        "ladies",
        "senior",
        "regular",
        "stiff",
        "x_stiff",
        "other",
      ],
      golf_shaft_material: ["graphite", "steel", "other"],
      golfer_handedness: ["right", "left"],
      inventory_movement_type: [
        "receipt",
        "adjustment",
        "reservation",
        "release",
        "sale",
        "return",
      ],
      manual_order_channel: [
        "whatsapp",
        "instagram",
        "phone",
        "in_person",
        "bank_transfer",
        "other",
      ],
      manual_payment_method: [
        "none",
        "bank_transfer",
        "cash",
        "external_terminal",
      ],
      manual_payment_status: [
        "pending",
        "transfer_pending",
        "transfer_verified",
        "cash_received",
        "external_terminal_received",
      ],
      market_price_confidence: ["high", "medium", "low", "unavailable"],
      marketplace_config_status: ["DRAFT", "PUBLISHED", "RETIRED"],
      marketplace_partner_tier: [
        "BOGEY",
        "PAR",
        "BIRDIE",
        "ALBATROSS",
        "HOLE_IN_ONE",
      ],
      notification_channel: ["email"],
      notification_delivery_status: [
        "pending",
        "processing",
        "sent",
        "failed",
        "dead_letter",
      ],
      notification_event_type: [
        "order_created",
        "order_confirmed",
        "transfer_submitted",
        "payment_under_review",
        "payment_paid",
        "payment_rejected",
        "payment_refunded",
        "order_cancelled",
      ],
      order_origin: ["manual", "web"],
      order_status: [
        "created",
        "pending_confirmation",
        "simulated_payment_approved",
        "preparing",
        "ready_to_ship",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      page_status: ["draft", "published", "archived"],
      partner_document_status: [
        "UPLOADED",
        "UNDER_REVIEW",
        "VERIFIED",
        "REJECTED",
      ],
      partner_legal_type: ["INDIVIDUAL", "SOLE_PROPRIETOR", "LEGAL_ENTITY"],
      partner_status: [
        "REGISTERED",
        "IDENTITY_PENDING",
        "UNDER_REVIEW",
        "VERIFIED",
        "SUSPENDED",
        "REJECTED",
      ],
      payment_method: ["bank_transfer", "cash", "external_terminal", "card"],
      payment_provider: ["manual", "stripe"],
      payment_status: [
        "pending",
        "submitted",
        "under_review",
        "paid",
        "rejected",
        "refunded",
        "failed",
        "partially_refunded",
      ],
      pricing_health: ["GREEN", "YELLOW", "RED"],
      pricing_status: [
        "AUTO_COMPETITIVE",
        "ABOVE_MARKET_WARNING",
        "AUTO_MARKET_ADJUSTED_UP",
        "NO_MARKET_REFERENCE",
      ],
      product_component_kind: ["club", "bag"],
      product_condition: ["new", "used"],
      product_condition_grade: [
        "like_new",
        "excellent",
        "very_good",
        "good",
        "fair",
      ],
      product_status: ["draft", "active", "archived"],
      product_target_player: ["men", "women", "junior", "unisex"],
      stripe_checkout_status: [
        "creating",
        "open",
        "payment_failed",
        "completed",
        "expired",
        "abandoned",
      ],
      stripe_event_processing_status: ["processing", "processed", "rejected"],
      stripe_refund_status: [
        "pending",
        "requires_action",
        "succeeded",
        "failed",
        "canceled",
      ],
    },
  },
} as const;
