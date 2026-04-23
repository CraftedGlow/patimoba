export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      order_item_options: {
        Row: {
          created_at: string
          id: string
          option_group_name_snapshot: string | null
          option_item_name_snapshot: string | null
          order_item_id: string
          price_delta: number | null
          quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_group_name_snapshot?: string | null
          option_item_name_snapshot?: string | null
          order_item_id: string
          price_delta?: number | null
          quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          option_group_name_snapshot?: string | null
          option_item_name_snapshot?: string | null
          order_item_id?: string
          price_delta?: number | null
          quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_options_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name_snapshot: string
          product_variant_id: string | null
          quantity: number
          subtotal: number
          unit_price: number
          updated_at: string
          variant_name_snapshot: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name_snapshot?: string
          product_variant_id?: string | null
          quantity?: number
          subtotal?: number
          unit_price?: number
          updated_at?: string
          variant_name_snapshot?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name_snapshot?: string
          product_variant_id?: string | null
          quantity?: number
          subtotal?: number
          unit_price?: number
          updated_at?: string
          variant_name_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancel_deadline_at: string | null
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          discount_amount: number | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfillment_status: string
          id: string
          notes: string | null
          order_no: string | null
          order_status: string
          order_type: string
          ordered_at: string | null
          payment_status: string
          pickup_date: string | null
          pickup_time: string | null
          store_id: string
          subtotal: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          cancel_deadline_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_no?: string | null
          order_status?: string
          order_type?: string
          ordered_at?: string | null
          payment_status?: string
          pickup_date?: string | null
          pickup_time?: string | null
          store_id: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cancel_deadline_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          discount_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_no?: string | null
          order_status?: string
          order_type?: string
          ordered_at?: string | null
          payment_status?: string
          pickup_date?: string | null
          pickup_time?: string | null
          store_id?: string
          subtotal?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_fulfilled_by_fkey"
            columns: ["fulfilled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          name: string
          price: number
          product_id: string
          sku: string | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_price: number
          category_name: string | null
          created_at: string
          cross_section_image: string | null
          custom_options: Json
          daily_max_quantity: number | null
          description: string | null
          display_order: number | null
          id: string
          image: string | null
          is_active: boolean
          is_ec: boolean
          is_preorder_required: boolean | null
          is_takeout: boolean
          limited_from: string | null
          limited_until: string | null
          min_order_lead_minutes: number | null
          name: string
          preparation_days: number | null
          same_day_order_allowed: boolean | null
          store_id: string
          tax_type: string | null
          updated_at: string
        }
        Insert: {
          base_price?: number
          category_name?: string | null
          created_at?: string
          cross_section_image?: string | null
          custom_options?: Json
          daily_max_quantity?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          is_ec?: boolean
          is_preorder_required?: boolean | null
          is_takeout?: boolean
          limited_from?: string | null
          limited_until?: string | null
          min_order_lead_minutes?: number | null
          name?: string
          preparation_days?: number | null
          same_day_order_allowed?: boolean | null
          store_id: string
          tax_type?: string | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          category_name?: string | null
          created_at?: string
          cross_section_image?: string | null
          custom_options?: Json
          daily_max_quantity?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          is_ec?: boolean
          is_preorder_required?: boolean | null
          is_takeout?: boolean
          limited_from?: string | null
          limited_until?: string | null
          min_order_lead_minutes?: number | null
          name?: string
          preparation_days?: number | null
          same_day_order_allowed?: boolean | null
          store_id?: string
          tax_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      decorations: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          image_url: string | null
          category: string
          price: number
          is_active: boolean
          is_seasonal: boolean
          season_start: string | null
          season_end: string | null
          preparation_days: number | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          image_url?: string | null
          category?: string
          price?: number
          is_active?: boolean
          is_seasonal?: boolean
          season_start?: string | null
          season_end?: string | null
          preparation_days?: number | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          image_url?: string | null
          category?: string
          price?: number
          is_active?: boolean
          is_seasonal?: boolean
          season_start?: string | null
          season_end?: string | null
          preparation_days?: number | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decorations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      decoration_groups: {
        Row: {
          id: string
          store_id: string
          name: string
          description: string | null
          selection_type: string
          max_selections: number | null
          required: boolean
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          store_id: string
          name: string
          description?: string | null
          selection_type?: string
          max_selections?: number | null
          required?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          name?: string
          description?: string | null
          selection_type?: string
          max_selections?: number | null
          required?: boolean
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decoration_groups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      decoration_group_items: {
        Row: {
          id: string
          group_id: string
          decoration_id: string
          display_order: number
        }
        Insert: {
          id?: string
          group_id: string
          decoration_id: string
          display_order?: number
        }
        Update: {
          id?: string
          group_id?: string
          decoration_id?: string
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "decoration_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "decoration_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decoration_group_items_decoration_id_fkey"
            columns: ["decoration_id"]
            isOneToOne: false
            referencedRelation: "decorations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_decoration_groups: {
        Row: {
          id: string
          product_id: string
          group_id: string
          display_order: number
        }
        Insert: {
          id?: string
          product_id: string
          group_id: string
          display_order?: number
        }
        Update: {
          id?: string
          product_id?: string
          group_id?: string
          display_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_decoration_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_decoration_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "decoration_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      store_business_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          kitchen_cutoff_time: string | null
          open_time: string | null
          pickup_last_time: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          kitchen_cutoff_time?: string | null
          open_time?: string | null
          pickup_last_time?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          kitchen_cutoff_time?: string | null
          open_time?: string | null
          pickup_last_time?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_business_hours_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_rules: {
        Row: {
          created_at: string
          default_cutoff_time: string | null
          default_lead_time_minutes: number | null
          id: string
          max_future_days: number | null
          min_future_days: number | null
          pickup_interval_minutes: number | null
          same_day_order_allowed: boolean | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_cutoff_time?: string | null
          default_lead_time_minutes?: number | null
          id?: string
          max_future_days?: number | null
          min_future_days?: number | null
          pickup_interval_minutes?: number | null
          same_day_order_allowed?: boolean | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_cutoff_time?: string | null
          default_lead_time_minutes?: number | null
          id?: string
          max_future_days?: number | null
          min_future_days?: number | null
          pickup_interval_minutes?: number | null
          same_day_order_allowed?: boolean | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_order_rules_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_special_dates: {
        Row: {
          close_time: string | null
          created_at: string
          daily_note: string | null
          id: string
          is_closed: boolean
          kitchen_cutoff_time: string | null
          open_time: string | null
          pickup_last_time: string | null
          reason: string | null
          store_id: string
          target_date: string
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          daily_note?: string | null
          id?: string
          is_closed?: boolean
          kitchen_cutoff_time?: string | null
          open_time?: string | null
          pickup_last_time?: string | null
          reason?: string | null
          store_id: string
          target_date: string
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          daily_note?: string | null
          id?: string
          is_closed?: boolean
          kitchen_cutoff_time?: string | null
          open_time?: string | null
          pickup_last_time?: string | null
          reason?: string | null
          store_id?: string
          target_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_special_dates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_users: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          joined_at: string | null
          permission: string
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          permission?: string
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          joined_at?: string | null
          permission?: string
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_users_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          building: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          image: string | null
          is_active: boolean
          line_official_account_id: string | null
          logo_url: string | null
          name: string
          phone: string | null
          plan: string
          postal_code: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          building?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          line_official_account_id?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          building?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          image?: string | null
          is_active?: boolean
          line_official_account_id?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          plan?: string
          postal_code?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          role: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          role?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          anniversaries: Json
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          line_name: string | null
          line_user_id: string | null
          name: string
          name_kana: string | null
          phone: string | null
          points: number
          status: string
          updated_at: string
          user_type: string
        }
        Insert: {
          anniversaries?: Json
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          line_name?: string | null
          line_user_id?: string | null
          name?: string
          name_kana?: string | null
          phone?: string | null
          points?: number
          status?: string
          updated_at?: string
          user_type?: string
        }
        Update: {
          anniversaries?: Json
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          line_name?: string | null
          line_user_id?: string | null
          name?: string
          name_kana?: string | null
          phone?: string | null
          points?: number
          status?: string
          updated_at?: string
          user_type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
