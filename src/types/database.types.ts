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
          item_source: Database["public"]["Enums"]["order_item_source"];
          marketplace_listing_id: string | null;
          marketplace_listing_version_id: string | null;
          marketplace_pricing_quote_id: string | null;
          price_seen: number;
          quantity: number;
          updated_at: string;
          variant_id: string | null;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          currency_seen?: string;
          id?: string;
          item_source?: Database["public"]["Enums"]["order_item_source"];
          marketplace_listing_id?: string | null;
          marketplace_listing_version_id?: string | null;
          marketplace_pricing_quote_id?: string | null;
          price_seen?: number;
          quantity: number;
          updated_at?: string;
          variant_id?: string | null;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          currency_seen?: string;
          id?: string;
          item_source?: Database["public"]["Enums"]["order_item_source"];
          marketplace_listing_id?: string | null;
          marketplace_listing_version_id?: string | null;
          marketplace_pricing_quote_id?: string | null;
          price_seen?: number;
          quantity?: number;
          updated_at?: string;
          variant_id?: string | null;
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
            foreignKeyName: "cart_items_marketplace_listing_id_fkey";
            columns: ["marketplace_listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_marketplace_listing_version_id_fkey";
            columns: ["marketplace_listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_marketplace_pricing_quote_id_fkey";
            columns: ["marketplace_pricing_quote_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_pricing_quotes";
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
      catalog_product_models: {
        Row: {
          brand_id: string;
          category_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_name: string;
          normalized_model_name: string;
          source_product_id: string | null;
          status: Database["public"]["Enums"]["catalog_record_status"];
          updated_at: string;
        };
        Insert: {
          brand_id: string;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_name: string;
          normalized_model_name: string;
          source_product_id?: string | null;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Update: {
          brand_id?: string;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          model_name?: string;
          normalized_model_name?: string;
          source_product_id?: string | null;
          status?: Database["public"]["Enums"]["catalog_record_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_product_models_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_product_models_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_product_models_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_product_models_source_product_id_fkey";
            columns: ["source_product_id"];
            isOneToOne: false;
            referencedRelation: "products";
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
      inventory_reservations: {
        Row: {
          committed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          idempotency_key: string;
          inventory_id: string | null;
          marketplace_inventory_id: string | null;
          order_id: string;
          order_item_id: string;
          quantity: number;
          release_reason: string | null;
          released_at: string | null;
          reserved_at: string;
          source: Database["public"]["Enums"]["order_item_source"];
          status: Database["public"]["Enums"]["inventory_reservation_status"];
          updated_at: string;
        };
        Insert: {
          committed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          idempotency_key: string;
          inventory_id?: string | null;
          marketplace_inventory_id?: string | null;
          order_id: string;
          order_item_id: string;
          quantity: number;
          release_reason?: string | null;
          released_at?: string | null;
          reserved_at?: string;
          source: Database["public"]["Enums"]["order_item_source"];
          status?: Database["public"]["Enums"]["inventory_reservation_status"];
          updated_at?: string;
        };
        Update: {
          committed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          idempotency_key?: string;
          inventory_id?: string | null;
          marketplace_inventory_id?: string | null;
          order_id?: string;
          order_item_id?: string;
          quantity?: number;
          release_reason?: string | null;
          released_at?: string | null;
          reserved_at?: string;
          source?: Database["public"]["Enums"]["order_item_source"];
          status?: Database["public"]["Enums"]["inventory_reservation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_marketplace_inventory_id_fkey";
            columns: ["marketplace_inventory_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "order_items";
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
      marketplace_acceptance_job_runs: {
        Row: {
          completed_at: string | null;
          error_message: string | null;
          execution_key: string;
          id: string;
          processed_count: number;
          started_at: string;
          status: Database["public"]["Enums"]["marketplace_acceptance_job_status"];
        };
        Insert: {
          completed_at?: string | null;
          error_message?: string | null;
          execution_key: string;
          id?: string;
          processed_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["marketplace_acceptance_job_status"];
        };
        Update: {
          completed_at?: string | null;
          error_message?: string | null;
          execution_key?: string;
          id?: string;
          processed_count?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["marketplace_acceptance_job_status"];
        };
        Relationships: [];
      };
      marketplace_claim_events: {
        Row: {
          actor_id: string | null;
          actor_role: string;
          buyer_visible: boolean;
          claim_id: string;
          created_at: string;
          event_type: string;
          from_status:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
          id: string;
          idempotency_key: string;
          metadata: Json;
          partner_visible: boolean;
          reason: string | null;
          to_status:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_role: string;
          buyer_visible?: boolean;
          claim_id: string;
          created_at?: string;
          event_type: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          partner_visible?: boolean;
          reason?: string | null;
          to_status?:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          actor_role?: string;
          buyer_visible?: boolean;
          claim_id?: string;
          created_at?: string;
          event_type?: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          partner_visible?: boolean;
          reason?: string | null;
          to_status?:
            Database["public"]["Enums"]["marketplace_claim_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_claim_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claim_events_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_claim_evidence: {
        Row: {
          claim_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          mime_type: string;
          note: string | null;
          partner_visible: boolean;
          size_bytes: number;
          storage_path: string;
          submitted_by: string;
        };
        Insert: {
          claim_id: string;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          mime_type: string;
          note?: string | null;
          partner_visible?: boolean;
          size_bytes: number;
          storage_path: string;
          submitted_by: string;
        };
        Update: {
          claim_id?: string;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          mime_type?: string;
          note?: string | null;
          partner_visible?: boolean;
          size_bytes?: number;
          storage_path?: string;
          submitted_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_claim_evidence_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claim_evidence_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_claim_resolutions: {
        Row: {
          actor_id: string;
          adjustment_amount_cents: number | null;
          buyer_outcome: string;
          claim_id: string;
          created_at: string;
          decision: Database["public"]["Enums"]["marketplace_claim_decision"];
          evidence_summary: string;
          financial_effect: Database["public"]["Enums"]["marketplace_claim_financial_effect"];
          id: string;
          idempotency_key: string;
          reason: string;
          responsibility: Database["public"]["Enums"]["marketplace_claim_responsibility"];
          return_requirement: Database["public"]["Enums"]["marketplace_return_requirement"];
        };
        Insert: {
          actor_id: string;
          adjustment_amount_cents?: number | null;
          buyer_outcome: string;
          claim_id: string;
          created_at?: string;
          decision: Database["public"]["Enums"]["marketplace_claim_decision"];
          evidence_summary: string;
          financial_effect: Database["public"]["Enums"]["marketplace_claim_financial_effect"];
          id?: string;
          idempotency_key: string;
          reason: string;
          responsibility: Database["public"]["Enums"]["marketplace_claim_responsibility"];
          return_requirement: Database["public"]["Enums"]["marketplace_return_requirement"];
        };
        Update: {
          actor_id?: string;
          adjustment_amount_cents?: number | null;
          buyer_outcome?: string;
          claim_id?: string;
          created_at?: string;
          decision?: Database["public"]["Enums"]["marketplace_claim_decision"];
          evidence_summary?: string;
          financial_effect?: Database["public"]["Enums"]["marketplace_claim_financial_effect"];
          id?: string;
          idempotency_key?: string;
          reason?: string;
          responsibility?: Database["public"]["Enums"]["marketplace_claim_responsibility"];
          return_requirement?: Database["public"]["Enums"]["marketplace_return_requirement"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_claim_resolutions_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claim_resolutions_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_claims";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_claims: {
        Row: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        };
        Insert: {
          acceptance_id: string;
          approved_adjustment_cents?: number | null;
          buyer_id: string;
          claim_hold_id?: string | null;
          created_at?: string;
          description: string;
          evaluation_confidence?: number | null;
          evaluation_notes?: string | null;
          evaluation_source?: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at?: string | null;
          financial_effect?:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id?: string;
          listing_version_id: string;
          opened_at?: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status?: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility?:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement?:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status?: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          acceptance_id?: string;
          approved_adjustment_cents?: number | null;
          buyer_id?: string;
          claim_hold_id?: string | null;
          created_at?: string;
          description?: string;
          evaluation_confidence?: number | null;
          evaluation_notes?: string | null;
          evaluation_source?: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at?: string | null;
          financial_effect?:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id?: string;
          id?: string;
          listing_version_id?: string;
          opened_at?: string;
          opened_idempotency_key?: string;
          order_id?: string;
          order_item_id?: string;
          partner_id?: string;
          payable_id?: string;
          reason?: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status?: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility?:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement?:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status?: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_claims_acceptance_id_fkey";
            columns: ["acceptance_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_delivery_acceptances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_claim_hold_id_fkey";
            columns: ["claim_hold_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_holds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_order_item_snapshots";
            referencedColumns: ["order_item_id"];
          },
          {
            foreignKeyName: "marketplace_claims_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_claims_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
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
      marketplace_delivery_acceptances: {
        Row: {
          acceptance_deadline: string;
          acceptance_window_hours: number;
          accepted_at: string | null;
          actor_id: string | null;
          buyer_id: string;
          claim_opened_at: string | null;
          config_version_id: string;
          created_at: string;
          delivered_at: string;
          finalized_at: string | null;
          fulfillment_id: string;
          id: string;
          idempotency_key: string | null;
          order_id: string;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_acceptance_status"];
          updated_at: string;
          version: number;
        };
        Insert: {
          acceptance_deadline: string;
          acceptance_window_hours: number;
          accepted_at?: string | null;
          actor_id?: string | null;
          buyer_id: string;
          claim_opened_at?: string | null;
          config_version_id: string;
          created_at?: string;
          delivered_at: string;
          finalized_at?: string | null;
          fulfillment_id: string;
          id?: string;
          idempotency_key?: string | null;
          order_id: string;
          partner_id: string;
          status?: Database["public"]["Enums"]["marketplace_acceptance_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          acceptance_deadline?: string;
          acceptance_window_hours?: number;
          accepted_at?: string | null;
          actor_id?: string | null;
          buyer_id?: string;
          claim_opened_at?: string | null;
          config_version_id?: string;
          created_at?: string;
          delivered_at?: string;
          finalized_at?: string | null;
          fulfillment_id?: string;
          id?: string;
          idempotency_key?: string | null;
          order_id?: string;
          partner_id?: string;
          status?: Database["public"]["Enums"]["marketplace_acceptance_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_delivery_acceptances_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_delivery_acceptances_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_delivery_acceptances_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_delivery_acceptances_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: true;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_delivery_acceptances_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_delivery_acceptances_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
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
      marketplace_fulfillment_idempotency_keys: {
        Row: {
          action: string;
          actor_id: string;
          created_at: string;
          fulfillment_id: string;
          idempotency_key: string;
        };
        Insert: {
          action: string;
          actor_id: string;
          created_at?: string;
          fulfillment_id: string;
          idempotency_key: string;
        };
        Update: {
          action?: string;
          actor_id?: string;
          created_at?: string;
          fulfillment_id?: string;
          idempotency_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_fulfillment_idempotency_keys_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_fulfillment_idempotency_keys_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_fulfillment_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status:
            | Database["public"]["Enums"]["marketplace_fulfillment_status"]
            | null;
          fulfillment_id: string;
          id: string;
          reason: string | null;
          to_status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          version: number;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_fulfillment_status"]
            | null;
          fulfillment_id: string;
          id?: string;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          version: number;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_fulfillment_status"]
            | null;
          fulfillment_id?: string;
          id?: string;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_fulfillment_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_fulfillment_status_history_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_images: {
        Row: {
          height_pixels: number | null;
          id: string;
          listing_id: string;
          mime_type: string;
          sha256: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          width_pixels: number | null;
        };
        Insert: {
          height_pixels?: number | null;
          id?: string;
          listing_id: string;
          mime_type: string;
          sha256: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by: string;
          width_pixels?: number | null;
        };
        Update: {
          height_pixels?: number | null;
          id?: string;
          listing_id?: string;
          mime_type?: string;
          sha256?: string;
          size_bytes?: number;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string;
          width_pixels?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_images_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_images_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_inventory: {
        Row: {
          created_at: string;
          custody: Database["public"]["Enums"]["marketplace_listing_custody"];
          fulfillment: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id: string;
          listing_id: string;
          ownership: Database["public"]["Enums"]["marketplace_listing_ownership"];
          quantity_available: number | null;
          quantity_on_hand: number;
          quantity_reserved: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          custody?: Database["public"]["Enums"]["marketplace_listing_custody"];
          fulfillment?: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id?: string;
          listing_id: string;
          ownership?: Database["public"]["Enums"]["marketplace_listing_ownership"];
          quantity_available?: number | null;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          custody?: Database["public"]["Enums"]["marketplace_listing_custody"];
          fulfillment?: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id?: string;
          listing_id?: string;
          ownership?: Database["public"]["Enums"]["marketplace_listing_ownership"];
          quantity_available?: number | null;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_inventory_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_inventory_movements: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          inventory_id: string;
          listing_version_id: string | null;
          movement_type: Database["public"]["Enums"]["marketplace_inventory_movement_type"];
          quantity_on_hand_after: number;
          quantity_on_hand_delta: number;
          quantity_reserved_after: number;
          quantity_reserved_delta: number;
          reason: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          inventory_id: string;
          listing_version_id?: string | null;
          movement_type: Database["public"]["Enums"]["marketplace_inventory_movement_type"];
          quantity_on_hand_after: number;
          quantity_on_hand_delta: number;
          quantity_reserved_after: number;
          quantity_reserved_delta?: number;
          reason: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          inventory_id?: string;
          listing_version_id?: string | null;
          movement_type?: Database["public"]["Enums"]["marketplace_inventory_movement_type"];
          quantity_on_hand_after?: number;
          quantity_on_hand_delta?: number;
          quantity_reserved_after?: number;
          quantity_reserved_delta?: number;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_inventory_movements_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_inventory_movements_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_inventory_movements_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_photo_requirements: {
        Row: {
          category_id: string;
          condition: Database["public"]["Enums"]["product_condition"] | null;
          created_at: string;
          id: string;
          image_type: string;
          label: string;
          requirement: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order: number;
        };
        Insert: {
          category_id: string;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          created_at?: string;
          id?: string;
          image_type: string;
          label: string;
          requirement: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order?: number;
        };
        Update: {
          category_id?: string;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          created_at?: string;
          id?: string;
          image_type?: string;
          label?: string;
          requirement?: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_photo_requirements_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_review_requests: {
        Row: {
          area: Database["public"]["Enums"]["marketplace_listing_review_area"];
          comment: string;
          created_at: string;
          created_by: string;
          id: string;
          listing_id: string;
          listing_version_id: string;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["marketplace_listing_review_request_status"];
          visibility: Database["public"]["Enums"]["marketplace_listing_review_visibility"];
        };
        Insert: {
          area: Database["public"]["Enums"]["marketplace_listing_review_area"];
          comment: string;
          created_at?: string;
          created_by: string;
          id?: string;
          listing_id: string;
          listing_version_id: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["marketplace_listing_review_request_status"];
          visibility: Database["public"]["Enums"]["marketplace_listing_review_visibility"];
        };
        Update: {
          area?: Database["public"]["Enums"]["marketplace_listing_review_area"];
          comment?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          listing_id?: string;
          listing_version_id?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["marketplace_listing_review_request_status"];
          visibility?: Database["public"]["Enums"]["marketplace_listing_review_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_review_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_review_requests_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_review_requests_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_review_requests_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status:
            Database["public"]["Enums"]["marketplace_listing_status"] | null;
          id: string;
          listing_id: string;
          listing_version_id: string | null;
          lock_version: number;
          reason: string | null;
          to_status: Database["public"]["Enums"]["marketplace_listing_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_listing_status"] | null;
          id?: string;
          listing_id: string;
          listing_version_id?: string | null;
          lock_version: number;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["marketplace_listing_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_listing_status"] | null;
          id?: string;
          listing_id?: string;
          listing_version_id?: string | null;
          lock_version?: number;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["marketplace_listing_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_status_history_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_status_history_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_version_images: {
        Row: {
          alt_text: string;
          image_id: string;
          image_type: string;
          is_sensitive: boolean;
          requirement: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order: number;
          version_id: string;
        };
        Insert: {
          alt_text: string;
          image_id: string;
          image_type: string;
          is_sensitive?: boolean;
          requirement: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order?: number;
          version_id: string;
        };
        Update: {
          alt_text?: string;
          image_id?: string;
          image_type?: string;
          is_sensitive?: boolean;
          requirement?: Database["public"]["Enums"]["marketplace_listing_image_requirement"];
          sort_order?: number;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_version_images_image_id_fkey";
            columns: ["image_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_images";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_version_images_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listing_versions: {
        Row: {
          accessories_included: Json;
          brand_id: string | null;
          canonical_model_id: string | null;
          category_id: string;
          condition: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes: string | null;
          created_at: string;
          created_by: string;
          custody: Database["public"]["Enums"]["marketplace_listing_custody"];
          declared_defects: Json;
          defects_acknowledged: boolean;
          description: string | null;
          evaluation_confidence: number | null;
          evaluation_output: Json | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_listing_evaluation_source"];
          evaluation_status: Database["public"]["Enums"]["marketplace_listing_evaluation_status"];
          evaluation_summary: string | null;
          fulfillment: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id: string;
          listing_id: string;
          ownership: Database["public"]["Enums"]["marketplace_listing_ownership"];
          proposed_brand: string | null;
          proposed_model: string | null;
          quantity: number;
          reviewed_at: string | null;
          serial_number_private: string | null;
          specifications: Json;
          state: Database["public"]["Enums"]["marketplace_listing_version_state"];
          submitted_at: string | null;
          title: string | null;
          updated_at: string;
          version_number: number;
        };
        Insert: {
          accessories_included?: Json;
          brand_id?: string | null;
          canonical_model_id?: string | null;
          category_id: string;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes?: string | null;
          created_at?: string;
          created_by: string;
          custody?: Database["public"]["Enums"]["marketplace_listing_custody"];
          declared_defects?: Json;
          defects_acknowledged?: boolean;
          description?: string | null;
          evaluation_confidence?: number | null;
          evaluation_output?: Json | null;
          evaluation_source?: Database["public"]["Enums"]["marketplace_listing_evaluation_source"];
          evaluation_status?: Database["public"]["Enums"]["marketplace_listing_evaluation_status"];
          evaluation_summary?: string | null;
          fulfillment?: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id?: string;
          listing_id: string;
          ownership?: Database["public"]["Enums"]["marketplace_listing_ownership"];
          proposed_brand?: string | null;
          proposed_model?: string | null;
          quantity?: number;
          reviewed_at?: string | null;
          serial_number_private?: string | null;
          specifications?: Json;
          state?: Database["public"]["Enums"]["marketplace_listing_version_state"];
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string;
          version_number: number;
        };
        Update: {
          accessories_included?: Json;
          brand_id?: string | null;
          canonical_model_id?: string | null;
          category_id?: string;
          condition?: Database["public"]["Enums"]["product_condition"] | null;
          condition_grade?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_notes?: string | null;
          created_at?: string;
          created_by?: string;
          custody?: Database["public"]["Enums"]["marketplace_listing_custody"];
          declared_defects?: Json;
          defects_acknowledged?: boolean;
          description?: string | null;
          evaluation_confidence?: number | null;
          evaluation_output?: Json | null;
          evaluation_source?: Database["public"]["Enums"]["marketplace_listing_evaluation_source"];
          evaluation_status?: Database["public"]["Enums"]["marketplace_listing_evaluation_status"];
          evaluation_summary?: string | null;
          fulfillment?: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          id?: string;
          listing_id?: string;
          ownership?: Database["public"]["Enums"]["marketplace_listing_ownership"];
          proposed_brand?: string | null;
          proposed_model?: string | null;
          quantity?: number;
          reviewed_at?: string | null;
          serial_number_private?: string | null;
          specifications?: Json;
          state?: Database["public"]["Enums"]["marketplace_listing_version_state"];
          submitted_at?: string | null;
          title?: string | null;
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listing_versions_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_versions_canonical_model_id_fkey";
            columns: ["canonical_model_id"];
            isOneToOne: false;
            referencedRelation: "catalog_product_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_versions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_listing_versions_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_listings: {
        Row: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_version_id?: string | null;
          archived_at?: string | null;
          created_at?: string;
          current_version_id?: string | null;
          id?: string;
          last_submitted_at?: string | null;
          lock_version?: number;
          partner_id: string;
          status?: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_version_id?: string | null;
          archived_at?: string | null;
          created_at?: string;
          current_version_id?: string | null;
          id?: string;
          last_submitted_at?: string | null;
          lock_version?: number;
          partner_id?: string;
          status?: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_approved_version_fk";
            columns: ["id", "approved_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["listing_id", "id"];
          },
          {
            foreignKeyName: "marketplace_listings_current_version_fk";
            columns: ["id", "current_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["listing_id", "id"];
          },
          {
            foreignKeyName: "marketplace_listings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_manual_market_references: {
        Row: {
          actor_id: string;
          analysis_id: string;
          created_at: string;
          high_market: number | null;
          id: string;
          low_market: number | null;
          reason: string;
          reference_price: number;
          source_description: string;
        };
        Insert: {
          actor_id: string;
          analysis_id: string;
          created_at?: string;
          high_market?: number | null;
          id?: string;
          low_market?: number | null;
          reason: string;
          reference_price: number;
          source_description: string;
        };
        Update: {
          actor_id?: string;
          analysis_id?: string;
          created_at?: string;
          high_market?: number | null;
          id?: string;
          low_market?: number | null;
          reason?: string;
          reference_price?: number;
          source_description?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_manual_market_references_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_manual_market_references_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_market_analyses";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_market_analyses: {
        Row: {
          analysis_version: string;
          average_price: number | null;
          canonical_product_model_id: string | null;
          checked_at: string | null;
          completed_by: string | null;
          confidence: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at: string;
          excluded_comparable_count: number;
          expires_at: string | null;
          flags: Json;
          high_market: number | null;
          id: string;
          idempotency_key: string;
          input_fingerprint: string | null;
          input_snapshot: Json;
          listing_id: string;
          listing_version_id: string;
          low_market: number | null;
          median_price: number | null;
          partner_id: string;
          provider: string | null;
          provider_status: string | null;
          recommended_price: number | null;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          source: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count: number;
        };
        Insert: {
          analysis_version?: string;
          average_price?: number | null;
          canonical_product_model_id?: string | null;
          checked_at?: string | null;
          completed_by?: string | null;
          confidence?: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at?: string;
          excluded_comparable_count?: number;
          expires_at?: string | null;
          flags?: Json;
          high_market?: number | null;
          id?: string;
          idempotency_key: string;
          input_fingerprint?: string | null;
          input_snapshot?: Json;
          listing_id: string;
          listing_version_id: string;
          low_market?: number | null;
          median_price?: number | null;
          partner_id: string;
          provider?: string | null;
          provider_status?: string | null;
          recommended_price?: number | null;
          requested_at?: string;
          requested_by: string;
          result_snapshot?: Json;
          source?: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status?: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count?: number;
        };
        Update: {
          analysis_version?: string;
          average_price?: number | null;
          canonical_product_model_id?: string | null;
          checked_at?: string | null;
          completed_by?: string | null;
          confidence?: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at?: string;
          excluded_comparable_count?: number;
          expires_at?: string | null;
          flags?: Json;
          high_market?: number | null;
          id?: string;
          idempotency_key?: string;
          input_fingerprint?: string | null;
          input_snapshot?: Json;
          listing_id?: string;
          listing_version_id?: string;
          low_market?: number | null;
          median_price?: number | null;
          partner_id?: string;
          provider?: string | null;
          provider_status?: string | null;
          recommended_price?: number | null;
          requested_at?: string;
          requested_by?: string;
          result_snapshot?: Json;
          source?: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status?: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_market_analyses_canonical_product_model_id_fkey";
            columns: ["canonical_product_model_id"];
            isOneToOne: false;
            referencedRelation: "catalog_product_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analyses_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analyses_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analyses_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analyses_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analyses_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_market_analysis_listing_version_fk";
            columns: ["listing_id", "listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["listing_id", "id"];
          },
        ];
      };
      marketplace_market_comparables: {
        Row: {
          analysis_id: string;
          availability: string;
          condition: string;
          created_at: string;
          currency: string;
          id: string;
          match_reasons: Json;
          match_score: number;
          observed_at: string;
          price: number;
          provider_reference: string | null;
          reference_url: string | null;
          seller: string;
          source: string;
          title: string;
        };
        Insert: {
          analysis_id: string;
          availability: string;
          condition: string;
          created_at?: string;
          currency?: string;
          id?: string;
          match_reasons?: Json;
          match_score: number;
          observed_at: string;
          price: number;
          provider_reference?: string | null;
          reference_url?: string | null;
          seller: string;
          source: string;
          title: string;
        };
        Update: {
          analysis_id?: string;
          availability?: string;
          condition?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          match_reasons?: Json;
          match_score?: number;
          observed_at?: string;
          price?: number;
          provider_reference?: string | null;
          reference_url?: string | null;
          seller?: string;
          source?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_market_comparables_analysis_id_fkey";
            columns: ["analysis_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_market_analyses";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_operational_rules: {
        Row: {
          acceptance_window_hours: number;
          carrier_handoff_hours: number;
          checkout_reservation_minutes: number;
          config_version_id: string;
          inventory_confirmation_hours: number;
          listing_expiry_days: number | null;
          payout_hour_utc: number;
          payout_interval_days: number | null;
          payout_weekday_utc: number;
          score_provisional_completed_orders: number | null;
          tier_averaging_window_days: number;
        };
        Insert: {
          acceptance_window_hours?: number;
          carrier_handoff_hours: number;
          checkout_reservation_minutes: number;
          config_version_id: string;
          inventory_confirmation_hours: number;
          listing_expiry_days?: number | null;
          payout_hour_utc?: number;
          payout_interval_days?: number | null;
          payout_weekday_utc?: number;
          score_provisional_completed_orders?: number | null;
          tier_averaging_window_days: number;
        };
        Update: {
          acceptance_window_hours?: number;
          carrier_handoff_hours?: number;
          checkout_reservation_minutes?: number;
          config_version_id?: string;
          inventory_confirmation_hours?: number;
          listing_expiry_days?: number | null;
          payout_hour_utc?: number;
          payout_interval_days?: number | null;
          payout_weekday_utc?: number;
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
      marketplace_order_item_snapshots: {
        Row: {
          accessories_snapshot: Json;
          actual_processing: number | null;
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_percentage_fee: number;
          best_round_processing_share: number;
          calculation_version: string;
          canonical_product_model_id: string;
          commission_amount: number;
          commission_rate_bps: number;
          commission_vat: number;
          condition_grade_snapshot:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot: Database["public"]["Enums"]["product_condition"];
          config_version_id: string;
          created_at: string;
          currency: string;
          declared_defects_snapshot: Json;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          estimated_processing: boolean;
          fulfillment_id: string;
          listing_id: string;
          listing_title: string;
          listing_version_id: string;
          order_item_id: string;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          pricing_quote_id: string;
          processing_total: number;
          public_line_total: number;
          public_unit_price: number;
          quantity: number;
          score_snapshot_id: string | null;
          specifications_snapshot: Json;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
        };
        Insert: {
          accessories_snapshot: Json;
          actual_processing?: number | null;
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_percentage_fee: number;
          best_round_processing_share: number;
          calculation_version: string;
          canonical_product_model_id: string;
          commission_amount: number;
          commission_rate_bps: number;
          commission_vat: number;
          condition_grade_snapshot?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot: Database["public"]["Enums"]["product_condition"];
          config_version_id: string;
          created_at?: string;
          currency?: string;
          declared_defects_snapshot: Json;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id?: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          estimated_processing?: boolean;
          fulfillment_id: string;
          listing_id: string;
          listing_title: string;
          listing_version_id: string;
          order_item_id: string;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          pricing_quote_id: string;
          processing_total: number;
          public_line_total: number;
          public_unit_price: number;
          quantity: number;
          score_snapshot_id?: string | null;
          specifications_snapshot: Json;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
        };
        Update: {
          accessories_snapshot?: Json;
          actual_processing?: number | null;
          admin_fee_bps?: number;
          admin_fixed_fee?: number;
          admin_percentage_fee?: number;
          best_round_processing_share?: number;
          calculation_version?: string;
          canonical_product_model_id?: string;
          commission_amount?: number;
          commission_rate_bps?: number;
          commission_vat?: number;
          condition_grade_snapshot?:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          condition_snapshot?: Database["public"]["Enums"]["product_condition"];
          config_version_id?: string;
          created_at?: string;
          currency?: string;
          declared_defects_snapshot?: Json;
          effective_partner_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id?: string | null;
          estimated_best_round_revenue?: number;
          estimated_partner_net?: number;
          estimated_processing?: boolean;
          fulfillment_id?: string;
          listing_id?: string;
          listing_title?: string;
          listing_version_id?: string;
          order_item_id?: string;
          other_configured_fees?: number;
          partner_id?: string;
          partner_processing_share?: number;
          partner_processing_share_bps?: number;
          payment_processing_bps?: number;
          payment_processing_fixed_fee?: number;
          pricing_quote_id?: string;
          processing_total?: number;
          public_line_total?: number;
          public_unit_price?: number;
          quantity?: number;
          score_snapshot_id?: string | null;
          specifications_snapshot?: Json;
          tier_source?: Database["public"]["Enums"]["marketplace_tier_source"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_order_item_snapshot_canonical_product_model_id_fkey";
            columns: ["canonical_product_model_id"];
            isOneToOne: false;
            referencedRelation: "catalog_product_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshot_effective_tier_override_id_fkey";
            columns: ["effective_tier_override_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_tier_overrides";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_pricing_quote_id_fkey";
            columns: ["pricing_quote_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_pricing_quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_order_item_snapshots_score_snapshot_id_fkey";
            columns: ["score_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_holds: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          partner_id: string;
          partner_visible: boolean;
          payable_id: string;
          placed_idempotency_key: string;
          reason: string;
          release_idempotency_key: string | null;
          release_reason: string | null;
          released_at: string | null;
          released_by: string | null;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          status: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          partner_id: string;
          partner_visible?: boolean;
          payable_id: string;
          placed_idempotency_key: string;
          reason: string;
          release_idempotency_key?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          status?: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          partner_id?: string;
          partner_visible?: boolean;
          payable_id?: string;
          placed_idempotency_key?: string;
          reason?: string;
          release_idempotency_key?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          source?: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          status?: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_holds_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_holds_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_holds_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_holds_released_by_fkey";
            columns: ["released_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_ledger_entries: {
        Row: {
          actor_id: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_cents: number;
          available_delta_cents: number;
          created_at: string;
          currency: string;
          entry_type: Database["public"]["Enums"]["marketplace_partner_ledger_entry_type"];
          fulfillment_id: string;
          id: string;
          idempotency_key: string;
          metadata: Json;
          on_hold_delta_cents: number;
          order_id: string;
          order_item_id: string;
          paid_delta_cents: number;
          partner_id: string;
          payable_id: string;
          pending_delta_cents: number;
          reason: string;
          reference_event_id: string | null;
          reversed_delta_cents: number;
        };
        Insert: {
          actor_id?: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_cents: number;
          available_delta_cents?: number;
          created_at?: string;
          currency?: string;
          entry_type: Database["public"]["Enums"]["marketplace_partner_ledger_entry_type"];
          fulfillment_id: string;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          on_hold_delta_cents?: number;
          order_id: string;
          order_item_id: string;
          paid_delta_cents?: number;
          partner_id: string;
          payable_id: string;
          pending_delta_cents?: number;
          reason: string;
          reference_event_id?: string | null;
          reversed_delta_cents?: number;
        };
        Update: {
          actor_id?: string | null;
          actor_source?: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_cents?: number;
          available_delta_cents?: number;
          created_at?: string;
          currency?: string;
          entry_type?: Database["public"]["Enums"]["marketplace_partner_ledger_entry_type"];
          fulfillment_id?: string;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          on_hold_delta_cents?: number;
          order_id?: string;
          order_item_id?: string;
          paid_delta_cents?: number;
          partner_id?: string;
          payable_id?: string;
          pending_delta_cents?: number;
          reason?: string;
          reference_event_id?: string | null;
          reversed_delta_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_ledger_entries_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_ledger_entries_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_ledger_entries_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_ledger_entries_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_ledger_entries_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_ledger_entries_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_notification_outbox: {
        Row: {
          body_text: string;
          channel: string;
          created_at: string;
          deduplication_key: string;
          event_type: string;
          id: string;
          recipient_email: string | null;
          recipient_user_id: string | null;
          sent_at: string | null;
          status: string;
          subject: string;
        };
        Insert: {
          body_text: string;
          channel: string;
          created_at?: string;
          deduplication_key: string;
          event_type: string;
          id?: string;
          recipient_email?: string | null;
          recipient_user_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subject: string;
        };
        Update: {
          body_text?: string;
          channel?: string;
          created_at?: string;
          deduplication_key?: string;
          event_type?: string;
          id?: string;
          recipient_email?: string | null;
          recipient_user_id?: string | null;
          sent_at?: string | null;
          status?: string;
          subject?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_notification_outbox_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payable_status_history: {
        Row: {
          actor_id: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_remaining_cents: number;
          created_at: string;
          from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible: boolean;
          payable_id: string;
          reason: string;
          to_status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
        };
        Insert: {
          actor_id?: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_remaining_cents: number;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id?: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible?: boolean;
          payable_id: string;
          reason: string;
          to_status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
        };
        Update: {
          actor_id?: string | null;
          actor_source?: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          amount_remaining_cents?: number;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id?: string;
          idempotency_key?: string;
          partner_id?: string;
          partner_visible?: boolean;
          payable_id?: string;
          reason?: string;
          to_status?: Database["public"]["Enums"]["marketplace_partner_payable_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payable_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payable_status_history_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payable_status_history_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payables: {
        Row: {
          created_at: string;
          currency: string;
          fulfillment_id: string;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          fulfillment_id: string;
          held_from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id?: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents?: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents?: number;
          status?: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at?: string;
          version?: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          fulfillment_id?: string;
          held_from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id?: string;
          order_id?: string;
          order_item_id?: string;
          original_amount_cents?: number;
          paid_amount_cents?: number;
          partner_id?: string;
          payment_id?: string;
          pricing_quote_id?: string;
          quantity?: number;
          reversed_amount_cents?: number;
          status?: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payables_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payables_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payables_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_order_item_snapshots";
            referencedColumns: ["order_item_id"];
          },
          {
            foreignKeyName: "marketplace_partner_payables_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payables_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "order_payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payables_pricing_quote_id_fkey";
            columns: ["pricing_quote_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_pricing_quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payout_events: {
        Row: {
          actor_id: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          created_at: string;
          event_type: Database["public"]["Enums"]["marketplace_partner_payout_event_type"];
          from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          metadata: Json;
          partner_id: string;
          partner_visible: boolean;
          payout_id: string;
          reason: string;
          reference_event_id: string | null;
          to_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          created_at?: string;
          event_type: Database["public"]["Enums"]["marketplace_partner_payout_event_type"];
          from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id?: string;
          idempotency_key: string;
          metadata?: Json;
          partner_id: string;
          partner_visible?: boolean;
          payout_id: string;
          reason: string;
          reference_event_id?: string | null;
          to_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
        };
        Update: {
          actor_id?: string | null;
          actor_source?: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          created_at?: string;
          event_type?: Database["public"]["Enums"]["marketplace_partner_payout_event_type"];
          from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id?: string;
          idempotency_key?: string;
          metadata?: Json;
          partner_id?: string;
          partner_visible?: boolean;
          payout_id?: string;
          reason?: string;
          reference_event_id?: string | null;
          to_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payout_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_events_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_events_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payouts";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payout_holds: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          partner_id: string;
          partner_visible: boolean;
          payout_id: string;
          placed_idempotency_key: string;
          reason: string;
          release_idempotency_key: string | null;
          release_reason: string | null;
          released_at: string | null;
          released_by: string | null;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          source_reference_key: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          partner_id: string;
          partner_visible?: boolean;
          payout_id: string;
          placed_idempotency_key: string;
          reason: string;
          release_idempotency_key?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          source_reference_key?: string | null;
          status?: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          partner_id?: string;
          partner_visible?: boolean;
          payout_id?: string;
          placed_idempotency_key?: string;
          reason?: string;
          release_idempotency_key?: string | null;
          release_reason?: string | null;
          released_at?: string | null;
          released_by?: string | null;
          source?: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          source_reference_key?: string | null;
          status?: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payout_holds_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_holds_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_holds_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_holds_released_by_fkey";
            columns: ["released_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payout_items: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          partner_id: string;
          payable_id: string;
          payout_id: string;
          released_at: string | null;
          settled_at: string | null;
          settlement_amount_cents: number;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          partner_id: string;
          payable_id: string;
          payout_id: string;
          released_at?: string | null;
          settled_at?: string | null;
          settlement_amount_cents: number;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          partner_id?: string;
          payable_id?: string;
          payout_id?: string;
          released_at?: string | null;
          settled_at?: string | null;
          settlement_amount_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payout_items_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_items_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payout_items_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payouts";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_payouts: {
        Row: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          batch_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          failed_at?: string | null;
          held_from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id?: string;
          idempotency_key: string;
          item_count?: number;
          paid_at?: string | null;
          partner_id: string;
          payout_reference: string;
          provider?: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at?: string | null;
          status?: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          batch_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          failed_at?: string | null;
          held_from_status?:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id?: string;
          idempotency_key?: string;
          item_count?: number;
          paid_at?: string | null;
          partner_id?: string;
          payout_reference?: string;
          provider?: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at?: string | null;
          status?: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_payouts_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_payout_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payouts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_payouts_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_release_authorizations: {
        Row: {
          actor_id: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          basis: Database["public"]["Enums"]["marketplace_partner_release_basis"];
          consumed_at: string | null;
          created_at: string;
          id: string;
          idempotency_key: string;
          partner_id: string;
          payable_id: string;
          reason: string;
          reference_event_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          actor_source: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          basis: Database["public"]["Enums"]["marketplace_partner_release_basis"];
          consumed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key: string;
          partner_id: string;
          payable_id: string;
          reason: string;
          reference_event_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_source?: Database["public"]["Enums"]["marketplace_partner_finance_actor_source"];
          basis?: Database["public"]["Enums"]["marketplace_partner_release_basis"];
          consumed_at?: string | null;
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          partner_id?: string;
          payable_id?: string;
          reason?: string;
          reference_event_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_release_authorizations_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_release_authorizations_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_release_authorizations_payable_id_fkey";
            columns: ["payable_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_partner_payables";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_partner_settlements: {
        Row: {
          amount_cents: number;
          bank_label: string;
          confirmation_idempotency_key: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          currency: string;
          external_reference: string;
          id: string;
          operations_note: string | null;
          partner_id: string;
          payout_id: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          record_idempotency_key: string;
          recorded_by: string;
          status: Database["public"]["Enums"]["marketplace_partner_settlement_status"];
          transfer_date: string;
        };
        Insert: {
          amount_cents: number;
          bank_label: string;
          confirmation_idempotency_key?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          currency?: string;
          external_reference: string;
          id?: string;
          operations_note?: string | null;
          partner_id: string;
          payout_id: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          record_idempotency_key: string;
          recorded_by: string;
          status?: Database["public"]["Enums"]["marketplace_partner_settlement_status"];
          transfer_date: string;
        };
        Update: {
          amount_cents?: number;
          bank_label?: string;
          confirmation_idempotency_key?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          currency?: string;
          external_reference?: string;
          id?: string;
          operations_note?: string | null;
          partner_id?: string;
          payout_id?: string;
          provider?: Database["public"]["Enums"]["marketplace_payout_provider"];
          record_idempotency_key?: string;
          recorded_by?: string;
          status?: Database["public"]["Enums"]["marketplace_partner_settlement_status"];
          transfer_date?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_partner_settlements_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_settlements_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_settlements_payout_id_fkey";
            columns: ["payout_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_partner_payouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_partner_settlements_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_payout_batches: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          execution_key: string;
          id: string;
          payout_count: number;
          period_end: string;
          period_start: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          status: Database["public"]["Enums"]["marketplace_payout_batch_status"];
          total_cents: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          execution_key: string;
          id?: string;
          payout_count?: number;
          period_end: string;
          period_start: string;
          provider?: Database["public"]["Enums"]["marketplace_payout_provider"];
          status?: Database["public"]["Enums"]["marketplace_payout_batch_status"];
          total_cents?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          execution_key?: string;
          id?: string;
          payout_count?: number;
          period_end?: string;
          period_start?: string;
          provider?: Database["public"]["Enums"]["marketplace_payout_provider"];
          status?: Database["public"]["Enums"]["marketplace_payout_batch_status"];
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_payout_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_payout_job_runs: {
        Row: {
          batch_id: string | null;
          calculation_date: string;
          completed_at: string | null;
          created_at: string;
          execution_key: string;
          id: string;
          payable_count: number;
          payout_count: number;
          status: string;
        };
        Insert: {
          batch_id?: string | null;
          calculation_date: string;
          completed_at?: string | null;
          created_at?: string;
          execution_key: string;
          id?: string;
          payable_count?: number;
          payout_count?: number;
          status?: string;
        };
        Update: {
          batch_id?: string | null;
          calculation_date?: string;
          completed_at?: string | null;
          created_at?: string;
          execution_key?: string;
          id?: string;
          payable_count?: number;
          payout_count?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_payout_job_runs_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_payout_batches";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_penalty_rules: {
        Row: {
          bypasses_downgrade_grace: boolean;
          config_version_id: string;
          decay_days: number | null;
          event_code: string;
          penalty_bps: number;
          requires_suspension_review: boolean;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
        };
        Insert: {
          bypasses_downgrade_grace?: boolean;
          config_version_id: string;
          decay_days?: number | null;
          event_code: string;
          penalty_bps: number;
          requires_suspension_review?: boolean;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
        };
        Update: {
          bypasses_downgrade_grace?: boolean;
          config_version_id?: string;
          decay_days?: number | null;
          event_code?: string;
          penalty_bps?: number;
          requires_suspension_review?: boolean;
          severity?: Database["public"]["Enums"]["partner_penalty_severity"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_penalty_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_pricing_quotes: {
        Row: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_fixed_fee_amount: number;
          admin_percentage_fee: number;
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          best_round_processing_share: number;
          calculated_public_price: number;
          calculation_version: string;
          canonical_product_model_id: string | null;
          commission_amount: number;
          commission_base: number;
          commission_rate_bps: number;
          commission_tax_bps: number;
          commission_vat: number;
          config_version_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          desired_partner_net: number | null;
          desired_public_price: number | null;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          expires_at: string;
          gross_best_round_revenue: number;
          id: string;
          idempotency_key: string;
          input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id: string;
          listing_version_id: string;
          lock_version: number;
          market_analysis_id: string | null;
          market_analysis_override: boolean;
          market_analysis_override_at: string | null;
          market_analysis_override_by: string | null;
          market_analysis_override_email: string | null;
          market_analysis_override_reason: string | null;
          market_delta_bps: number | null;
          market_lower_bound: number | null;
          market_reference: number | null;
          market_tolerance_bps: number;
          market_upper_bound: number | null;
          meets_minimum_marketplace_revenue: boolean | null;
          minimum_marketplace_revenue: number | null;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_fee_config_code: string;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          processing_total: number;
          quote_version: number;
          score_snapshot_id: string | null;
          status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at: string | null;
          tax_pass_through: number;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at: string;
          viability: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        Insert: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_fixed_fee_amount: number;
          admin_percentage_fee: number;
          approval_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          best_round_processing_share: number;
          calculated_public_price: number;
          calculation_version?: string;
          canonical_product_model_id?: string | null;
          commission_amount: number;
          commission_base: number;
          commission_rate_bps: number;
          commission_tax_bps: number;
          commission_vat: number;
          config_version_id: string;
          created_at?: string;
          created_by: string;
          currency?: string;
          desired_partner_net?: number | null;
          desired_public_price?: number | null;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id?: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          expires_at: string;
          gross_best_round_revenue: number;
          id?: string;
          idempotency_key: string;
          input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id: string;
          listing_version_id: string;
          lock_version?: number;
          market_analysis_id?: string | null;
          market_analysis_override?: boolean;
          market_analysis_override_at?: string | null;
          market_analysis_override_by?: string | null;
          market_analysis_override_email?: string | null;
          market_analysis_override_reason?: string | null;
          market_delta_bps?: number | null;
          market_lower_bound?: number | null;
          market_reference?: number | null;
          market_tolerance_bps: number;
          market_upper_bound?: number | null;
          meets_minimum_marketplace_revenue?: boolean | null;
          minimum_marketplace_revenue?: number | null;
          other_configured_fees?: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_fee_config_code: string;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          processing_total: number;
          quote_version: number;
          score_snapshot_id?: string | null;
          status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at?: string | null;
          tax_pass_through: number;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at?: string;
          viability: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        Update: {
          admin_fee_bps?: number;
          admin_fixed_fee?: number;
          admin_fixed_fee_amount?: number;
          admin_percentage_fee?: number;
          approval_reason?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          best_round_processing_share?: number;
          calculated_public_price?: number;
          calculation_version?: string;
          canonical_product_model_id?: string | null;
          commission_amount?: number;
          commission_base?: number;
          commission_rate_bps?: number;
          commission_tax_bps?: number;
          commission_vat?: number;
          config_version_id?: string;
          created_at?: string;
          created_by?: string;
          currency?: string;
          desired_partner_net?: number | null;
          desired_public_price?: number | null;
          effective_partner_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id?: string | null;
          estimated_best_round_revenue?: number;
          estimated_partner_net?: number;
          expires_at?: string;
          gross_best_round_revenue?: number;
          id?: string;
          idempotency_key?: string;
          input_mode?: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id?: string;
          listing_version_id?: string;
          lock_version?: number;
          market_analysis_id?: string | null;
          market_analysis_override?: boolean;
          market_analysis_override_at?: string | null;
          market_analysis_override_by?: string | null;
          market_analysis_override_email?: string | null;
          market_analysis_override_reason?: string | null;
          market_delta_bps?: number | null;
          market_lower_bound?: number | null;
          market_reference?: number | null;
          market_tolerance_bps?: number;
          market_upper_bound?: number | null;
          meets_minimum_marketplace_revenue?: boolean | null;
          minimum_marketplace_revenue?: number | null;
          other_configured_fees?: number;
          partner_id?: string;
          partner_processing_share?: number;
          partner_processing_share_bps?: number;
          payment_fee_config_code?: string;
          payment_processing_bps?: number;
          payment_processing_fixed_fee?: number;
          processing_total?: number;
          quote_version?: number;
          score_snapshot_id?: string | null;
          status?: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at?: string | null;
          tax_pass_through?: number;
          tier_source?: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at?: string;
          viability?: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_pricing_quote_listing_version_fk";
            columns: ["listing_id", "listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["listing_id", "id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_canonical_product_model_id_fkey";
            columns: ["canonical_product_model_id"];
            isOneToOne: false;
            referencedRelation: "catalog_product_models";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_effective_tier_override_id_fkey";
            columns: ["effective_tier_override_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_tier_overrides";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_listing_id_fkey";
            columns: ["listing_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_listing_version_id_fkey";
            columns: ["listing_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_listing_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_market_analysis_id_fkey";
            columns: ["market_analysis_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_market_analyses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_market_analysis_override_by_fkey";
            columns: ["market_analysis_override_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_payment_fee_config_code_fkey";
            columns: ["payment_fee_config_code"];
            isOneToOne: false;
            referencedRelation: "payment_fee_configs";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "marketplace_pricing_quotes_score_snapshot_id_fkey";
            columns: ["score_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_pricing_rules: {
        Row: {
          config_version_id: string;
          market_tolerance_bps: number;
          payment_fee_config_code: string;
          quote_expiry_days: number;
          required_confidence_for_approval: Database["public"]["Enums"]["marketplace_market_confidence"];
          research_freshness_hours: number;
        };
        Insert: {
          config_version_id: string;
          market_tolerance_bps?: number;
          payment_fee_config_code: string;
          quote_expiry_days?: number;
          required_confidence_for_approval?: Database["public"]["Enums"]["marketplace_market_confidence"];
          research_freshness_hours?: number;
        };
        Update: {
          config_version_id?: string;
          market_tolerance_bps?: number;
          payment_fee_config_code?: string;
          quote_expiry_days?: number;
          required_confidence_for_approval?: Database["public"]["Enums"]["marketplace_market_confidence"];
          research_freshness_hours?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_pricing_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_rules_payment_fee_config_code_fkey";
            columns: ["payment_fee_config_code"];
            isOneToOne: false;
            referencedRelation: "payment_fee_configs";
            referencedColumns: ["code"];
          },
        ];
      };
      marketplace_pricing_status_history: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status:
            | Database["public"]["Enums"]["marketplace_pricing_quote_status"]
            | null;
          id: string;
          lock_version: number;
          quote_id: string;
          reason: string | null;
          to_status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_pricing_quote_status"]
            | null;
          id?: string;
          lock_version: number;
          quote_id: string;
          reason?: string | null;
          to_status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            | Database["public"]["Enums"]["marketplace_pricing_quote_status"]
            | null;
          id?: string;
          lock_version?: number;
          quote_id?: string;
          reason?: string | null;
          to_status?: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_pricing_status_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_pricing_status_history_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_pricing_quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_return_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          from_status:
            Database["public"]["Enums"]["marketplace_return_status"] | null;
          id: string;
          idempotency_key: string;
          reason: string;
          return_id: string;
          to_status: Database["public"]["Enums"]["marketplace_return_status"];
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_return_status"] | null;
          id?: string;
          idempotency_key: string;
          reason: string;
          return_id: string;
          to_status: Database["public"]["Enums"]["marketplace_return_status"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["marketplace_return_status"] | null;
          id?: string;
          idempotency_key?: string;
          reason?: string;
          return_id?: string;
          to_status?: Database["public"]["Enums"]["marketplace_return_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_return_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_return_events_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_returns";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_returns: {
        Row: {
          carrier: string | null;
          claim_id: string;
          created_at: string;
          fulfillment_id: string;
          id: string;
          inspection_result: string | null;
          label_status: string;
          order_item_id: string;
          quantity: number;
          received_at: string | null;
          shipped_at: string | null;
          shipping_responsibility: Database["public"]["Enums"]["marketplace_return_shipping_responsibility"];
          status: Database["public"]["Enums"]["marketplace_return_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          carrier?: string | null;
          claim_id: string;
          created_at?: string;
          fulfillment_id: string;
          id?: string;
          inspection_result?: string | null;
          label_status?: string;
          order_item_id: string;
          quantity: number;
          received_at?: string | null;
          shipped_at?: string | null;
          shipping_responsibility: Database["public"]["Enums"]["marketplace_return_shipping_responsibility"];
          status?: Database["public"]["Enums"]["marketplace_return_status"];
          tracking_number?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          carrier?: string | null;
          claim_id?: string;
          created_at?: string;
          fulfillment_id?: string;
          id?: string;
          inspection_result?: string | null;
          label_status?: string;
          order_item_id?: string;
          quantity?: number;
          received_at?: string | null;
          shipped_at?: string | null;
          shipping_responsibility?: Database["public"]["Enums"]["marketplace_return_shipping_responsibility"];
          status?: Database["public"]["Enums"]["marketplace_return_status"];
          tracking_number?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_returns_claim_id_fkey";
            columns: ["claim_id"];
            isOneToOne: true;
            referencedRelation: "marketplace_claims";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_returns_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_returns_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_score_job_runs: {
        Row: {
          actor_id: string | null;
          as_of_date: string;
          completed_at: string | null;
          id: string;
          job_key: string;
          processed_partners: number;
          reason: string;
          requested_partner_id: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["marketplace_score_job_status"];
        };
        Insert: {
          actor_id?: string | null;
          as_of_date: string;
          completed_at?: string | null;
          id?: string;
          job_key: string;
          processed_partners?: number;
          reason: string;
          requested_partner_id?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["marketplace_score_job_status"];
        };
        Update: {
          actor_id?: string | null;
          as_of_date?: string;
          completed_at?: string | null;
          id?: string;
          job_key?: string;
          processed_partners?: number;
          reason?: string;
          requested_partner_id?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["marketplace_score_job_status"];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_score_job_runs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marketplace_score_job_runs_requested_partner_id_fkey";
            columns: ["requested_partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_score_outcome_rules: {
        Row: {
          component: Database["public"]["Enums"]["partner_score_component"];
          config_version_id: string;
          counts_completed_order: boolean;
          outcome_code: string;
          score_bps: number;
        };
        Insert: {
          component: Database["public"]["Enums"]["partner_score_component"];
          config_version_id: string;
          counts_completed_order?: boolean;
          outcome_code: string;
          score_bps: number;
        };
        Update: {
          component?: Database["public"]["Enums"]["partner_score_component"];
          config_version_id?: string;
          counts_completed_order?: boolean;
          outcome_code?: string;
          score_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_score_outcome_rules_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      marketplace_score_rules: {
        Row: {
          config_version_id: string;
          documentation_weight_bps: number;
          downgrade_grace_days: number;
          established_completed_orders: number;
          neutral_score_bps: number;
          prior_observations: number;
          prior_success_equivalent: number;
          promotion_stability_days: number;
          provisional_tier_cap: Database["public"]["Enums"]["marketplace_partner_tier"];
          public_rating_min_reviews: number;
          shipping_carrier_handoff_weight_bps: number;
          shipping_inventory_confirmation_weight_bps: number;
          tenure_weight_bps: number;
          tier_eligible_listing_statuses: Database["public"]["Enums"]["marketplace_listing_status"][];
        };
        Insert: {
          config_version_id: string;
          documentation_weight_bps: number;
          downgrade_grace_days: number;
          established_completed_orders: number;
          neutral_score_bps: number;
          prior_observations: number;
          prior_success_equivalent: number;
          promotion_stability_days: number;
          provisional_tier_cap: Database["public"]["Enums"]["marketplace_partner_tier"];
          public_rating_min_reviews: number;
          shipping_carrier_handoff_weight_bps: number;
          shipping_inventory_confirmation_weight_bps: number;
          tenure_weight_bps: number;
          tier_eligible_listing_statuses: Database["public"]["Enums"]["marketplace_listing_status"][];
        };
        Update: {
          config_version_id?: string;
          documentation_weight_bps?: number;
          downgrade_grace_days?: number;
          established_completed_orders?: number;
          neutral_score_bps?: number;
          prior_observations?: number;
          prior_success_equivalent?: number;
          promotion_stability_days?: number;
          provisional_tier_cap?: Database["public"]["Enums"]["marketplace_partner_tier"];
          public_rating_min_reviews?: number;
          shipping_carrier_handoff_weight_bps?: number;
          shipping_inventory_confirmation_weight_bps?: number;
          tenure_weight_bps?: number;
          tier_eligible_listing_statuses?: Database["public"]["Enums"]["marketplace_listing_status"][];
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_score_rules_config_version_id_fkey";
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
      marketplace_tenure_score_rules: {
        Row: {
          config_version_id: string;
          maximum_days: number | null;
          minimum_days: number;
          score_bps: number;
        };
        Insert: {
          config_version_id: string;
          maximum_days?: number | null;
          minimum_days: number;
          score_bps: number;
        };
        Update: {
          config_version_id?: string;
          maximum_days?: number | null;
          minimum_days?: number;
          score_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "marketplace_tenure_score_rules_config_version_id_fkey";
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
      order_fulfillments: {
        Row: {
          acceptance_due_at: string | null;
          activated_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          carrier: string | null;
          carrier_handoff_actor_id: string | null;
          carrier_handoff_due_at: string | null;
          carrier_handoff_note: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          custody:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at: string | null;
          fulfillment_mode:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason: string | null;
          id: string;
          inventory_confirmation_due_at: string | null;
          label_status: string | null;
          order_id: string;
          partner_id: string | null;
          ready_for_carrier_at: string | null;
          shipped_at: string | null;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          acceptance_due_at?: string | null;
          activated_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          carrier?: string | null;
          carrier_handoff_actor_id?: string | null;
          carrier_handoff_due_at?: string | null;
          carrier_handoff_note?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          custody?:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at?: string | null;
          fulfillment_mode?:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason?: string | null;
          id?: string;
          inventory_confirmation_due_at?: string | null;
          label_status?: string | null;
          order_id: string;
          partner_id?: string | null;
          ready_for_carrier_at?: string | null;
          shipped_at?: string | null;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status?: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          acceptance_due_at?: string | null;
          activated_at?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          carrier?: string | null;
          carrier_handoff_actor_id?: string | null;
          carrier_handoff_due_at?: string | null;
          carrier_handoff_note?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          custody?:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at?: string | null;
          fulfillment_mode?:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason?: string | null;
          id?: string;
          inventory_confirmation_due_at?: string | null;
          label_status?: string | null;
          order_id?: string;
          partner_id?: string | null;
          ready_for_carrier_at?: string | null;
          shipped_at?: string | null;
          source?: Database["public"]["Enums"]["order_fulfillment_source"];
          status?: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_fulfillments_carrier_handoff_actor_id_fkey";
            columns: ["carrier_handoff_actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_fulfillments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_fulfillments_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
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
          fulfillment_id: string | null;
          id: string;
          item_source: Database["public"]["Enums"]["order_item_source"];
          line_total: number;
          order_id: string;
          product_id: string | null;
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
          fulfillment_id?: string | null;
          id?: string;
          item_source?: Database["public"]["Enums"]["order_item_source"];
          line_total: number;
          order_id: string;
          product_id?: string | null;
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
          fulfillment_id?: string | null;
          id?: string;
          item_source?: Database["public"]["Enums"]["order_item_source"];
          line_total?: number;
          order_id?: string;
          product_id?: string | null;
          product_name_snapshot?: string;
          quantity?: number;
          sku_snapshot?: string;
          unit_price_snapshot?: number;
          variant_id?: string | null;
          variant_name_snapshot?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_fulfillment_id_fkey";
            columns: ["fulfillment_id"];
            isOneToOne: false;
            referencedRelation: "order_fulfillments";
            referencedColumns: ["id"];
          },
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
          marketplace_exception_status: Database["public"]["Enums"]["marketplace_order_exception_status"];
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
          marketplace_exception_status?: Database["public"]["Enums"]["marketplace_order_exception_status"];
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
          marketplace_exception_status?: Database["public"]["Enums"]["marketplace_order_exception_status"];
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
      partner_daily_listing_metrics: {
        Row: {
          active_listing_count: number;
          calculated_at: string;
          config_version_id: string;
          eligibility_started_at: string | null;
          eligible: boolean;
          metric_date: string;
          partner_id: string;
        };
        Insert: {
          active_listing_count: number;
          calculated_at?: string;
          config_version_id: string;
          eligibility_started_at?: string | null;
          eligible: boolean;
          metric_date: string;
          partner_id: string;
        };
        Update: {
          active_listing_count?: number;
          calculated_at?: string;
          config_version_id?: string;
          eligibility_started_at?: string | null;
          eligible?: boolean;
          metric_date?: string;
          partner_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_daily_listing_metrics_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_daily_listing_metrics_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_document_analyses: {
        Row: {
          analysis_version: string;
          analyzed_at: string;
          analyzed_by: string | null;
          document_id: string;
          extracted_address: string | null;
          extracted_document_date: string | null;
          extracted_document_type: string | null;
          extracted_name: string | null;
          extracted_rfc: string | null;
          id: string;
          normalized_output: Json;
          official_qr_destination: string | null;
          result: Database["public"]["Enums"]["automatic_document_review_result"];
          warning_codes: string[];
        };
        Insert: {
          analysis_version: string;
          analyzed_at?: string;
          analyzed_by?: string | null;
          document_id: string;
          extracted_address?: string | null;
          extracted_document_date?: string | null;
          extracted_document_type?: string | null;
          extracted_name?: string | null;
          extracted_rfc?: string | null;
          id?: string;
          normalized_output?: Json;
          official_qr_destination?: string | null;
          result: Database["public"]["Enums"]["automatic_document_review_result"];
          warning_codes?: string[];
        };
        Update: {
          analysis_version?: string;
          analyzed_at?: string;
          analyzed_by?: string | null;
          document_id?: string;
          extracted_address?: string | null;
          extracted_document_date?: string | null;
          extracted_document_type?: string | null;
          extracted_name?: string | null;
          extracted_rfc?: string | null;
          id?: string;
          normalized_output?: Json;
          official_qr_destination?: string | null;
          result?: Database["public"]["Enums"]["automatic_document_review_result"];
          warning_codes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "partner_document_analyses_analyzed_by_fkey";
            columns: ["analyzed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_document_analyses_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "partner_documents";
            referencedColumns: ["id"];
          },
        ];
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
          version: number;
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
          version?: number;
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
          version?: number;
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
      partner_identity_verifications: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          external_session_id: string;
          face_match_passed: boolean | null;
          id: string;
          liveness_passed: boolean | null;
          normalized_attributes: Json;
          partner_id: string;
          provider: string;
          result: Database["public"]["Enums"]["identity_verification_result"];
          session_kind: string;
          updated_at: string;
          warning_codes: string[];
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          external_session_id: string;
          face_match_passed?: boolean | null;
          id?: string;
          liveness_passed?: boolean | null;
          normalized_attributes?: Json;
          partner_id: string;
          provider: string;
          result?: Database["public"]["Enums"]["identity_verification_result"];
          session_kind: string;
          updated_at?: string;
          warning_codes?: string[];
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          external_session_id?: string;
          face_match_passed?: boolean | null;
          id?: string;
          liveness_passed?: boolean | null;
          normalized_attributes?: Json;
          partner_id?: string;
          provider?: string;
          result?: Database["public"]["Enums"]["identity_verification_result"];
          session_kind?: string;
          updated_at?: string;
          warning_codes?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "partner_identity_verifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_identity_verifications_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_identity_webhook_events: {
        Row: {
          event_id: string;
          external_session_id: string;
          occurred_at: string;
          payload_sha256: string;
          processed_at: string;
          provider: string;
          result: Database["public"]["Enums"]["identity_verification_result"];
          verification_id: string;
        };
        Insert: {
          event_id: string;
          external_session_id: string;
          occurred_at: string;
          payload_sha256: string;
          processed_at?: string;
          provider: string;
          result: Database["public"]["Enums"]["identity_verification_result"];
          verification_id: string;
        };
        Update: {
          event_id?: string;
          external_session_id?: string;
          occurred_at?: string;
          payload_sha256?: string;
          processed_at?: string;
          provider?: string;
          result?: Database["public"]["Enums"]["identity_verification_result"];
          verification_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_identity_webhook_events_verification_id_fkey";
            columns: ["verification_id"];
            isOneToOne: false;
            referencedRelation: "partner_identity_verifications";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_penalties: {
        Row: {
          clearance_reason: string | null;
          cleared_at: string | null;
          cleared_by: string | null;
          config_version_id: string;
          created_at: string;
          created_by: string | null;
          event_code: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible: boolean;
          penalty_bps: number;
          reason: string;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
          source_event_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_penalty_status"];
          updated_at: string;
        };
        Insert: {
          clearance_reason?: string | null;
          cleared_at?: string | null;
          cleared_by?: string | null;
          config_version_id: string;
          created_at?: string;
          created_by?: string | null;
          event_code: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible?: boolean;
          penalty_bps: number;
          reason: string;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
          source_event_id?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["partner_penalty_status"];
          updated_at?: string;
        };
        Update: {
          clearance_reason?: string | null;
          cleared_at?: string | null;
          cleared_by?: string | null;
          config_version_id?: string;
          created_at?: string;
          created_by?: string | null;
          event_code?: string;
          expires_at?: string | null;
          id?: string;
          idempotency_key?: string;
          partner_id?: string;
          partner_visible?: boolean;
          penalty_bps?: number;
          reason?: string;
          severity?: Database["public"]["Enums"]["partner_penalty_severity"];
          source_event_id?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["partner_penalty_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_penalties_cleared_by_fkey";
            columns: ["cleared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_penalties_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_penalties_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_penalties_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_penalties_source_event_id_fkey";
            columns: ["source_event_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_events";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_profiles: {
        Row: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
          updated_at: string;
          user_id: string;
          verified_at: string | null;
          version: number;
        };
        Insert: {
          city?: string | null;
          commercial_name?: string | null;
          country_code?: string | null;
          created_at?: string;
          first_name?: string | null;
          fiscal_address_line_1?: string | null;
          fiscal_address_line_2?: string | null;
          fiscal_city?: string | null;
          fiscal_postal_code?: string | null;
          fiscal_state?: string | null;
          id?: string;
          last_name?: string | null;
          legal_name?: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step?: number;
          phone?: string | null;
          privacy_accepted_at?: string | null;
          rejected_at?: string | null;
          representative_name?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          submitted_at?: string | null;
          suspended_at?: string | null;
          tax_id?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          user_id: string;
          verified_at?: string | null;
          version?: number;
        };
        Update: {
          city?: string | null;
          commercial_name?: string | null;
          country_code?: string | null;
          created_at?: string;
          first_name?: string | null;
          fiscal_address_line_1?: string | null;
          fiscal_address_line_2?: string | null;
          fiscal_city?: string | null;
          fiscal_postal_code?: string | null;
          fiscal_state?: string | null;
          id?: string;
          last_name?: string | null;
          legal_name?: string | null;
          legal_type?: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step?: number;
          phone?: string | null;
          privacy_accepted_at?: string | null;
          rejected_at?: string | null;
          representative_name?: string | null;
          state?: string | null;
          status?: Database["public"]["Enums"]["partner_status"];
          submitted_at?: string | null;
          suspended_at?: string | null;
          tax_id?: string | null;
          terms_accepted_at?: string | null;
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
      partner_ratings: {
        Row: {
          created_at: string;
          delivery_experience: number;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          overall_experience: number;
          partner_id: string;
          product_as_described: number;
          recorded_by: string | null;
          source_entity_id: string;
          source_entity_type: string;
        };
        Insert: {
          created_at?: string;
          delivery_experience: number;
          id?: string;
          idempotency_key: string;
          occurred_at: string;
          overall_experience: number;
          partner_id: string;
          product_as_described: number;
          recorded_by?: string | null;
          source_entity_id: string;
          source_entity_type: string;
        };
        Update: {
          created_at?: string;
          delivery_experience?: number;
          id?: string;
          idempotency_key?: string;
          occurred_at?: string;
          overall_experience?: number;
          partner_id?: string;
          product_as_described?: number;
          recorded_by?: string | null;
          source_entity_id?: string;
          source_entity_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_ratings_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_ratings_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_risk_flags: {
        Row: {
          created_at: string;
          flag_code: string;
          id: string;
          partner_id: string;
          penalty_id: string;
          reason: string;
          resolution_reason: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["partner_risk_flag_status"];
        };
        Insert: {
          created_at?: string;
          flag_code: string;
          id?: string;
          partner_id: string;
          penalty_id: string;
          reason: string;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["partner_risk_flag_status"];
        };
        Update: {
          created_at?: string;
          flag_code?: string;
          id?: string;
          partner_id?: string;
          penalty_id?: string;
          reason?: string;
          resolution_reason?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["partner_risk_flag_status"];
        };
        Relationships: [
          {
            foreignKeyName: "partner_risk_flags_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_risk_flags_penalty_id_fkey";
            columns: ["penalty_id"];
            isOneToOne: true;
            referencedRelation: "partner_penalties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_risk_flags_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_score_component_snapshots: {
        Row: {
          adjusted_score_bps: number;
          component: Database["public"]["Enums"]["partner_score_component"];
          evidence_summary: Json;
          numerator_score_bps: number;
          observation_count: number;
          score_snapshot_id: string;
          weight_bps: number;
          weighted_contribution_bps: number;
        };
        Insert: {
          adjusted_score_bps: number;
          component: Database["public"]["Enums"]["partner_score_component"];
          evidence_summary?: Json;
          numerator_score_bps: number;
          observation_count: number;
          score_snapshot_id: string;
          weight_bps: number;
          weighted_contribution_bps: number;
        };
        Update: {
          adjusted_score_bps?: number;
          component?: Database["public"]["Enums"]["partner_score_component"];
          evidence_summary?: Json;
          numerator_score_bps?: number;
          observation_count?: number;
          score_snapshot_id?: string;
          weight_bps?: number;
          weighted_contribution_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_score_component_snapshots_score_snapshot_id_fkey";
            columns: ["score_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_snapshots";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_score_events: {
        Row: {
          component: Database["public"]["Enums"]["partner_score_component"];
          counts_completed_order: boolean;
          created_at: string;
          evidence: Json;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          outcome_code: string;
          partner_id: string;
          recorded_by: string | null;
          score_bps: number;
          source: Database["public"]["Enums"]["partner_score_event_source"];
          source_entity_id: string | null;
          source_entity_type: string | null;
        };
        Insert: {
          component: Database["public"]["Enums"]["partner_score_component"];
          counts_completed_order?: boolean;
          created_at?: string;
          evidence?: Json;
          id?: string;
          idempotency_key: string;
          occurred_at: string;
          outcome_code: string;
          partner_id: string;
          recorded_by?: string | null;
          score_bps: number;
          source: Database["public"]["Enums"]["partner_score_event_source"];
          source_entity_id?: string | null;
          source_entity_type?: string | null;
        };
        Update: {
          component?: Database["public"]["Enums"]["partner_score_component"];
          counts_completed_order?: boolean;
          created_at?: string;
          evidence?: Json;
          id?: string;
          idempotency_key?: string;
          occurred_at?: string;
          outcome_code?: string;
          partner_id?: string;
          recorded_by?: string | null;
          score_bps?: number;
          source?: Database["public"]["Enums"]["partner_score_event_source"];
          source_entity_id?: string | null;
          source_entity_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_score_events_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_events_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_score_snapshots: {
        Row: {
          active_penalties_bps: number;
          applied_override_id: string | null;
          calculated_at: string;
          calculated_score_bps: number;
          calculation_key: string;
          completed_orders: number;
          config_version_id: string;
          final_score_bps: number;
          id: string;
          partner_id: string;
          raw_weighted_score_bps: number;
          score_status: Database["public"]["Enums"]["partner_score_status"];
        };
        Insert: {
          active_penalties_bps: number;
          applied_override_id?: string | null;
          calculated_at: string;
          calculated_score_bps: number;
          calculation_key: string;
          completed_orders: number;
          config_version_id: string;
          final_score_bps: number;
          id?: string;
          partner_id: string;
          raw_weighted_score_bps: number;
          score_status: Database["public"]["Enums"]["partner_score_status"];
        };
        Update: {
          active_penalties_bps?: number;
          applied_override_id?: string | null;
          calculated_at?: string;
          calculated_score_bps?: number;
          calculation_key?: string;
          completed_orders?: number;
          config_version_id?: string;
          final_score_bps?: number;
          id?: string;
          partner_id?: string;
          raw_weighted_score_bps?: number;
          score_status?: Database["public"]["Enums"]["partner_score_status"];
        };
        Relationships: [
          {
            foreignKeyName: "partner_score_snapshots_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_snapshots_override_fk";
            columns: ["applied_override_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_tier_overrides";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_snapshots_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_score_tier_overrides: {
        Row: {
          cleared_at: string | null;
          cleared_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          override_type: Database["public"]["Enums"]["partner_override_type"];
          partner_id: string;
          reason: string;
          score_bps: number | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_override_status"];
          tier: Database["public"]["Enums"]["marketplace_partner_tier"] | null;
        };
        Insert: {
          cleared_at?: string | null;
          cleared_by?: string | null;
          created_at?: string;
          created_by: string;
          expires_at?: string | null;
          id?: string;
          override_type: Database["public"]["Enums"]["partner_override_type"];
          partner_id: string;
          reason: string;
          score_bps?: number | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["partner_override_status"];
          tier?: Database["public"]["Enums"]["marketplace_partner_tier"] | null;
        };
        Update: {
          cleared_at?: string | null;
          cleared_by?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string | null;
          id?: string;
          override_type?: Database["public"]["Enums"]["partner_override_type"];
          partner_id?: string;
          reason?: string;
          score_bps?: number | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["partner_override_status"];
          tier?: Database["public"]["Enums"]["marketplace_partner_tier"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_score_tier_overrides_cleared_by_fkey";
            columns: ["cleared_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_tier_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_tier_overrides_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_score_tier_state: {
        Row: {
          calculated_at: string | null;
          current_config_version_id: string | null;
          current_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          highest_eligible_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          latest_score_snapshot_id: string | null;
          partner_id: string;
          promotion_candidate_tier:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          promotion_eligible_since: string | null;
          rolling_average_active_listings: number;
          tier_at_risk_since: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          calculated_at?: string | null;
          current_config_version_id?: string | null;
          current_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          highest_eligible_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          latest_score_snapshot_id?: string | null;
          partner_id: string;
          promotion_candidate_tier?:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          promotion_eligible_since?: string | null;
          rolling_average_active_listings?: number;
          tier_at_risk_since?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          calculated_at?: string | null;
          current_config_version_id?: string | null;
          current_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          highest_eligible_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          latest_score_snapshot_id?: string | null;
          partner_id?: string;
          promotion_candidate_tier?:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          promotion_eligible_since?: string | null;
          rolling_average_active_listings?: number;
          tier_at_risk_since?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "partner_score_tier_state_current_config_version_id_fkey";
            columns: ["current_config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_tier_state_latest_score_snapshot_id_fkey";
            columns: ["latest_score_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_score_tier_state_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: true;
            referencedRelation: "partner_profiles";
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
      partner_tier_history: {
        Row: {
          actor_id: string | null;
          config_version_id: string;
          effective_at: string;
          id: string;
          new_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          old_tier:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          partner_id: string;
          reason: string;
          rolling_average_active_listings: number;
          score_snapshot_id: string | null;
        };
        Insert: {
          actor_id?: string | null;
          config_version_id: string;
          effective_at?: string;
          id?: string;
          new_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          old_tier?:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          partner_id: string;
          reason: string;
          rolling_average_active_listings: number;
          score_snapshot_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          config_version_id?: string;
          effective_at?: string;
          id?: string;
          new_tier?: Database["public"]["Enums"]["marketplace_partner_tier"];
          old_tier?:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          partner_id?: string;
          reason?: string;
          rolling_average_active_listings?: number;
          score_snapshot_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_tier_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_tier_history_config_version_id_fkey";
            columns: ["config_version_id"];
            isOneToOne: false;
            referencedRelation: "marketplace_config_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_tier_history_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_tier_history_score_snapshot_id_fkey";
            columns: ["score_snapshot_id"];
            isOneToOne: false;
            referencedRelation: "partner_score_snapshots";
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
      accept_marketplace_delivery: {
        Args: {
          requested_fulfillment_id: string;
          requested_idempotency_key: string;
        };
        Returns: {
          acceptance_deadline: string;
          acceptance_window_hours: number;
          accepted_at: string | null;
          actor_id: string | null;
          buyer_id: string;
          claim_opened_at: string | null;
          config_version_id: string;
          created_at: string;
          delivered_at: string;
          finalized_at: string | null;
          fulfillment_id: string;
          id: string;
          idempotency_key: string | null;
          order_id: string;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_acceptance_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_delivery_acceptances";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
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
      add_marketplace_cart_item: {
        Args: {
          requested_idempotency_key: string;
          requested_listing_id: string;
          requested_pricing_quote_id: string;
          requested_quantity: number;
        };
        Returns: {
          cart_id: string;
          cart_item_id: string;
          quantity: number;
          replayed: boolean;
          version: number;
        }[];
      };
      add_marketplace_partner_payout_item: {
        Args: {
          requested_idempotency_key: string;
          requested_payable_id: string;
          requested_payout_id: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          id: string;
          partner_id: string;
          payable_id: string;
          payout_id: string;
          released_at: string | null;
          settled_at: string | null;
          settlement_amount_cents: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payout_items";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      archive_marketplace_listing: {
        Args: {
          expected_lock_version: number;
          requested_listing_id: string;
          requested_reason: string;
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      can_manage_marketplace_claims: { Args: never; Returns: boolean };
      can_manage_marketplace_configuration: { Args: never; Returns: boolean };
      can_manage_marketplace_listings: { Args: never; Returns: boolean };
      can_manage_marketplace_orders: { Args: never; Returns: boolean };
      can_manage_marketplace_partners: { Args: never; Returns: boolean };
      can_manage_marketplace_payables: { Args: never; Returns: boolean };
      can_manage_marketplace_payouts: { Args: never; Returns: boolean };
      can_manage_marketplace_pricing: { Args: never; Returns: boolean };
      can_manage_marketplace_score_tiers: { Args: never; Returns: boolean };
      can_manage_orders: { Args: never; Returns: boolean };
      can_override_marketplace_score_tiers: { Args: never; Returns: boolean };
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
      cancel_marketplace_partner_payout: {
        Args: {
          requested_idempotency_key: string;
          requested_payout_id: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      clear_partner_penalty: {
        Args: { requested_penalty_id: string; requested_reason: string };
        Returns: {
          clearance_reason: string | null;
          cleared_at: string | null;
          cleared_by: string | null;
          config_version_id: string;
          created_at: string;
          created_by: string | null;
          event_code: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible: boolean;
          penalty_bps: number;
          reason: string;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
          source_event_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_penalty_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "partner_penalties";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      clear_partner_score_tier_override: {
        Args: { requested_override_id: string; requested_reason: string };
        Returns: {
          cleared_at: string | null;
          cleared_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          override_type: Database["public"]["Enums"]["partner_override_type"];
          partner_id: string;
          reason: string;
          score_bps: number | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_override_status"];
          tier: Database["public"]["Enums"]["marketplace_partner_tier"] | null;
        };
        SetofOptions: {
          from: "*";
          to: "partner_score_tier_overrides";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      complete_marketplace_market_analysis: {
        Args: {
          requested_analysis_id: string;
          requested_comparables: Json;
          requested_excluded_count: number;
          requested_input_fingerprint: string;
          requested_input_snapshot: Json;
          requested_provider: string;
          requested_provider_status: string;
          requested_result_snapshot: Json;
        };
        Returns: {
          analysis_version: string;
          average_price: number | null;
          canonical_product_model_id: string | null;
          checked_at: string | null;
          completed_by: string | null;
          confidence: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at: string;
          excluded_comparable_count: number;
          expires_at: string | null;
          flags: Json;
          high_market: number | null;
          id: string;
          idempotency_key: string;
          input_fingerprint: string | null;
          input_snapshot: Json;
          listing_id: string;
          listing_version_id: string;
          low_market: number | null;
          median_price: number | null;
          partner_id: string;
          provider: string | null;
          provider_status: string | null;
          recommended_price: number | null;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          source: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_market_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      confirm_marketplace_payout_settlement: {
        Args: {
          requested_idempotency_key: string;
          requested_payout_id: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      confirm_partner_fulfillment_shipment: {
        Args: {
          expected_version: number;
          requested_carrier: string;
          requested_fulfillment_id: string;
          requested_handoff_at: string;
          requested_idempotency_key: string;
          requested_note: string;
          requested_tracking_number: string;
        };
        Returns: {
          acceptance_due_at: string | null;
          activated_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          carrier: string | null;
          carrier_handoff_actor_id: string | null;
          carrier_handoff_due_at: string | null;
          carrier_handoff_note: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          custody:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at: string | null;
          fulfillment_mode:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason: string | null;
          id: string;
          inventory_confirmation_due_at: string | null;
          label_status: string | null;
          order_id: string;
          partner_id: string | null;
          ready_for_carrier_at: string | null;
          shipped_at: string | null;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "order_fulfillments";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
          requested_condition_grade: Database["public"]["Enums"]["product_condition_grade"];
          requested_condition_notes: string;
          requested_condition_score: number;
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
          requested_specifications: Json;
          requested_target_player: Database["public"]["Enums"]["product_target_player"];
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
      create_marketplace_checkout_order: {
        Args: {
          expected_version: number;
          requested_address: Json;
          requested_cart_id: string;
          requested_idempotency_key: string;
          requested_payment_method: Database["public"]["Enums"]["payment_method"];
          requested_save_address: boolean;
          requested_saved_address_id: string | null;
          requested_shipping_method_id: string;
        };
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
      create_marketplace_listing: {
        Args: { requested_category_id: string };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_marketplace_manual_market_reference: {
        Args: {
          requested_high_market: unknown;
          requested_idempotency_key: string;
          requested_listing_id: string;
          requested_listing_version_id: string;
          requested_low_market: unknown;
          requested_reason: string;
          requested_reference_price: unknown;
          requested_source_description: string;
        };
        Returns: {
          analysis_version: string;
          average_price: number | null;
          canonical_product_model_id: string | null;
          checked_at: string | null;
          completed_by: string | null;
          confidence: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at: string;
          excluded_comparable_count: number;
          expires_at: string | null;
          flags: Json;
          high_market: number | null;
          id: string;
          idempotency_key: string;
          input_fingerprint: string | null;
          input_snapshot: Json;
          listing_id: string;
          listing_version_id: string;
          low_market: number | null;
          median_price: number | null;
          partner_id: string;
          provider: string | null;
          provider_status: string | null;
          recommended_price: number | null;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          source: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_market_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_marketplace_partner_payout: {
        Args: {
          requested_idempotency_key: string;
          requested_partner_id: string;
          requested_payable_ids: string[];
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_marketplace_pricing_quote: {
        Args: {
          requested_desired_partner_net: unknown;
          requested_desired_public_price: unknown;
          requested_idempotency_key: string;
          requested_input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          requested_listing_id: string;
          requested_listing_version_id: string;
          requested_market_analysis_id: string | null;
        };
        Returns: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_fixed_fee_amount: number;
          admin_percentage_fee: number;
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          best_round_processing_share: number;
          calculated_public_price: number;
          calculation_version: string;
          canonical_product_model_id: string | null;
          commission_amount: number;
          commission_base: number;
          commission_rate_bps: number;
          commission_tax_bps: number;
          commission_vat: number;
          config_version_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          desired_partner_net: number | null;
          desired_public_price: number | null;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          expires_at: string;
          gross_best_round_revenue: number;
          id: string;
          idempotency_key: string;
          input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id: string;
          listing_version_id: string;
          lock_version: number;
          market_analysis_id: string | null;
          market_analysis_override: boolean;
          market_analysis_override_at: string | null;
          market_analysis_override_by: string | null;
          market_analysis_override_email: string | null;
          market_analysis_override_reason: string | null;
          market_delta_bps: number | null;
          market_lower_bound: number | null;
          market_reference: number | null;
          market_tolerance_bps: number;
          market_upper_bound: number | null;
          meets_minimum_marketplace_revenue: boolean | null;
          minimum_marketplace_revenue: number | null;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_fee_config_code: string;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          processing_total: number;
          quote_version: number;
          score_snapshot_id: string | null;
          status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at: string | null;
          tax_pass_through: number;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at: string;
          viability: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_pricing_quotes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_partner_penalty: {
        Args: {
          requested_event_code: string;
          requested_idempotency_key: string;
          requested_partner_id: string;
          requested_reason: string;
          requested_source_event_id?: string;
          requested_starts_at?: string;
        };
        Returns: {
          clearance_reason: string | null;
          cleared_at: string | null;
          cleared_by: string | null;
          config_version_id: string;
          created_at: string;
          created_by: string | null;
          event_code: string;
          expires_at: string | null;
          id: string;
          idempotency_key: string;
          partner_id: string;
          partner_visible: boolean;
          penalty_bps: number;
          reason: string;
          severity: Database["public"]["Enums"]["partner_penalty_severity"];
          source_event_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_penalty_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "partner_penalties";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_partner_score_tier_override: {
        Args: {
          requested_expires_at?: string;
          requested_partner_id: string;
          requested_reason: string;
          requested_score_bps: number | null;
          requested_tier:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          requested_type: Database["public"]["Enums"]["partner_override_type"];
        };
        Returns: {
          cleared_at: string | null;
          cleared_by: string | null;
          created_at: string;
          created_by: string;
          expires_at: string | null;
          id: string;
          override_type: Database["public"]["Enums"]["partner_override_type"];
          partner_id: string;
          reason: string;
          score_bps: number | null;
          starts_at: string;
          status: Database["public"]["Enums"]["partner_override_status"];
          tier: Database["public"]["Enums"]["marketplace_partner_tier"] | null;
        };
        SetofOptions: {
          from: "*";
          to: "partner_score_tier_overrides";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      fail_marketplace_partner_payout: {
        Args: {
          requested_idempotency_key: string;
          requested_payout_id: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      fail_notification_delivery: {
        Args: { requested_error_code: string; requested_lease_token: string };
        Returns: {
          delivery_id: string;
          next_attempt_at: string;
          status: Database["public"]["Enums"]["notification_delivery_status"];
        }[];
      };
      flag_marketplace_payout_reconciliation: {
        Args: {
          requested_idempotency_key: string;
          requested_payout_id: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_customer_cart: { Args: never; Returns: Json };
      get_customer_marketplace_cart_readiness: {
        Args: never;
        Returns: {
          available: boolean;
          blocker_codes: string[];
          cart_item_id: string;
          image_id: string;
          listing_version_changed: boolean;
          price_changed: boolean;
        }[];
      };
      get_customer_marketplace_claim_context: {
        Args: { requested_order_id: string };
        Returns: {
          acceptance_deadline: string;
          acceptance_status: Database["public"]["Enums"]["marketplace_acceptance_status"];
          claim_id: string;
          claim_reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          claim_status: Database["public"]["Enums"]["marketplace_claim_status"];
          fulfillment_id: string;
          fulfillment_status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          listing_title: string;
          order_item_id: string;
        }[];
      };
      get_customer_order: {
        Args: { requested_order_id: string };
        Returns: Json;
      };
      get_customer_order_fulfillment_summary: {
        Args: { requested_order_id: string };
        Returns: {
          carrier: string;
          fulfillment_id: string;
          item_count: number;
          shipped_at: string;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string;
        }[];
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
      get_marketplace_activation_readiness: {
        Args: never;
        Returns: {
          blockers: string[];
          eligible_listing_count: number;
          enabled: boolean;
          ready: boolean;
          schema_version: string;
        }[];
      };
      get_marketplace_claims_for_operations: {
        Args: { requested_claim_id?: string };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_marketplace_listing_readiness: {
        Args: { requested_listing_id: string };
        Returns: {
          condition_complete: boolean;
          defects_acknowledged: boolean;
          missing_fields: string[];
          product_identity_complete: boolean;
          quantity_valid: boolean;
          ready: boolean;
          required_photos_complete: boolean;
          required_specs_complete: boolean;
        }[];
      };
      get_marketplace_publication_readiness: {
        Args: { requested_listing_id?: string };
        Returns: {
          blockers: string[];
          listing_id: string;
          publication_ready: boolean;
          published: boolean;
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
      get_own_partner_score_summary: {
        Args: never;
        Returns: {
          completed_orders: number;
          component: Database["public"]["Enums"]["partner_score_component"];
          component_display_score_bps: number;
          current_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          display_score_bps: number;
          highest_eligible_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          promotion_candidate_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          promotion_eligible_since: string;
          rolling_average_active_listings: number;
          score_status: Database["public"]["Enums"]["partner_score_status"];
          tier_at_risk_since: string;
        }[];
      };
      get_own_partner_tier_history: {
        Args: never;
        Returns: {
          effective_at: string;
          new_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          old_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          reason: string;
          rolling_average_active_listings: number;
        }[];
      };
      get_partner_marketplace_balance: {
        Args: never;
        Returns: {
          available_cents: number;
          currency: string;
          net_position_cents: number;
          on_hold_cents: number;
          paid_historical_cents: number;
          pending_cents: number;
          reversed_cents: number;
        }[];
      };
      get_partner_marketplace_claims: {
        Args: { requested_claim_id?: string };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      get_partner_marketplace_payable_holds: {
        Args: { requested_payable_id: string };
        Returns: {
          created_at: string;
          hold_id: string;
          reason: string;
          released_at: string;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          status: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        }[];
      };
      get_partner_marketplace_payables: {
        Args: { requested_payable_id?: string };
        Returns: {
          admin_fixed_fee: number;
          admin_percentage_fee: number;
          commission_amount: number;
          commission_vat: number;
          created_at: string;
          currency: string;
          fulfillment_id: string;
          listing_title: string;
          order_id: string;
          order_item_id: string;
          order_number: string;
          partner_processing_share: number;
          payable_amount_cents: number;
          payable_id: string;
          public_line_total: number;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
        }[];
      };
      get_partner_marketplace_payouts: {
        Args: { requested_payout_id?: string };
        Returns: {
          bank_label: string;
          created_at: string;
          currency: string;
          external_reference: string;
          item_count: number;
          paid_at: string;
          payout_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          settlement_status: Database["public"]["Enums"]["marketplace_partner_settlement_status"];
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          transfer_date: string;
        }[];
      };
      get_partner_marketplace_sales: {
        Args: { requested_fulfillment_id?: string };
        Returns: {
          carrier: string;
          carrier_handoff_due_at: string;
          confirmed_at: string;
          created_at: string;
          currency: string;
          estimated_partner_net: number;
          fulfillment_id: string;
          inventory_confirmation_due_at: string;
          listing_title: string;
          order_item_id: string;
          order_number: string;
          public_line_total: number;
          quantity: number;
          ready_for_carrier_at: string;
          shipped_at: string;
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string;
          version: number;
        }[];
      };
      get_partner_onboarding_readiness: {
        Args: { requested_partner_id?: string };
        Returns: {
          active_document_count: number;
          basic_complete: boolean;
          documents_complete: boolean;
          fiscal_complete: boolean;
          review_ready: boolean;
        }[];
      };
      get_partner_tier_progress: {
        Args: { requested_partner_id: string };
        Returns: {
          downgrade_grace_days: number;
          minimum_average_active_listings: number;
          minimum_score_bps: number;
          promotion_stability_days: number;
          tier: Database["public"]["Enums"]["marketplace_partner_tier"];
        }[];
      };
      get_product_pricing_private: {
        Args: { requested_product_id: string };
        Returns: Json;
      };
      get_public_marketplace_catalog: {
        Args: { requested_slug?: string };
        Returns: {
          accessories_included: Json;
          available_quantity: number;
          bag_type: Database["public"]["Enums"]["golf_bag_type"];
          brand_id: string;
          brand_name: string;
          category_id: string;
          category_name: string;
          club_type: Database["public"]["Enums"]["golf_club_type"];
          condition: Database["public"]["Enums"]["product_condition"];
          condition_grade: Database["public"]["Enums"]["product_condition_grade"];
          condition_notes: string;
          currency: unknown;
          declared_defects: Json;
          description: string;
          fulfillment: Database["public"]["Enums"]["marketplace_listing_fulfillment"];
          images: Json;
          listing_id: string;
          model_name: string;
          pricing_quote_id: string;
          product_family: Database["public"]["Enums"]["golf_product_family"];
          public_price: unknown;
          set_type: Database["public"]["Enums"]["golf_set_type"];
          slug: string;
          specifications: Json;
          title: string;
        }[];
      };
      get_public_marketplace_image_path: {
        Args: { requested_image_id: string; requested_listing_id: string };
        Returns: {
          mime_type: string;
          storage_path: string;
        }[];
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
      mark_marketplace_partner_payout_ready: {
        Args: {
          requested_idempotency_key: string;
          requested_payout_id: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mask_notification_email: { Args: { email: string }; Returns: string };
      normalize_checkout_address: { Args: { requested: Json }; Returns: Json };
      normalize_customer_address: { Args: { requested: Json }; Returns: Json };
      normalize_manual_order_payload: {
        Args: { requested_payload: Json };
        Returns: Json;
      };
      open_marketplace_claim: {
        Args: {
          requested_description: string;
          requested_idempotency_key: string;
          requested_order_item_id: string;
          requested_reason: Database["public"]["Enums"]["marketplace_claim_reason"];
        };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      payments_test_mode_enabled: { Args: never; Returns: boolean };
      place_marketplace_partner_payable_hold: {
        Args: {
          requested_idempotency_key: string;
          requested_partner_visible: boolean;
          requested_payable_id: string;
          requested_reason: string;
          requested_source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
        };
        Returns: {
          created_at: string;
          currency: string;
          fulfillment_id: string;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payables";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      place_marketplace_partner_payout_hold: {
        Args: {
          requested_idempotency_key: string;
          requested_partner_visible: boolean;
          requested_payout_id: string;
          requested_reason: string;
          requested_source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
        };
        Returns: {
          actor_id: string | null;
          created_at: string;
          id: string;
          partner_id: string;
          partner_visible: boolean;
          payout_id: string;
          placed_idempotency_key: string;
          reason: string;
          release_idempotency_key: string | null;
          release_reason: string | null;
          released_at: string | null;
          released_by: string | null;
          source: Database["public"]["Enums"]["marketplace_partner_hold_source"];
          source_reference_key: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_hold_status"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payout_holds";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      populate_manual_order: {
        Args: {
          normalized_payload: Json;
          replacing: boolean;
          requested_order_id: string;
        };
        Returns: undefined;
      };
      prepare_marketplace_listing_price: {
        Args: {
          expected_lock_version: number;
          requested_desired_public_price: unknown;
          requested_idempotency_key: string;
          requested_listing_id: string;
          requested_market_analysis_id: string | null;
        };
        Returns: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_fixed_fee_amount: number;
          admin_percentage_fee: number;
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          best_round_processing_share: number;
          calculated_public_price: number;
          calculation_version: string;
          canonical_product_model_id: string | null;
          commission_amount: number;
          commission_base: number;
          commission_rate_bps: number;
          commission_tax_bps: number;
          commission_vat: number;
          config_version_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          desired_partner_net: number | null;
          desired_public_price: number | null;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          expires_at: string;
          gross_best_round_revenue: number;
          id: string;
          idempotency_key: string;
          input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id: string;
          listing_version_id: string;
          lock_version: number;
          market_analysis_id: string | null;
          market_analysis_override: boolean;
          market_analysis_override_at: string | null;
          market_analysis_override_by: string | null;
          market_analysis_override_email: string | null;
          market_analysis_override_reason: string | null;
          market_delta_bps: number | null;
          market_lower_bound: number | null;
          market_reference: number | null;
          market_tolerance_bps: number;
          market_upper_bound: number | null;
          meets_minimum_marketplace_revenue: boolean | null;
          minimum_marketplace_revenue: number | null;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_fee_config_code: string;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          processing_total: number;
          quote_version: number;
          score_snapshot_id: string | null;
          status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at: string | null;
          tax_pass_through: number;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at: string;
          viability: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_pricing_quotes";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      process_partner_identity_webhook: {
        Args: {
          requested_attributes: Json;
          requested_event_id: string;
          requested_external_session_id: string;
          requested_occurred_at: string;
          requested_payload_sha256: string;
          requested_provider: string;
          requested_result: Database["public"]["Enums"]["identity_verification_result"];
          requested_warning_codes: string[];
        };
        Returns: boolean;
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
      recalculate_partner_score_tier: {
        Args: {
          requested_as_of_date: string;
          requested_calculation_key: string;
          requested_partner_id: string;
          requested_reason: string;
        };
        Returns: {
          calculated_at: string | null;
          current_config_version_id: string | null;
          current_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          highest_eligible_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          latest_score_snapshot_id: string | null;
          partner_id: string;
          promotion_candidate_tier:
            Database["public"]["Enums"]["marketplace_partner_tier"] | null;
          promotion_eligible_since: string | null;
          rolling_average_active_listings: number;
          tier_at_risk_since: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "partner_score_tier_state";
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
      record_marketplace_delivery: {
        Args: {
          requested_delivered_at: string;
          requested_fulfillment_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
        };
        Returns: {
          acceptance_deadline: string;
          acceptance_window_hours: number;
          accepted_at: string | null;
          actor_id: string | null;
          buyer_id: string;
          claim_opened_at: string | null;
          config_version_id: string;
          created_at: string;
          delivered_at: string;
          finalized_at: string | null;
          fulfillment_id: string;
          id: string;
          idempotency_key: string | null;
          order_id: string;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_acceptance_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_delivery_acceptances";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_marketplace_manual_transfer: {
        Args: {
          requested_bank_label: string;
          requested_confirmed_amount_cents: number;
          requested_external_reference: string;
          requested_idempotency_key: string;
          requested_note: string;
          requested_payout_id: string;
          requested_transfer_date: string;
        };
        Returns: {
          amount_cents: number;
          bank_label: string;
          confirmation_idempotency_key: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          currency: string;
          external_reference: string;
          id: string;
          operations_note: string | null;
          partner_id: string;
          payout_id: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          record_idempotency_key: string;
          recorded_by: string;
          status: Database["public"]["Enums"]["marketplace_partner_settlement_status"];
          transfer_date: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_settlements";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_automatic_partner_csf_analysis: {
        Args: {
          requested_actor_id: string;
          requested_document_id: string;
          requested_extracted: Json;
          requested_normalized_output: Json;
          requested_result: Database["public"]["Enums"]["automatic_document_review_result"];
          requested_warning_codes: string[];
        };
        Returns: {
          analysis_version: string;
          analyzed_at: string;
          analyzed_by: string | null;
          document_id: string;
          extracted_address: string | null;
          extracted_document_date: string | null;
          extracted_document_type: string | null;
          extracted_name: string | null;
          extracted_rfc: string | null;
          id: string;
          normalized_output: Json;
          official_qr_destination: string | null;
          result: Database["public"]["Enums"]["automatic_document_review_result"];
          warning_codes: string[];
        };
        SetofOptions: {
          from: "*";
          to: "partner_document_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_partner_document_analysis: {
        Args: {
          requested_analysis_version: string;
          requested_document_id: string;
          requested_extracted: Json;
          requested_normalized_output: Json;
          requested_result: Database["public"]["Enums"]["automatic_document_review_result"];
          requested_warning_codes: string[];
        };
        Returns: {
          analysis_version: string;
          analyzed_at: string;
          analyzed_by: string | null;
          document_id: string;
          extracted_address: string | null;
          extracted_document_date: string | null;
          extracted_document_type: string | null;
          extracted_name: string | null;
          extracted_rfc: string | null;
          id: string;
          normalized_output: Json;
          official_qr_destination: string | null;
          result: Database["public"]["Enums"]["automatic_document_review_result"];
          warning_codes: string[];
        };
        SetofOptions: {
          from: "*";
          to: "partner_document_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_partner_onboarding_consents: {
        Args: {
          expected_version: number;
          requested_privacy_accepted: boolean;
          requested_terms_accepted: boolean;
        };
        Returns: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
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
      record_partner_rating: {
        Args: {
          requested_delivery_experience: number;
          requested_idempotency_key: string;
          requested_occurred_at: string;
          requested_overall_experience: number;
          requested_partner_id: string;
          requested_product_as_described: number;
          requested_source_entity_id: string;
          requested_source_entity_type: string;
        };
        Returns: {
          created_at: string;
          delivery_experience: number;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          overall_experience: number;
          partner_id: string;
          product_as_described: number;
          recorded_by: string | null;
          source_entity_id: string;
          source_entity_type: string;
        };
        SetofOptions: {
          from: "*";
          to: "partner_ratings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_partner_score_event: {
        Args: {
          requested_component: Database["public"]["Enums"]["partner_score_component"];
          requested_evidence?: Json;
          requested_idempotency_key: string;
          requested_occurred_at: string;
          requested_outcome_code: string;
          requested_partner_id: string;
          requested_source: Database["public"]["Enums"]["partner_score_event_source"];
          requested_source_entity_id?: string;
          requested_source_entity_type?: string;
        };
        Returns: {
          component: Database["public"]["Enums"]["partner_score_component"];
          counts_completed_order: boolean;
          created_at: string;
          evidence: Json;
          id: string;
          idempotency_key: string;
          occurred_at: string;
          outcome_code: string;
          partner_id: string;
          recorded_by: string | null;
          score_bps: number;
          source: Database["public"]["Enums"]["partner_score_event_source"];
          source_entity_id: string | null;
          source_entity_type: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "partner_score_events";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      recover_expired_notification_leases: { Args: never; Returns: number };
      refresh_marketplace_cart_item: {
        Args: {
          expected_version: number;
          requested_accept_listing_update: boolean;
          requested_cart_item_id: string;
          requested_idempotency_key: string;
          requested_quantity: number;
        };
        Returns: {
          cart_id: string;
          replayed: boolean;
          version: number;
        }[];
      };
      register_marketplace_claim_evidence: {
        Args: {
          requested_claim_id: string;
          requested_idempotency_key: string;
          requested_mime_type: string;
          requested_note: string;
          requested_size_bytes: number;
          requested_storage_path: string;
        };
        Returns: {
          claim_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          mime_type: string;
          note: string | null;
          partner_visible: boolean;
          size_bytes: number;
          storage_path: string;
          submitted_by: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claim_evidence";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_marketplace_listing_image: {
        Args: {
          expected_lock_version: number;
          requested_alt_text: string;
          requested_height_pixels?: number;
          requested_image_id: string;
          requested_image_type: string;
          requested_listing_id: string;
          requested_mime_type: string;
          requested_sha256: string;
          requested_size_bytes: number;
          requested_storage_path: string;
          requested_width_pixels?: number;
        };
        Returns: {
          height_pixels: number | null;
          id: string;
          listing_id: string;
          mime_type: string;
          sha256: string;
          size_bytes: number;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string;
          width_pixels: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listing_images";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_partner_document: {
        Args: {
          requested_document_id: string;
          requested_document_kind: string;
          requested_mime_type: string;
          requested_sha256: string;
          requested_size_bytes: number;
          requested_storage_path: string;
        };
        Returns: {
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
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "partner_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_partner_identity_session: {
        Args: {
          requested_external_session_id: string;
          requested_provider: string;
          requested_session_kind: string;
        };
        Returns: {
          completed_at: string | null;
          created_at: string;
          created_by: string;
          external_session_id: string;
          face_match_passed: boolean | null;
          id: string;
          liveness_passed: boolean | null;
          normalized_attributes: Json;
          partner_id: string;
          provider: string;
          result: Database["public"]["Enums"]["identity_verification_result"];
          session_kind: string;
          updated_at: string;
          warning_codes: string[];
        };
        SetofOptions: {
          from: "*";
          to: "partner_identity_verifications";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_partner_profile: {
        Args: {
          requested_legal_type: Database["public"]["Enums"]["partner_legal_type"];
        };
        Returns: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
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
      release_expired_marketplace_reservations: {
        Args: { requested_limit?: number };
        Returns: number;
      };
      release_marketplace_order_reservations: {
        Args: { requested_order_id: string; requested_reason: string };
        Returns: number;
      };
      release_marketplace_partner_payable: {
        Args: {
          requested_basis: Database["public"]["Enums"]["marketplace_partner_release_basis"];
          requested_idempotency_key: string;
          requested_payable_id: string;
          requested_reason: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          fulfillment_id: string;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payables";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      release_marketplace_partner_payable_hold: {
        Args: {
          requested_hold_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          fulfillment_id: string;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payables";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      release_marketplace_partner_payout_hold: {
        Args: {
          requested_hold_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_marketplace_listing_image: {
        Args: {
          expected_lock_version: number;
          requested_image_id: string;
          requested_listing_id: string;
        };
        Returns: {
          delete_storage_object: boolean;
          removed_storage_path: string;
        }[];
      };
      remove_marketplace_partner_payout_item: {
        Args: {
          requested_idempotency_key: string;
          requested_payable_id: string;
          requested_payout_id: string;
          requested_reason: string;
        };
        Returns: {
          batch_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          failed_at: string | null;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payout_status"]
            | null;
          id: string;
          idempotency_key: string;
          item_count: number;
          paid_at: string | null;
          partner_id: string;
          payout_reference: string;
          provider: Database["public"]["Enums"]["marketplace_payout_provider"];
          ready_at: string | null;
          status: Database["public"]["Enums"]["marketplace_partner_payout_status"];
          total_cents: number;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payouts";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      reorder_marketplace_listing_images: {
        Args: {
          expected_lock_version: number;
          requested_image_ids: string[];
          requested_listing_id: string;
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      request_marketplace_market_analysis: {
        Args: {
          requested_idempotency_key: string;
          requested_listing_id: string;
          requested_listing_version_id: string;
        };
        Returns: {
          analysis_version: string;
          average_price: number | null;
          canonical_product_model_id: string | null;
          checked_at: string | null;
          completed_by: string | null;
          confidence: Database["public"]["Enums"]["marketplace_market_confidence"];
          created_at: string;
          excluded_comparable_count: number;
          expires_at: string | null;
          flags: Json;
          high_market: number | null;
          id: string;
          idempotency_key: string;
          input_fingerprint: string | null;
          input_snapshot: Json;
          listing_id: string;
          listing_version_id: string;
          low_market: number | null;
          median_price: number | null;
          partner_id: string;
          provider: string | null;
          provider_status: string | null;
          recommended_price: number | null;
          requested_at: string;
          requested_by: string;
          result_snapshot: Json;
          source: Database["public"]["Enums"]["marketplace_market_analysis_source"];
          status: Database["public"]["Enums"]["marketplace_market_analysis_status"];
          valid_comparable_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_market_analyses";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reserve_brps_product_sku: {
        Args: { requested_base: string };
        Returns: string;
      };
      resolve_marketplace_claim: {
        Args: {
          requested_adjustment_cents: number;
          requested_buyer_outcome: string;
          requested_claim_id: string;
          requested_decision: Database["public"]["Enums"]["marketplace_claim_decision"];
          requested_evidence_summary: string;
          requested_idempotency_key: string;
          requested_reason: string;
          requested_responsibility: Database["public"]["Enums"]["marketplace_claim_responsibility"];
          requested_return_requirement: Database["public"]["Enums"]["marketplace_return_requirement"];
        };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resolve_marketplace_listing_product: {
        Args: {
          expected_lock_version: number;
          requested_brand_id: string | null;
          requested_listing_id: string;
          requested_model_id: string | null;
          requested_model_name: string;
          requested_reason: string;
        };
        Returns: {
          brand_id: string;
          category_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          model_name: string;
          normalized_model_name: string;
          source_product_id: string | null;
          status: Database["public"]["Enums"]["catalog_record_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "catalog_product_models";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      reverse_marketplace_partner_payable: {
        Args: {
          requested_amount_cents: number;
          requested_idempotency_key: string;
          requested_payable_id: string;
          requested_reason: string;
        };
        Returns: {
          created_at: string;
          currency: string;
          fulfillment_id: string;
          held_from_status:
            | Database["public"]["Enums"]["marketplace_partner_payable_status"]
            | null;
          id: string;
          order_id: string;
          order_item_id: string;
          original_amount_cents: number;
          paid_amount_cents: number;
          partner_id: string;
          payment_id: string;
          pricing_quote_id: string;
          quantity: number;
          reversed_amount_cents: number;
          status: Database["public"]["Enums"]["marketplace_partner_payable_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_partner_payables";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      review_marketplace_submission: {
        Args: {
          expected_lock_version: number;
          requested_decision: Database["public"]["Enums"]["marketplace_listing_status"];
          requested_feedback: Json;
          requested_internal_note?: string;
          requested_listing_id: string;
          requested_market_analysis_override?: boolean;
          requested_reason: string;
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
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
      review_partner_document: {
        Args: {
          expected_version: number;
          requested_document_id: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["partner_document_status"];
        };
        Returns: {
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
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "partner_documents";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      round_up_commercial_price: {
        Args: { requested_market_upper?: unknown; requested_minimum: unknown };
        Returns: unknown;
      };
      run_marketplace_acceptance_job: {
        Args: { requested_execution_key: string; requested_now: string };
        Returns: {
          completed_at: string | null;
          error_message: string | null;
          execution_key: string;
          id: string;
          processed_count: number;
          started_at: string;
          status: Database["public"]["Enums"]["marketplace_acceptance_job_status"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_acceptance_job_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      run_marketplace_payout_job: {
        Args: { requested_date: string; requested_execution_key: string };
        Returns: {
          batch_id: string | null;
          calculation_date: string;
          completed_at: string | null;
          created_at: string;
          execution_key: string;
          id: string;
          payable_count: number;
          payout_count: number;
          status: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_payout_job_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      run_marketplace_score_tier_job: {
        Args: {
          requested_as_of_date: string;
          requested_job_key: string;
          requested_partner_id?: string;
          requested_reason?: string;
        };
        Returns: {
          actor_id: string | null;
          as_of_date: string;
          completed_at: string | null;
          id: string;
          job_key: string;
          processed_partners: number;
          reason: string;
          requested_partner_id: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["marketplace_score_job_status"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_score_job_runs";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_marketplace_listing_draft: {
        Args: {
          expected_lock_version: number;
          requested_listing_id: string;
          requested_payload: Json;
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_partner_onboarding: {
        Args: {
          expected_version: number;
          requested_payload: Json;
          requested_section: string;
        };
        Returns: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
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
      set_marketplace_claim_evidence_partner_visibility: {
        Args: {
          requested_evidence_id: string;
          requested_idempotency_key: string;
          requested_partner_visible: boolean;
          requested_reason: string;
        };
        Returns: {
          claim_id: string;
          created_at: string;
          id: string;
          idempotency_key: string;
          mime_type: string;
          note: string | null;
          partner_visible: boolean;
          size_bytes: number;
          storage_path: string;
          submitted_by: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claim_evidence";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_marketplace_enabled: {
        Args: {
          expected_enabled: boolean;
          requested_confirmation: string;
          requested_enabled: boolean;
          requested_reason: string;
        };
        Returns: {
          audit_id: string;
          changed_at: string;
          enabled: boolean;
        }[];
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
      submit_marketplace_claim_partner_response: {
        Args: {
          requested_claim_id: string;
          requested_idempotency_key: string;
          requested_response: string;
        };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_marketplace_listing: {
        Args: { expected_lock_version: number; requested_listing_id: string };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_marketplace_listing_workflow: {
        Args: {
          expected_lock_version: number;
          requested_listing_id: string;
          requested_quote_id: string;
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      submit_partner_for_review: {
        Args: { expected_version: number };
        Returns: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
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
      transition_marketplace_fulfillment: {
        Args: {
          expected_version: number;
          requested_action: string;
          requested_fulfillment_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
        };
        Returns: {
          acceptance_due_at: string | null;
          activated_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          carrier: string | null;
          carrier_handoff_actor_id: string | null;
          carrier_handoff_due_at: string | null;
          carrier_handoff_note: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          custody:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at: string | null;
          fulfillment_mode:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason: string | null;
          id: string;
          inventory_confirmation_due_at: string | null;
          label_status: string | null;
          order_id: string;
          partner_id: string | null;
          ready_for_carrier_at: string | null;
          shipped_at: string | null;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "order_fulfillments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_marketplace_listing_status: {
        Args: {
          expected_lock_version: number;
          requested_feedback?: Json;
          requested_internal_note?: string;
          requested_listing_id: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["marketplace_listing_status"];
        };
        Returns: {
          approved_at: string | null;
          approved_version_id: string | null;
          archived_at: string | null;
          created_at: string;
          current_version_id: string | null;
          id: string;
          last_submitted_at: string | null;
          lock_version: number;
          partner_id: string;
          status: Database["public"]["Enums"]["marketplace_listing_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_listings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_marketplace_pricing_quote: {
        Args: {
          expected_lock_version: number;
          requested_quote_id: string;
          requested_reason: string | null;
          requested_status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
        };
        Returns: {
          admin_fee_bps: number;
          admin_fixed_fee: number;
          admin_fixed_fee_amount: number;
          admin_percentage_fee: number;
          approval_reason: string | null;
          approved_at: string | null;
          approved_by: string | null;
          best_round_processing_share: number;
          calculated_public_price: number;
          calculation_version: string;
          canonical_product_model_id: string | null;
          commission_amount: number;
          commission_base: number;
          commission_rate_bps: number;
          commission_tax_bps: number;
          commission_vat: number;
          config_version_id: string;
          created_at: string;
          created_by: string;
          currency: string;
          desired_partner_net: number | null;
          desired_public_price: number | null;
          effective_partner_tier: Database["public"]["Enums"]["marketplace_partner_tier"];
          effective_tier_override_id: string | null;
          estimated_best_round_revenue: number;
          estimated_partner_net: number;
          expires_at: string;
          gross_best_round_revenue: number;
          id: string;
          idempotency_key: string;
          input_mode: Database["public"]["Enums"]["marketplace_pricing_input_mode"];
          listing_id: string;
          listing_version_id: string;
          lock_version: number;
          market_analysis_id: string | null;
          market_analysis_override: boolean;
          market_analysis_override_at: string | null;
          market_analysis_override_by: string | null;
          market_analysis_override_email: string | null;
          market_analysis_override_reason: string | null;
          market_delta_bps: number | null;
          market_lower_bound: number | null;
          market_reference: number | null;
          market_tolerance_bps: number;
          market_upper_bound: number | null;
          meets_minimum_marketplace_revenue: boolean | null;
          minimum_marketplace_revenue: number | null;
          other_configured_fees: number;
          partner_id: string;
          partner_processing_share: number;
          partner_processing_share_bps: number;
          payment_fee_config_code: string;
          payment_processing_bps: number;
          payment_processing_fixed_fee: number;
          processing_total: number;
          quote_version: number;
          score_snapshot_id: string | null;
          status: Database["public"]["Enums"]["marketplace_pricing_quote_status"];
          submitted_at: string | null;
          tax_pass_through: number;
          tier_source: Database["public"]["Enums"]["marketplace_tier_source"];
          updated_at: string;
          viability: Database["public"]["Enums"]["marketplace_price_viability"];
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_pricing_quotes";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_marketplace_return: {
        Args: {
          requested_carrier: string;
          requested_idempotency_key: string;
          requested_inspection_result: string;
          requested_reason: string;
          requested_return_id: string;
          requested_status: Database["public"]["Enums"]["marketplace_return_status"];
          requested_tracking_number: string;
        };
        Returns: {
          carrier: string | null;
          claim_id: string;
          created_at: string;
          fulfillment_id: string;
          id: string;
          inspection_result: string | null;
          label_status: string;
          order_item_id: string;
          quantity: number;
          received_at: string | null;
          shipped_at: string | null;
          shipping_responsibility: Database["public"]["Enums"]["marketplace_return_shipping_responsibility"];
          status: Database["public"]["Enums"]["marketplace_return_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_returns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_partner_fulfillment: {
        Args: {
          expected_version: number;
          requested_action: string;
          requested_fulfillment_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
        };
        Returns: {
          acceptance_due_at: string | null;
          activated_at: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          carrier: string | null;
          carrier_handoff_actor_id: string | null;
          carrier_handoff_due_at: string | null;
          carrier_handoff_note: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          custody:
            Database["public"]["Enums"]["marketplace_listing_custody"] | null;
          delivered_at: string | null;
          fulfillment_mode:
            | Database["public"]["Enums"]["marketplace_listing_fulfillment"]
            | null;
          hold_reason: string | null;
          id: string;
          inventory_confirmation_due_at: string | null;
          label_status: string | null;
          order_id: string;
          partner_id: string | null;
          ready_for_carrier_at: string | null;
          shipped_at: string | null;
          source: Database["public"]["Enums"]["order_fulfillment_source"];
          status: Database["public"]["Enums"]["marketplace_fulfillment_status"];
          tracking_number: string | null;
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "order_fulfillments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      transition_partner_status: {
        Args: {
          expected_version: number;
          requested_partner_id: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["partner_status"];
        };
        Returns: {
          city: string | null;
          commercial_name: string | null;
          country_code: string | null;
          created_at: string;
          first_name: string | null;
          fiscal_address_line_1: string | null;
          fiscal_address_line_2: string | null;
          fiscal_city: string | null;
          fiscal_postal_code: string | null;
          fiscal_state: string | null;
          id: string;
          last_name: string | null;
          legal_name: string | null;
          legal_type: Database["public"]["Enums"]["partner_legal_type"];
          onboarding_step: number;
          phone: string | null;
          privacy_accepted_at: string | null;
          rejected_at: string | null;
          representative_name: string | null;
          state: string | null;
          status: Database["public"]["Enums"]["partner_status"];
          submitted_at: string | null;
          suspended_at: string | null;
          tax_id: string | null;
          terms_accepted_at: string | null;
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
      update_marketplace_claim_review: {
        Args: {
          requested_claim_id: string;
          requested_idempotency_key: string;
          requested_reason: string;
          requested_status: Database["public"]["Enums"]["marketplace_claim_status"];
        };
        Returns: {
          acceptance_id: string;
          approved_adjustment_cents: number | null;
          buyer_id: string;
          claim_hold_id: string | null;
          created_at: string;
          description: string;
          evaluation_confidence: number | null;
          evaluation_notes: string | null;
          evaluation_source: Database["public"]["Enums"]["marketplace_claim_evaluation_source"];
          finalized_at: string | null;
          financial_effect:
            | Database["public"]["Enums"]["marketplace_claim_financial_effect"]
            | null;
          fulfillment_id: string;
          id: string;
          listing_version_id: string;
          opened_at: string;
          opened_idempotency_key: string;
          order_id: string;
          order_item_id: string;
          partner_id: string;
          payable_id: string;
          reason: Database["public"]["Enums"]["marketplace_claim_reason"];
          refund_status: Database["public"]["Enums"]["marketplace_refund_preparation_status"];
          responsibility:
            | Database["public"]["Enums"]["marketplace_claim_responsibility"]
            | null;
          return_requirement:
            | Database["public"]["Enums"]["marketplace_return_requirement"]
            | null;
          status: Database["public"]["Enums"]["marketplace_claim_status"];
          updated_at: string;
          version: number;
        };
        SetofOptions: {
          from: "*";
          to: "marketplace_claims";
          isOneToOne: true;
          isSetofReturn: false;
        };
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
      automatic_document_review_result: "PASSED" | "REVIEW_REQUIRED" | "FAILED";
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
      identity_verification_result:
        "PENDING" | "PASSED" | "REVIEW_REQUIRED" | "FAILED";
      inventory_movement_type:
        | "receipt"
        | "adjustment"
        | "reservation"
        | "release"
        | "sale"
        | "return";
      inventory_reservation_status:
        | "ACTIVE"
        | "COMMITTED"
        | "RELEASED"
        | "EXPIRED"
        | "MANUAL_RECONCILIATION_REQUIRED";
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
      marketplace_acceptance_job_status: "RUNNING" | "COMPLETED";
      marketplace_acceptance_status:
        "PENDING" | "BUYER_ACCEPTED" | "AUTO_ACCEPTED" | "PROBLEM_REPORTED";
      marketplace_claim_decision:
        "APPROVED" | "PARTIALLY_APPROVED" | "REJECTED";
      marketplace_claim_evaluation_source: "MANUAL" | "AI" | "HYBRID";
      marketplace_claim_financial_effect:
        "NONE" | "FULL_REVERSAL" | "PARTIAL_REVERSAL";
      marketplace_claim_reason:
        | "WRONG_ITEM"
        | "CONDITION_NOT_AS_DESCRIBED"
        | "UNDECLARED_DAMAGE"
        | "COUNTERFEIT_SUSPECTED"
        | "WRONG_SPECS"
        | "NON_FUNCTIONAL"
        | "OTHER_MANUAL_REVIEW";
      marketplace_claim_responsibility:
        | "PARTNER_RESPONSIBLE"
        | "BUYER_NOT_SUPPORTED"
        | "BEST_ROUND_OPERATIONAL"
        | "INCONCLUSIVE"
        | "NO_FAULT";
      marketplace_claim_status:
        | "OPEN"
        | "UNDER_REVIEW"
        | "EVIDENCE_REQUESTED"
        | "PARTNER_RESPONSE_PENDING"
        | "RETURN_REQUIRED"
        | "RETURN_IN_TRANSIT"
        | "RETURN_RECEIVED"
        | "RESOLVED"
        | "CANCELLED";
      marketplace_config_status: "DRAFT" | "PUBLISHED" | "RETIRED";
      marketplace_fulfillment_status:
        | "PENDING_CONFIRMATION"
        | "CONFIRMED"
        | "PREPARING"
        | "READY_FOR_CARRIER"
        | "SHIPPED"
        | "DELIVERED"
        | "ACCEPTANCE_PENDING"
        | "COMPLETED"
        | "CANCELLED"
        | "ON_HOLD";
      marketplace_inventory_movement_type:
        | "INITIAL"
        | "SET_QUANTITY"
        | "RESERVE"
        | "RELEASE"
        | "SALE"
        | "RETURN"
        | "ADJUSTMENT";
      marketplace_listing_custody: "PARTNER_CUSTODY" | "BEST_ROUND_CUSTODY";
      marketplace_listing_evaluation_source:
        "HUMAN" | "AI" | "HYBRID" | "RULES";
      marketplace_listing_evaluation_status:
        "NOT_STARTED" | "PENDING" | "COMPLETED" | "FAILED";
      marketplace_listing_fulfillment:
        "PARTNER_FULFILLED" | "BEST_ROUND_FULFILLED";
      marketplace_listing_image_requirement:
        "REQUIRED" | "RECOMMENDED" | "OPTIONAL";
      marketplace_listing_ownership: "PARTNER_OWNED";
      marketplace_listing_review_area:
        | "PHOTOS"
        | "SPECS"
        | "CONDITION"
        | "DESCRIPTION"
        | "PRODUCT_IDENTITY"
        | "QUANTITY"
        | "OTHER";
      marketplace_listing_review_request_status: "OPEN" | "RESOLVED";
      marketplace_listing_review_visibility: "INTERNAL" | "PARTNER_VISIBLE";
      marketplace_listing_status:
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "PUBLISHED"
        | "PAUSED"
        | "SOLD"
        | "REJECTED"
        | "EXPIRED"
        | "ARCHIVED";
      marketplace_listing_version_state:
        "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
      marketplace_market_analysis_source:
        "PROVIDER" | "MANUAL" | "HYBRID" | "AI";
      marketplace_market_analysis_status:
        | "REQUESTED"
        | "COMPLETE"
        | "INSUFFICIENT_DATA"
        | "PROVIDER_UNAVAILABLE"
        | "FAILED"
        | "STALE";
      marketplace_market_confidence: "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT";
      marketplace_order_exception_status:
        | "NONE"
        | "ON_HOLD"
        | "PARTIAL_EXCEPTION"
        | "MANUAL_RECONCILIATION_REQUIRED";
      marketplace_partner_finance_actor_source:
        | "PAYMENT"
        | "SYSTEM"
        | "OPERATIONS"
        | "RISK"
        | "CLAIM"
        | "RECONCILIATION"
        | "PAYOUT";
      marketplace_partner_hold_source:
        "SYSTEM" | "OPERATIONS" | "RISK" | "CLAIM" | "RECONCILIATION";
      marketplace_partner_hold_status: "ACTIVE" | "RELEASED";
      marketplace_partner_ledger_entry_type:
        | "PAYABLE_CREATED"
        | "PAYABLE_HELD"
        | "PAYABLE_HOLD_RELEASED"
        | "PAYABLE_RELEASED"
        | "PAYABLE_REVERSED"
        | "PAYABLE_PAID"
        | "PAYABLE_ADJUSTED";
      marketplace_partner_payable_status:
        "PENDING" | "ON_HOLD" | "AVAILABLE" | "PAID" | "REVERSED";
      marketplace_partner_payout_event_type:
        | "PAYOUT_CREATED"
        | "ITEM_ATTACHED"
        | "ITEM_REMOVED"
        | "PAYOUT_READY"
        | "PAYOUT_HELD"
        | "PAYOUT_HOLD_RELEASED"
        | "TRANSFER_RECORDED"
        | "PAYOUT_FAILED"
        | "SETTLEMENT_CONFIRMED"
        | "RECONCILIATION_REQUIRED"
        | "PAYOUT_CANCELLED";
      marketplace_partner_payout_status:
        | "DRAFT"
        | "READY"
        | "ON_HOLD"
        | "AWAITING_CONFIRMATION"
        | "PAID"
        | "FAILED"
        | "CANCELLED"
        | "RECONCILIATION_REQUIRED";
      marketplace_partner_release_basis:
        | "DELIVERY_ACCEPTED"
        | "AUTO_ACCEPTED"
        | "CLAIM_RESOLVED"
        | "OPERATIONS_APPROVED";
      marketplace_partner_settlement_status:
        | "PENDING"
        | "CONFIRMED"
        | "FAILED"
        | "RECONCILIATION_REQUIRED"
        | "REVERSED_EXTERNALLY";
      marketplace_partner_tier:
        "BOGEY" | "PAR" | "BIRDIE" | "ALBATROSS" | "HOLE_IN_ONE";
      marketplace_payout_batch_status:
        "DRAFT" | "READY" | "COMPLETED" | "CANCELLED";
      marketplace_payout_provider:
        "MANUAL_BANK_TRANSFER" | "STRIPE_CONNECT" | "OTHER_PROVIDER";
      marketplace_price_viability:
        | "COMPETITIVE"
        | "SLIGHTLY_HIGH"
        | "OVERPRICED"
        | "UNDERPRICED"
        | "INSUFFICIENT_DATA";
      marketplace_pricing_input_mode: "PUBLIC_PRICE_PRIORITY" | "NET_PRIORITY";
      marketplace_pricing_quote_status:
        | "DRAFT"
        | "ANALYZED"
        | "PARTNER_ACCEPTED"
        | "UNDER_REVIEW"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "REJECTED"
        | "SUPERSEDED"
        | "EXPIRED";
      marketplace_refund_preparation_status:
        | "REFUND_NOT_REQUIRED"
        | "REFUND_PENDING"
        | "REFUND_PREPARED"
        | "REFUND_REQUIRES_MANUAL_ACTION"
        | "REFUND_COMPLETED";
      marketplace_return_requirement:
        | "NO_RETURN_REQUIRED"
        | "RETURN_REQUIRED"
        | "RETURN_WAIVED"
        | "MANUAL_REVIEW";
      marketplace_return_shipping_responsibility:
        "PARTNER_OR_BEST_ROUND" | "BUYER" | "MANUAL_REVIEW";
      marketplace_return_status:
        | "REQUESTED"
        | "AUTHORIZED"
        | "AWAITING_SHIPMENT"
        | "IN_TRANSIT"
        | "RECEIVED"
        | "INSPECTING"
        | "ACCEPTED"
        | "REJECTED"
        | "CLOSED";
      marketplace_score_job_status: "RUNNING" | "COMPLETED";
      marketplace_tier_source: "CALCULATED" | "OVERRIDE";
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
      order_fulfillment_source: "BEST_ROUND" | "PARTNER";
      order_item_source: "FIRST_PARTY" | "MARKETPLACE_PARTNER";
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
      partner_override_status: "ACTIVE" | "EXPIRED" | "CLEARED";
      partner_override_type: "SCORE" | "TIER";
      partner_penalty_severity: "MINOR" | "MEDIUM" | "MAJOR" | "CRITICAL";
      partner_penalty_status: "ACTIVE" | "EXPIRED" | "CLEARED";
      partner_risk_flag_status: "OPEN" | "RESOLVED";
      partner_score_component:
        | "ORDER_COMPLETION"
        | "SHIPPING_SLA"
        | "AVAILABILITY"
        | "LISTING_ACCURACY"
        | "CLAIMS_RETURNS"
        | "GOLFER_RATING"
        | "DOCUMENTATION_TENURE";
      partner_score_event_source:
        | "ORDER"
        | "FULFILLMENT"
        | "LISTING_REVIEW"
        | "DISPUTE"
        | "RATING"
        | "DOCUMENTATION"
        | "OPERATIONS"
        | "JOB";
      partner_score_status: "PROVISIONAL" | "ESTABLISHED";
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
      automatic_document_review_result: ["PASSED", "REVIEW_REQUIRED", "FAILED"],
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
      identity_verification_result: [
        "PENDING",
        "PASSED",
        "REVIEW_REQUIRED",
        "FAILED",
      ],
      inventory_movement_type: [
        "receipt",
        "adjustment",
        "reservation",
        "release",
        "sale",
        "return",
      ],
      inventory_reservation_status: [
        "ACTIVE",
        "COMMITTED",
        "RELEASED",
        "EXPIRED",
        "MANUAL_RECONCILIATION_REQUIRED",
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
      marketplace_acceptance_job_status: ["RUNNING", "COMPLETED"],
      marketplace_acceptance_status: [
        "PENDING",
        "BUYER_ACCEPTED",
        "AUTO_ACCEPTED",
        "PROBLEM_REPORTED",
      ],
      marketplace_claim_decision: [
        "APPROVED",
        "PARTIALLY_APPROVED",
        "REJECTED",
      ],
      marketplace_claim_evaluation_source: ["MANUAL", "AI", "HYBRID"],
      marketplace_claim_financial_effect: [
        "NONE",
        "FULL_REVERSAL",
        "PARTIAL_REVERSAL",
      ],
      marketplace_claim_reason: [
        "WRONG_ITEM",
        "CONDITION_NOT_AS_DESCRIBED",
        "UNDECLARED_DAMAGE",
        "COUNTERFEIT_SUSPECTED",
        "WRONG_SPECS",
        "NON_FUNCTIONAL",
        "OTHER_MANUAL_REVIEW",
      ],
      marketplace_claim_responsibility: [
        "PARTNER_RESPONSIBLE",
        "BUYER_NOT_SUPPORTED",
        "BEST_ROUND_OPERATIONAL",
        "INCONCLUSIVE",
        "NO_FAULT",
      ],
      marketplace_claim_status: [
        "OPEN",
        "UNDER_REVIEW",
        "EVIDENCE_REQUESTED",
        "PARTNER_RESPONSE_PENDING",
        "RETURN_REQUIRED",
        "RETURN_IN_TRANSIT",
        "RETURN_RECEIVED",
        "RESOLVED",
        "CANCELLED",
      ],
      marketplace_config_status: ["DRAFT", "PUBLISHED", "RETIRED"],
      marketplace_fulfillment_status: [
        "PENDING_CONFIRMATION",
        "CONFIRMED",
        "PREPARING",
        "READY_FOR_CARRIER",
        "SHIPPED",
        "DELIVERED",
        "ACCEPTANCE_PENDING",
        "COMPLETED",
        "CANCELLED",
        "ON_HOLD",
      ],
      marketplace_inventory_movement_type: [
        "INITIAL",
        "SET_QUANTITY",
        "RESERVE",
        "RELEASE",
        "SALE",
        "RETURN",
        "ADJUSTMENT",
      ],
      marketplace_listing_custody: ["PARTNER_CUSTODY", "BEST_ROUND_CUSTODY"],
      marketplace_listing_evaluation_source: ["HUMAN", "AI", "HYBRID"],
      marketplace_listing_evaluation_status: [
        "NOT_STARTED",
        "PENDING",
        "COMPLETED",
        "FAILED",
      ],
      marketplace_listing_fulfillment: [
        "PARTNER_FULFILLED",
        "BEST_ROUND_FULFILLED",
      ],
      marketplace_listing_image_requirement: [
        "REQUIRED",
        "RECOMMENDED",
        "OPTIONAL",
      ],
      marketplace_listing_ownership: ["PARTNER_OWNED"],
      marketplace_listing_review_area: [
        "PHOTOS",
        "SPECS",
        "CONDITION",
        "DESCRIPTION",
        "PRODUCT_IDENTITY",
        "QUANTITY",
        "OTHER",
      ],
      marketplace_listing_review_request_status: ["OPEN", "RESOLVED"],
      marketplace_listing_review_visibility: ["INTERNAL", "PARTNER_VISIBLE"],
      marketplace_listing_status: [
        "DRAFT",
        "SUBMITTED",
        "UNDER_REVIEW",
        "CHANGES_REQUESTED",
        "APPROVED",
        "PUBLISHED",
        "PAUSED",
        "SOLD",
        "REJECTED",
        "EXPIRED",
        "ARCHIVED",
      ],
      marketplace_listing_version_state: [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
      ],
      marketplace_market_analysis_source: [
        "PROVIDER",
        "MANUAL",
        "HYBRID",
        "AI",
      ],
      marketplace_market_analysis_status: [
        "REQUESTED",
        "COMPLETE",
        "INSUFFICIENT_DATA",
        "PROVIDER_UNAVAILABLE",
        "FAILED",
        "STALE",
      ],
      marketplace_market_confidence: ["HIGH", "MEDIUM", "LOW", "INSUFFICIENT"],
      marketplace_order_exception_status: [
        "NONE",
        "ON_HOLD",
        "PARTIAL_EXCEPTION",
        "MANUAL_RECONCILIATION_REQUIRED",
      ],
      marketplace_partner_finance_actor_source: [
        "PAYMENT",
        "SYSTEM",
        "OPERATIONS",
        "RISK",
        "CLAIM",
        "RECONCILIATION",
        "PAYOUT",
      ],
      marketplace_partner_hold_source: [
        "SYSTEM",
        "OPERATIONS",
        "RISK",
        "CLAIM",
        "RECONCILIATION",
      ],
      marketplace_partner_hold_status: ["ACTIVE", "RELEASED"],
      marketplace_partner_ledger_entry_type: [
        "PAYABLE_CREATED",
        "PAYABLE_HELD",
        "PAYABLE_HOLD_RELEASED",
        "PAYABLE_RELEASED",
        "PAYABLE_REVERSED",
        "PAYABLE_PAID",
        "PAYABLE_ADJUSTED",
      ],
      marketplace_partner_payable_status: [
        "PENDING",
        "ON_HOLD",
        "AVAILABLE",
        "PAID",
        "REVERSED",
      ],
      marketplace_partner_payout_event_type: [
        "PAYOUT_CREATED",
        "ITEM_ATTACHED",
        "ITEM_REMOVED",
        "PAYOUT_READY",
        "PAYOUT_HELD",
        "PAYOUT_HOLD_RELEASED",
        "TRANSFER_RECORDED",
        "PAYOUT_FAILED",
        "SETTLEMENT_CONFIRMED",
        "RECONCILIATION_REQUIRED",
        "PAYOUT_CANCELLED",
      ],
      marketplace_partner_payout_status: [
        "DRAFT",
        "READY",
        "ON_HOLD",
        "AWAITING_CONFIRMATION",
        "PAID",
        "FAILED",
        "CANCELLED",
        "RECONCILIATION_REQUIRED",
      ],
      marketplace_partner_release_basis: [
        "DELIVERY_ACCEPTED",
        "AUTO_ACCEPTED",
        "CLAIM_RESOLVED",
        "OPERATIONS_APPROVED",
      ],
      marketplace_partner_settlement_status: [
        "PENDING",
        "CONFIRMED",
        "FAILED",
        "RECONCILIATION_REQUIRED",
        "REVERSED_EXTERNALLY",
      ],
      marketplace_partner_tier: [
        "BOGEY",
        "PAR",
        "BIRDIE",
        "ALBATROSS",
        "HOLE_IN_ONE",
      ],
      marketplace_payout_batch_status: [
        "DRAFT",
        "READY",
        "COMPLETED",
        "CANCELLED",
      ],
      marketplace_payout_provider: [
        "MANUAL_BANK_TRANSFER",
        "STRIPE_CONNECT",
        "OTHER_PROVIDER",
      ],
      marketplace_price_viability: [
        "COMPETITIVE",
        "SLIGHTLY_HIGH",
        "OVERPRICED",
        "UNDERPRICED",
        "INSUFFICIENT_DATA",
      ],
      marketplace_pricing_input_mode: ["PUBLIC_PRICE_PRIORITY", "NET_PRIORITY"],
      marketplace_pricing_quote_status: [
        "DRAFT",
        "ANALYZED",
        "PARTNER_ACCEPTED",
        "UNDER_REVIEW",
        "CHANGES_REQUESTED",
        "APPROVED",
        "REJECTED",
        "SUPERSEDED",
        "EXPIRED",
      ],
      marketplace_refund_preparation_status: [
        "REFUND_NOT_REQUIRED",
        "REFUND_PENDING",
        "REFUND_PREPARED",
        "REFUND_REQUIRES_MANUAL_ACTION",
        "REFUND_COMPLETED",
      ],
      marketplace_return_requirement: [
        "NO_RETURN_REQUIRED",
        "RETURN_REQUIRED",
        "RETURN_WAIVED",
        "MANUAL_REVIEW",
      ],
      marketplace_return_shipping_responsibility: [
        "PARTNER_OR_BEST_ROUND",
        "BUYER",
        "MANUAL_REVIEW",
      ],
      marketplace_return_status: [
        "REQUESTED",
        "AUTHORIZED",
        "AWAITING_SHIPMENT",
        "IN_TRANSIT",
        "RECEIVED",
        "INSPECTING",
        "ACCEPTED",
        "REJECTED",
        "CLOSED",
      ],
      marketplace_score_job_status: ["RUNNING", "COMPLETED"],
      marketplace_tier_source: ["CALCULATED", "OVERRIDE"],
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
      order_fulfillment_source: ["BEST_ROUND", "PARTNER"],
      order_item_source: ["FIRST_PARTY", "MARKETPLACE_PARTNER"],
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
      partner_override_status: ["ACTIVE", "EXPIRED", "CLEARED"],
      partner_override_type: ["SCORE", "TIER"],
      partner_penalty_severity: ["MINOR", "MEDIUM", "MAJOR", "CRITICAL"],
      partner_penalty_status: ["ACTIVE", "EXPIRED", "CLEARED"],
      partner_risk_flag_status: ["OPEN", "RESOLVED"],
      partner_score_component: [
        "ORDER_COMPLETION",
        "SHIPPING_SLA",
        "AVAILABILITY",
        "LISTING_ACCURACY",
        "CLAIMS_RETURNS",
        "GOLFER_RATING",
        "DOCUMENTATION_TENURE",
      ],
      partner_score_event_source: [
        "ORDER",
        "FULFILLMENT",
        "LISTING_REVIEW",
        "DISPUTE",
        "RATING",
        "DOCUMENTATION",
        "OPERATIONS",
        "JOB",
      ],
      partner_score_status: ["PROVISIONAL", "ESTABLISHED"],
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
