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
          id: string;
          quantity: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          cart_id: string;
          created_at?: string;
          id?: string;
          quantity: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          cart_id?: string;
          created_at?: string;
          id?: string;
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
        };
        Insert: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          expires_at?: string | null;
          id?: string;
          status?: Database["public"]["Enums"]["cart_status"];
          updated_at?: string;
          user_id?: string;
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
          confirmed_at: string | null;
          created_at: string;
          currency: string;
          customer_note: string | null;
          discount_total: number;
          id: string;
          internal_note: string | null;
          order_number: string;
          shipping_address_id: string | null;
          shipping_address_snapshot: Json;
          shipping_method_id: string | null;
          shipping_total: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total: number;
          total: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_note?: string | null;
          discount_total?: number;
          id?: string;
          internal_note?: string | null;
          order_number: string;
          shipping_address_id?: string | null;
          shipping_address_snapshot: Json;
          shipping_method_id?: string | null;
          shipping_total?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          tax_total?: number;
          total: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          currency?: string;
          customer_note?: string | null;
          discount_total?: number;
          id?: string;
          internal_note?: string | null;
          order_number?: string;
          shipping_address_id?: string | null;
          shipping_address_snapshot?: Json;
          shipping_method_id?: string | null;
          shipping_total?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          tax_total?: number;
          total?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
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
