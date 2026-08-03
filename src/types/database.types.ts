export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          archived_at: string | null;
          city: string;
          country_code: string;
          created_at: string;
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
        };
        Insert: {
          archived_at?: string | null;
          city: string;
          country_code?: string;
          created_at?: string;
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
        };
        Update: {
          archived_at?: string | null;
          city?: string;
          country_code?: string;
          created_at?: string;
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
          cancelled_at: string | null;
          cancelled_by: string | null;
          cancellation_reason: string | null;
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
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
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
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cancellation_reason?: string | null;
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
            foreignKeyName: "orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_updated_by_fkey";
            columns: ["updated_by"];
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
          requested_reference_id?: string | null;
          requested_reference_type?: string | null;
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
      can_create_catalog_base_variant: {
        Args: {
          requested_name: string;
          requested_product_id: string;
          requested_sku: string;
        };
        Returns: boolean;
      };
      can_manage_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      can_manage_catalog_references: {
        Args: {
          requested_brand_id: string;
          requested_category_id: string;
        };
        Returns: boolean;
      };
      can_manage_orders: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
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
      change_customer_cart: {
        Args: {
          expected_version: number;
          requested_cart_item_id: string;
          requested_idempotency_key: string;
          requested_operation: string;
          requested_quantity: number;
        };
        Returns: { cart_id: string; replayed: boolean; version: number }[];
      };
      clear_customer_cart: {
        Args: { expected_version: number; requested_idempotency_key: string };
        Returns: { cart_id: string; replayed: boolean; version: number }[];
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
      create_customer_checkout_order: {
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
      };
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
      create_manual_order: {
        Args: { requested_idempotency_key: string; requested_payload: Json };
        Returns: {
          order_id: string;
          order_number: string;
          replayed: boolean;
        }[];
      };
      create_product_with_base_variant: {
        Args: {
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: number | null;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_currency: string;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: number;
          requested_price_is_estimate: boolean;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
      };
      get_customer_cart: { Args: Record<PropertyKey, never>; Returns: Json };
      get_customer_order: {
        Args: { requested_order_id: string };
        Returns: Json;
      };
      get_customer_shipping_method: {
        Args: Record<PropertyKey, never>;
        Returns: {
          base_price: number;
          currency: string;
          description: string | null;
          name: string;
          shipping_method_id: string;
        }[];
      };
      list_customer_orders: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          currency: string;
          discount_total: number;
          id: string;
          order_number: string;
          payment_method: Database["public"]["Enums"]["manual_payment_method"];
          payment_status: Database["public"]["Enums"]["manual_payment_status"];
          shipping_address_snapshot: Json;
          shipping_total: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
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
      update_manual_order_draft: {
        Args: {
          expected_version: number;
          requested_order_id: string;
          requested_payload: Json;
        };
        Returns: { order_id: string; version: number }[];
      };
      update_manual_order_payment: {
        Args: {
          expected_version: number;
          requested_method: Database["public"]["Enums"]["manual_payment_method"];
          requested_order_id: string;
          requested_status: Database["public"]["Enums"]["manual_payment_status"];
        };
        Returns: { order_id: string; version: number }[];
      };
      update_operational_order_payment: {
        Args: {
          expected_version: number;
          requested_method: Database["public"]["Enums"]["manual_payment_method"];
          requested_order_id: string;
          requested_status: Database["public"]["Enums"]["manual_payment_status"];
        };
        Returns: { order_id: string; version: number }[];
      };
      repair_product_base_variant: {
        Args: { requested_product_id: string };
        Returns: {
          created: boolean;
          product_id: string;
          variant_id: string;
        }[];
      };
      update_product_with_base_variant: {
        Args: {
          expected_published: boolean;
          expected_status: Database["public"]["Enums"]["product_status"];
          requested_brand_id: string;
          requested_category_id: string;
          requested_compare_at_price: number | null;
          requested_condition: Database["public"]["Enums"]["product_condition"];
          requested_condition_grade:
            Database["public"]["Enums"]["product_condition_grade"] | null;
          requested_condition_notes: string | null;
          requested_currency: string;
          requested_description: string | null;
          requested_featured: boolean;
          requested_fulfillment_type: Database["public"]["Enums"]["fulfillment_type"];
          requested_lead_time_max_days: number | null;
          requested_lead_time_min_days: number | null;
          requested_name: string;
          requested_price: number;
          requested_price_is_estimate: boolean;
          requested_product_id: string;
          requested_published: boolean;
          requested_short_description: string | null;
          requested_sku: string;
          requested_slug: string;
        };
        Returns: {
          product_id: string;
          variant_id: string;
        }[];
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
        Args: {
          requested_image_id: string;
          requested_product_id: string;
        };
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
        Args: {
          requested_image_ids: string[];
          requested_product_id: string;
        };
        Returns: boolean;
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
    };
    Enums: {
      advisory_request_status: "new" | "in_contact" | "resolved" | "closed";
      advisory_session_status: "active" | "completed" | "abandoned";
      cart_status: "active" | "converted" | "abandoned";
      catalog_record_status: "active" | "archived";
      contact_channel: "email" | "phone" | "whatsapp";
      fulfillment_type: "in_stock" | "special_order" | "preorder";
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
      order_origin: "manual" | "web";
      page_status: "draft" | "published" | "archived";
      product_condition: "new" | "used";
      product_condition_grade:
        "like_new" | "excellent" | "very_good" | "good" | "fair";
      product_status: "draft" | "active" | "archived";
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
  public: {
    Enums: {
      advisory_request_status: ["new", "in_contact", "resolved", "closed"],
      advisory_session_status: ["active", "completed", "abandoned"],
      cart_status: ["active", "converted", "abandoned"],
      catalog_record_status: ["active", "archived"],
      contact_channel: ["email", "phone", "whatsapp"],
      fulfillment_type: ["in_stock", "special_order", "preorder"],
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
      product_condition: ["new", "used"],
      product_condition_grade: [
        "like_new",
        "excellent",
        "very_good",
        "good",
        "fair",
      ],
      product_status: ["draft", "active", "archived"],
    },
  },
} as const;
