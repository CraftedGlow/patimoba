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
      coupon_deliveries: {
        Row: {
          coupon_id: string
          id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_deliveries_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          store_id: string
          title: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          store_id: string
          title: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      bags: {
        Row: {
          capacity: number
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          product_ids: string[]
          store_id: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price?: number
          product_ids?: string[]
          store_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          product_ids?: string[]
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          auth_user_id: string | null
          budget_limit: number | null
          company_name: string
          created_at: string
          department: string
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          budget_limit?: number | null
          company_name: string
          created_at?: string
          department: string
          email: string
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          budget_limit?: number | null
          company_name?: string
          created_at?: string
          department?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      decoration_group_items: {
        Row: {
          decoration_id: string
          display_order: number
          group_id: string
          id: string
        }
        Insert: {
          decoration_id: string
          display_order?: number
          group_id: string
          id?: string
        }
        Update: {
          decoration_id?: string
          display_order?: number
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decoration_group_items_decoration_id_fkey"
            columns: ["decoration_id"]
            isOneToOne: false
            referencedRelation: "decorations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decoration_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "decoration_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      decoration_groups: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          max_selections: number | null
          name: string
          preparation_days: number | null
          required: boolean
          selection_type: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_selections?: number | null
          name: string
          preparation_days?: number | null
          required?: boolean
          selection_type?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          max_selections?: number | null
          name?: string
          preparation_days?: number | null
          required?: boolean
          selection_type?: string
          store_id?: string
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
      decorations: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_order: number
          excludes_categories: string[]
          id: string
          image_url: string | null
          is_active: boolean
          is_seasonal: boolean
          name: string
          preparation_days: number | null
          price: number
          season_end: string | null
          season_start: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          excludes_categories?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_seasonal?: boolean
          name: string
          preparation_days?: number | null
          price?: number
          season_end?: string | null
          season_start?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_order?: number
          excludes_categories?: string[]
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_seasonal?: boolean
          name?: string
          preparation_days?: number | null
          price?: number
          season_end?: string | null
          season_start?: string | null
          store_id?: string
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
      documents: {
        Row: {
          addressee: string
          created_at: string
          id: string
          invoice_number: string | null
          issued_at: string
          note: string | null
          order_id: string
          pdf_url: string | null
          type: string
        }
        Insert: {
          addressee?: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string
          note?: string | null
          order_id: string
          pdf_url?: string | null
          type: string
        }
        Update: {
          addressee?: string
          created_at?: string
          id?: string
          invoice_number?: string | null
          issued_at?: string
          note?: string | null
          order_id?: string
          pdf_url?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "machi_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      machi_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          shipped_at: string | null
          shipping_address_id: string
          store_id: string
          tracking_number: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          shipped_at?: string | null
          shipping_address_id: string
          store_id: string
          tracking_number?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          shipped_at?: string | null
          shipping_address_id?: string
          store_id?: string
          tracking_number?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "machi_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "machi_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machi_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machi_order_items_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "shipping_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machi_order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      machi_orders: {
        Row: {
          buyer_id: string
          cancel_fee_rate: number
          cancelled_at: string | null
          created_at: string
          id: string
          note: string | null
          payjp_charge_id: string | null
          payment_method: string
          quote_requested: boolean
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          cancel_fee_rate?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payjp_charge_id?: string | null
          payment_method?: string
          quote_requested?: boolean
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          cancel_fee_rate?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payjp_charge_id?: string | null
          payment_method?: string
          quote_requested?: boolean
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machi_orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      noshi: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          image_url: string | null
          name: string
          name_input_enabled: boolean
          price: number
          store_id: string
          supported_purposes: string[]
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          name_input_enabled?: boolean
          price?: number
          store_id: string
          supported_purposes?: string[]
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          name_input_enabled?: boolean
          price?: number
          store_id?: string
          supported_purposes?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "noshi_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
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
          customer_name_snapshot: string | null
          delivery_time_slot: string | null
          discount_amount: number | null
          fulfilled_at: string | null
          fulfilled_by: string | null
          fulfillment_status: string
          guest_email: string | null
          id: string
          notes: string | null
          order_no: string | null
          order_status: string
          order_type: string
          ordered_at: string | null
          payjp_charge_id: string | null
          payment_method: string | null
          payment_status: string
          pickup_date: string | null
          pickup_time: string | null
          print_photo_url: string | null
          service_notification_token: string | null
          shipping_address: string | null
          shipping_building: string | null
          shipping_city: string | null
          shipping_fee: number
          shipping_postal_code: string | null
          shipping_prefecture: string | null
          source_liff_id: string | null
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
          customer_name_snapshot?: string | null
          delivery_time_slot?: string | null
          discount_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          guest_email?: string | null
          id?: string
          notes?: string | null
          order_no?: string | null
          order_status?: string
          order_type?: string
          ordered_at?: string | null
          payjp_charge_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_date?: string | null
          pickup_time?: string | null
          print_photo_url?: string | null
          service_notification_token?: string | null
          shipping_address?: string | null
          shipping_building?: string | null
          shipping_city?: string | null
          shipping_fee?: number
          shipping_postal_code?: string | null
          shipping_prefecture?: string | null
          source_liff_id?: string | null
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
          customer_name_snapshot?: string | null
          delivery_time_slot?: string | null
          discount_amount?: number | null
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          fulfillment_status?: string
          guest_email?: string | null
          id?: string
          notes?: string | null
          order_no?: string | null
          order_status?: string
          order_type?: string
          ordered_at?: string | null
          payjp_charge_id?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_date?: string | null
          pickup_time?: string | null
          print_photo_url?: string | null
          service_notification_token?: string | null
          shipping_address?: string | null
          shipping_building?: string | null
          shipping_city?: string | null
          shipping_fee?: number
          shipping_postal_code?: string | null
          shipping_prefecture?: string | null
          source_liff_id?: string | null
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
      payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_item_id: string
          paid_at: string | null
          status: string
          store_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_item_id: string
          paid_at?: string | null
          status?: string
          store_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_item_id?: string
          paid_at?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "machi_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          created_at: string
          delete_token: string
          id: string
          markup: string
          order_id: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          delete_token?: string
          id?: string
          markup: string
          order_id?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          delete_token?: string
          id?: string
          markup?: string
          order_id?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_jobs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_decoration_groups: {
        Row: {
          display_order: number
          group_id: string
          id: string
          product_id: string
        }
        Insert: {
          display_order?: number
          group_id: string
          id?: string
          product_id: string
        }
        Update: {
          display_order?: number
          group_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_decoration_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "decoration_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_decoration_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_store_overrides: {
        Row: {
          available_days_of_month: number[] | null
          created_at: string
          daily_max_quantity: number | null
          id: string
          is_active: boolean | null
          payment_method_restriction: string | null
          preparation_days: number | null
          price_max: number | null
          price_min: number | null
          product_id: string
          same_day_order_allowed: boolean | null
          store_id: string
          updated_at: string
        }
        Insert: {
          available_days_of_month?: number[] | null
          created_at?: string
          daily_max_quantity?: number | null
          id?: string
          is_active?: boolean | null
          payment_method_restriction?: string | null
          preparation_days?: number | null
          price_max?: number | null
          price_min?: number | null
          product_id: string
          same_day_order_allowed?: boolean | null
          store_id: string
          updated_at?: string
        }
        Update: {
          available_days_of_month?: number[] | null
          created_at?: string
          daily_max_quantity?: number | null
          id?: string
          is_active?: boolean | null
          payment_method_restriction?: string | null
          preparation_days?: number | null
          price_max?: number | null
          price_min?: number | null
          product_id?: string
          same_day_order_allowed?: boolean | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_store_overrides_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_store_overrides_store_id_fkey"
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
          allergens: string[] | null
          available_days_of_month: number[] | null
          base_price: number
          best_before_days: number | null
          category_name: string | null
          content_quantity: string | null
          created_at: string
          cross_section_image: string | null
          custom_options: Json
          daily_max_quantity: number | null
          days_before_order_deadline: number
          description: string | null
          display_order: number | null
          has_gift_wrapping: boolean
          id: string
          image: string | null
          images: string[] | null
          ingredients: string | null
          is_active: boolean
          is_ec: boolean
          is_preorder_required: boolean | null
          is_published: boolean
          is_takeout: boolean
          limited_from: string | null
          limited_until: string | null
          min_order_lead_minutes: number | null
          name: string
          noshi_enabled: boolean
          noshi_ids: string[]
          payment_method_restriction: string | null
          preparation_days: number | null
          price_max: number | null
          price_min: number | null
          print_decoration_enabled: boolean
          same_day_order_allowed: boolean | null
          shipping_method: string | null
          stock: number
          storage_method: string | null
          store_id: string
          tags: Json | null
          tax_type: string | null
          updated_at: string
        }
        Insert: {
          allergens?: string[] | null
          available_days_of_month?: number[] | null
          base_price?: number
          best_before_days?: number | null
          category_name?: string | null
          content_quantity?: string | null
          created_at?: string
          cross_section_image?: string | null
          custom_options?: Json
          daily_max_quantity?: number | null
          days_before_order_deadline?: number
          description?: string | null
          display_order?: number | null
          has_gift_wrapping?: boolean
          id?: string
          image?: string | null
          images?: string[] | null
          ingredients?: string | null
          is_active?: boolean
          is_ec?: boolean
          is_preorder_required?: boolean | null
          is_published?: boolean
          is_takeout?: boolean
          limited_from?: string | null
          limited_until?: string | null
          min_order_lead_minutes?: number | null
          name?: string
          noshi_enabled?: boolean
          noshi_ids?: string[]
          payment_method_restriction?: string | null
          preparation_days?: number | null
          price_max?: number | null
          price_min?: number | null
          print_decoration_enabled?: boolean
          same_day_order_allowed?: boolean | null
          shipping_method?: string | null
          stock?: number
          storage_method?: string | null
          store_id: string
          tags?: Json | null
          tax_type?: string | null
          updated_at?: string
        }
        Update: {
          allergens?: string[] | null
          available_days_of_month?: number[] | null
          base_price?: number
          best_before_days?: number | null
          category_name?: string | null
          content_quantity?: string | null
          created_at?: string
          cross_section_image?: string | null
          custom_options?: Json
          daily_max_quantity?: number | null
          days_before_order_deadline?: number
          description?: string | null
          display_order?: number | null
          has_gift_wrapping?: boolean
          id?: string
          image?: string | null
          images?: string[] | null
          ingredients?: string | null
          is_active?: boolean
          is_ec?: boolean
          is_preorder_required?: boolean | null
          is_published?: boolean
          is_takeout?: boolean
          limited_from?: string | null
          limited_until?: string | null
          min_order_lead_minutes?: number | null
          name?: string
          noshi_enabled?: boolean
          noshi_ids?: string[]
          payment_method_restriction?: string | null
          preparation_days?: number | null
          price_max?: number | null
          price_min?: number | null
          print_decoration_enabled?: boolean
          same_day_order_allowed?: boolean | null
          shipping_method?: string | null
          stock?: number
          storage_method?: string | null
          store_id?: string
          tags?: Json | null
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
      shipping_addresses: {
        Row: {
          address: string
          buyer_id: string
          created_at: string
          id: string
          label: string | null
          postal_code: string
          recipient_name: string
        }
        Insert: {
          address: string
          buyer_id: string
          created_at?: string
          id?: string
          label?: string | null
          postal_code: string
          recipient_name: string
        }
        Update: {
          address?: string
          buyer_id?: string
          created_at?: string
          id?: string
          label?: string | null
          postal_code?: string
          recipient_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_addresses_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rate_regions: {
        Row: {
          destination_region: string
          fee: number
          id: string
          origin_region: string
          updated_at: string
        }
        Insert: {
          destination_region: string
          fee: number
          id?: string
          origin_region: string
          updated_at?: string
        }
        Update: {
          destination_region?: string
          fee?: number
          id?: string
          origin_region?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_business_hours: {
        Row: {
          close_time: string | null
          closed_week_rule: string | null
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
          closed_week_rule?: string | null
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
          closed_week_rule?: string | null
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
      store_shipping_rate_overrides: {
        Row: {
          created_at: string
          destination_region: string
          fee: number
          id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_region: string
          fee: number
          id?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_region?: string
          fee?: number
          id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shipping_rate_overrides_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shipping_settings: {
        Row: {
          created_at: string
          flat_fee: number
          free_shipping_enabled: boolean
          free_shipping_excludes_special_regions: boolean
          free_shipping_threshold: number | null
          id: string
          mode: string
          origin_region: string | null
          remote_surcharge: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flat_fee?: number
          free_shipping_enabled?: boolean
          free_shipping_excludes_special_regions?: boolean
          free_shipping_threshold?: number | null
          id?: string
          mode?: string
          origin_region?: string | null
          remote_surcharge?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flat_fee?: number
          free_shipping_enabled?: boolean
          free_shipping_excludes_special_regions?: boolean
          free_shipping_threshold?: number | null
          id?: string
          mode?: string
          origin_region?: string | null
          remote_surcharge?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shipping_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
          accepts_walkin: boolean
          address: string | null
          area: string | null
          blackout_periods: Json | null
          building: string | null
          category: string | null
          created_at: string
          description: string | null
          ec_background_color: string | null
          ec_button_color: string | null
          ec_header_color: string | null
          email: string | null
          holiday_close_time: string | null
          holiday_open_time: string | null
          id: string
          image: string | null
          images: string[] | null
          invoice_num: string | null
          invoice_number: string | null
          is_active: boolean
          is_corporate_ready: boolean
          anniversary_reminder_enabled: boolean
          is_dev_only: boolean
          is_master: boolean
          is_published: boolean
          liff_id: string | null
          line_channel_access_token: string | null
          line_channel_secret: string | null
          line_official_account_id: string | null
          logo_url: string | null
          name: string
          parent_store_id: string | null
          phone: string | null
          plan: string
          plan_options: Json | null
          postal_code: string | null
          privacy_policy_text: string | null
          slug: string | null
          tenant_id: string | null
          tokusho_text: string | null
          updated_at: string
        }
        Insert: {
          accepts_walkin?: boolean
          address?: string | null
          area?: string | null
          blackout_periods?: Json | null
          building?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          ec_background_color?: string | null
          ec_button_color?: string | null
          ec_header_color?: string | null
          email?: string | null
          holiday_close_time?: string | null
          holiday_open_time?: string | null
          id?: string
          image?: string | null
          images?: string[] | null
          anniversary_reminder_enabled?: boolean
          invoice_num?: string | null
          invoice_number?: string | null
          is_active?: boolean
          is_corporate_ready?: boolean
          is_dev_only?: boolean
          is_master?: boolean
          is_published?: boolean
          liff_id?: string | null
          line_channel_access_token?: string | null
          line_channel_secret?: string | null
          line_official_account_id?: string | null
          logo_url?: string | null
          name?: string
          parent_store_id?: string | null
          phone?: string | null
          plan?: string
          plan_options?: Json | null
          postal_code?: string | null
          privacy_policy_text?: string | null
          slug?: string | null
          tenant_id?: string | null
          tokusho_text?: string | null
          updated_at?: string
        }
        Update: {
          accepts_walkin?: boolean
          address?: string | null
          anniversary_reminder_enabled?: boolean
          area?: string | null
          blackout_periods?: Json | null
          building?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          ec_background_color?: string | null
          ec_button_color?: string | null
          ec_header_color?: string | null
          email?: string | null
          holiday_close_time?: string | null
          holiday_open_time?: string | null
          id?: string
          image?: string | null
          images?: string[] | null
          invoice_num?: string | null
          invoice_number?: string | null
          is_active?: boolean
          is_corporate_ready?: boolean
          is_dev_only?: boolean
          is_master?: boolean
          is_published?: boolean
          liff_id?: string | null
          line_channel_access_token?: string | null
          line_channel_secret?: string | null
          line_official_account_id?: string | null
          logo_url?: string | null
          name?: string
          parent_store_id?: string | null
          phone?: string | null
          plan?: string
          plan_options?: Json | null
          postal_code?: string | null
          privacy_policy_text?: string | null
          slug?: string | null
          tenant_id?: string | null
          tokusho_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_parent_store_id_fkey"
            columns: ["parent_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
          address: string | null
          anniversaries: Json
          auth_user_id: string | null
          avatar_url: string | null
          birth_date: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          gender: string | null
          id: string
          liff_id: string | null
          line_name: string | null
          line_user_id: string | null
          name: string
          name_kana: string | null
          pending_tds_token: string | null
          phone: string | null
          points: number
          postal_code: string | null
          status: string
          updated_at: string
          user_type: string
        }
        Insert: {
          address?: string | null
          anniversaries?: Json
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          liff_id?: string | null
          line_name?: string | null
          line_user_id?: string | null
          name?: string
          name_kana?: string | null
          pending_tds_token?: string | null
          phone?: string | null
          points?: number
          postal_code?: string | null
          status?: string
          updated_at?: string
          user_type?: string
        }
        Update: {
          address?: string | null
          anniversaries?: Json
          auth_user_id?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          gender?: string | null
          id?: string
          liff_id?: string | null
          line_name?: string | null
          line_user_id?: string | null
          name?: string
          name_kana?: string | null
          pending_tds_token?: string | null
          phone?: string | null
          points?: number
          postal_code?: string | null
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
      current_app_user_id: { Args: never; Returns: string }
      is_app_admin: { Args: never; Returns: boolean }
      is_store_member: { Args: { p_store_id: string }; Returns: boolean }
      is_store_member_or_master: {
        Args: { p_store_id: string }
        Returns: boolean
      }
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
