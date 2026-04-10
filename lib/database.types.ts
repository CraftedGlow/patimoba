export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      anniversary_registrations: {
        Row: {
          aniv_date: string | null
          created_date: string | null
          creater: string | null
          description: string | null
          id: number
          user_id: number | null
        }
        Insert: {
          aniv_date?: string | null
          created_date?: string | null
          creater?: string | null
          description?: string | null
          id?: never
          user_id?: number | null
        }
        Update: {
          aniv_date?: string | null
          created_date?: string | null
          creater?: string | null
          description?: string | null
          id?: never
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_anniversary_registrations_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_day_settings: {
        Row: {
          business_day: string | null
          created_date: string | null
          creater: string | null
          custom_close_date: string | null
          custom_open_date: string | null
          id: number
          is_open: boolean | null
          store_id: number | null
        }
        Insert: {
          business_day?: string | null
          created_date?: string | null
          creater?: string | null
          custom_close_date?: string | null
          custom_open_date?: string | null
          id?: never
          is_open?: boolean | null
          store_id?: number | null
        }
        Update: {
          business_day?: string | null
          created_date?: string | null
          creater?: string | null
          custom_close_date?: string | null
          custom_open_date?: string | null
          id?: never
          is_open?: boolean | null
          store_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_business_day_settings_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_lists: {
        Row: {
          created_date: string | null
          creater: string | null
          discount_price: number | null
          id: number
          name: string | null
          store_id: number | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          discount_price?: number | null
          id?: never
          name?: string | null
          store_id?: number | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          discount_price?: number | null
          id?: never
          name?: string | null
          store_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_coupon_lists_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customized_cake_candles: {
        Row: {
          created_date: string | null
          creater: string | null
          id: number
          price_per_candle: number | null
          product_id: number | null
          store_id: number | null
          types_of_candles: string | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          id?: never
          price_per_candle?: number | null
          product_id?: number | null
          store_id?: number | null
          types_of_candles?: string | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          id?: never
          price_per_candle?: number | null
          product_id?: number | null
          store_id?: number | null
          types_of_candles?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customized_cake_candles_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customized_cake_candles_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customized_cake_messages: {
        Row: {
          created_date: string | null
          creater: string | null
          id: number
          image: string | null
          product_id: number | null
          store_id: number | null
          type: string | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          id?: never
          image?: string | null
          product_id?: number | null
          store_id?: number | null
          type?: string | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          id?: never
          image?: string | null
          product_id?: number | null
          store_id?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customized_cake_messages_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customized_cake_messages_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customized_cake_options: {
        Row: {
          add_option: string | null
          add_option_flag: boolean | null
          created_date: string | null
          creater: string | null
          id: number
          image: string | null
          multiple_add_allowed: boolean | null
          option_name: string | null
          option_price: number | null
          product_id: number | null
          store_id: number | null
        }
        Insert: {
          add_option?: string | null
          add_option_flag?: boolean | null
          created_date?: string | null
          creater?: string | null
          id?: never
          image?: string | null
          multiple_add_allowed?: boolean | null
          option_name?: string | null
          option_price?: number | null
          product_id?: number | null
          store_id?: number | null
        }
        Update: {
          add_option?: string | null
          add_option_flag?: boolean | null
          created_date?: string | null
          creater?: string | null
          id?: never
          image?: string | null
          multiple_add_allowed?: boolean | null
          option_name?: string | null
          option_price?: number | null
          product_id?: number | null
          store_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customized_cake_options_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customized_cake_options_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      customized_cake_sizes: {
        Row: {
          cake_size: string | null
          cake_type_id: number | null
          created_date: string | null
          creater: string | null
          id: number
          size_price: number | null
          store_id: number | null
        }
        Insert: {
          cake_size?: string | null
          cake_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          size_price?: number | null
          store_id?: number | null
        }
        Update: {
          cake_size?: string | null
          cake_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          size_price?: number | null
          store_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customized_cake_sizes_cake_type_id"
            columns: ["cake_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customized_cake_sizes_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_addresses: {
        Row: {
          address: string | null
          building: string | null
          created_date: string | null
          creater: string | null
          first_name_kj: string | null
          first_name_kn: string | null
          id: number
          last_name_kj: string | null
          last_name_kn: string | null
          order_id: number | null
          phone_num: string | null
          street_num: string | null
          user_id: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          building?: string | null
          created_date?: string | null
          creater?: string | null
          first_name_kj?: string | null
          first_name_kn?: string | null
          id?: never
          last_name_kj?: string | null
          last_name_kn?: string | null
          order_id?: number | null
          phone_num?: string | null
          street_num?: string | null
          user_id?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          building?: string | null
          created_date?: string | null
          creater?: string | null
          first_name_kj?: string | null
          first_name_kn?: string | null
          id?: never
          last_name_kj?: string | null
          last_name_kn?: string | null
          order_id?: number | null
          phone_num?: string | null
          street_num?: string | null
          user_id?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_delivery_addresses_order_id"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_delivery_addresses_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      line_items: {
        Row: {
          cake_type_id: number | null
          created_at: string | null
          created_date: string | null
          creater: string | null
          id: number
          modified_date: string | null
          parent_order_id: number | null
          quantity: number | null
          store_id: number | null
          total_amount: number | null
          user_id: number | null
        }
        Insert: {
          cake_type_id?: number | null
          created_at?: string | null
          created_date?: string | null
          creater?: string | null
          id?: never
          modified_date?: string | null
          parent_order_id?: number | null
          quantity?: number | null
          store_id?: number | null
          total_amount?: number | null
          user_id?: number | null
        }
        Update: {
          cake_type_id?: number | null
          created_at?: string | null
          created_date?: string | null
          creater?: string | null
          id?: never
          modified_date?: string | null
          parent_order_id?: number | null
          quantity?: number | null
          store_id?: number | null
          total_amount?: number | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_line_items_parent_order_id"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_line_items_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_line_items_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lineitem_customized_cakes: {
        Row: {
          cake_size_id: number | null
          cake_type_id: number | null
          confirm: boolean | null
          created_date: string | null
          creater: string | null
          id: number
          message_plate: string | null
          parent_order_id: number | null
          print_cake_type_id: number | null
          print_image: number | null
          total_amount: number | null
          user_id: number | null
        }
        Insert: {
          cake_size_id?: number | null
          cake_type_id?: number | null
          confirm?: boolean | null
          created_date?: string | null
          creater?: string | null
          id?: never
          message_plate?: string | null
          parent_order_id?: number | null
          print_cake_type_id?: number | null
          print_image?: number | null
          total_amount?: number | null
          user_id?: number | null
        }
        Update: {
          cake_size_id?: number | null
          cake_type_id?: number | null
          confirm?: boolean | null
          created_date?: string | null
          creater?: string | null
          id?: never
          message_plate?: string | null
          parent_order_id?: number | null
          print_cake_type_id?: number | null
          print_image?: number | null
          total_amount?: number | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lineitem_customized_cakes_cake_size_id"
            columns: ["cake_size_id"]
            isOneToOne: false
            referencedRelation: "customized_cake_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_cakes_cake_type_id"
            columns: ["cake_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_cakes_parent_order_id"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_cakes_print_cake_type_id"
            columns: ["print_cake_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_cakes_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lineitem_customized_candles: {
        Row: {
          candle_count: number | null
          candle_number: number | null
          candle_price: number | null
          candle_type_id: number | null
          created_date: string | null
          creater: string | null
          id: number
          parent_cake_id: number | null
          parent_order_id: number | null
        }
        Insert: {
          candle_count?: number | null
          candle_number?: number | null
          candle_price?: number | null
          candle_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          parent_cake_id?: number | null
          parent_order_id?: number | null
        }
        Update: {
          candle_count?: number | null
          candle_number?: number | null
          candle_price?: number | null
          candle_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          parent_cake_id?: number | null
          parent_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lineitem_customized_candles_candle_type_id"
            columns: ["candle_type_id"]
            isOneToOne: false
            referencedRelation: "customized_cake_candles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_candles_parent_cake_id"
            columns: ["parent_cake_id"]
            isOneToOne: false
            referencedRelation: "lineitem_customized_cakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_candles_parent_order_id"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lineitem_customized_options: {
        Row: {
          created_date: string | null
          creater: string | null
          id: number
          message: string | null
          option_price: number | null
          option_type_id: number | null
          parent_cake_id: number | null
          parent_order_id: number | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          id?: never
          message?: string | null
          option_price?: number | null
          option_type_id?: number | null
          parent_cake_id?: number | null
          parent_order_id?: number | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          id?: never
          message?: string | null
          option_price?: number | null
          option_type_id?: number | null
          parent_cake_id?: number | null
          parent_order_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_lineitem_customized_options_option_type_id"
            columns: ["option_type_id"]
            isOneToOne: false
            referencedRelation: "customized_cake_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_options_parent_cake_id"
            columns: ["parent_cake_id"]
            isOneToOne: false
            referencedRelation: "lineitem_customized_cakes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_lineitem_customized_options_parent_order_id"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_customer_info: {
        Row: {
          address: string | null
          building: string | null
          card_id: string | null
          created_date: string | null
          creater: string | null
          first_name_kj: string | null
          first_name_kn: string | null
          id: number
          last_name_kj: string | null
          last_name_kn: string | null
          mail: string | null
          phone_num: string | null
          street_num: string | null
          user_id: number | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          building?: string | null
          card_id?: string | null
          created_date?: string | null
          creater?: string | null
          first_name_kj?: string | null
          first_name_kn?: string | null
          id?: never
          last_name_kj?: string | null
          last_name_kn?: string | null
          mail?: string | null
          phone_num?: string | null
          street_num?: string | null
          user_id?: number | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          building?: string | null
          card_id?: string | null
          created_date?: string | null
          creater?: string | null
          first_name_kj?: string | null
          first_name_kn?: string | null
          id?: never
          last_name_kj?: string | null
          last_name_kn?: string | null
          mail?: string | null
          phone_num?: string | null
          street_num?: string | null
          user_id?: number | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_order_customer_info_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_amount: number | null
          created_date: string | null
          creater: string | null
          delivery_address_id: number | null
          delivery_preference: boolean | null
          id: number
          is_custom: boolean | null
          is_web: boolean | null
          notes: string | null
          order_completed_at: string | null
          order_confirmed: boolean | null
          order_details_id: number | null
          payment_method: string | null
          pickup_time: string | null
          preparing: boolean | null
          same_day: boolean | null
          status: string | null
          store_id: number | null
          subtotal: number | null
          used_points: number | null
          user_id: number | null
          visit_date_time: string | null
        }
        Insert: {
          coupon_amount?: number | null
          created_date?: string | null
          creater?: string | null
          delivery_address_id?: number | null
          delivery_preference?: boolean | null
          id?: never
          is_custom?: boolean | null
          is_web?: boolean | null
          notes?: string | null
          order_completed_at?: string | null
          order_confirmed?: boolean | null
          order_details_id?: number | null
          payment_method?: string | null
          pickup_time?: string | null
          preparing?: boolean | null
          same_day?: boolean | null
          status?: string | null
          store_id?: number | null
          subtotal?: number | null
          used_points?: number | null
          user_id?: number | null
          visit_date_time?: string | null
        }
        Update: {
          coupon_amount?: number | null
          created_date?: string | null
          creater?: string | null
          delivery_address_id?: number | null
          delivery_preference?: boolean | null
          id?: never
          is_custom?: boolean | null
          is_web?: boolean | null
          notes?: string | null
          order_completed_at?: string | null
          order_confirmed?: boolean | null
          order_details_id?: number | null
          payment_method?: string | null
          pickup_time?: string | null
          preparing?: boolean | null
          same_day?: boolean | null
          status?: string | null
          store_id?: number | null
          subtotal?: number | null
          used_points?: number | null
          user_id?: number | null
          visit_date_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_orders_delivery_address_id"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_order_details_id"
            columns: ["order_details_id"]
            isOneToOne: false
            referencedRelation: "order_customer_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_orders_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      owned_coupon_lists: {
        Row: {
          coupon_type_id: number | null
          created_date: string | null
          creater: string | null
          id: number
          num: number | null
          user_id: number | null
        }
        Insert: {
          coupon_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          num?: number | null
          user_id?: number | null
        }
        Update: {
          coupon_type_id?: number | null
          created_date?: string | null
          creater?: string | null
          id?: never
          num?: number | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_owned_coupon_lists_coupon_type_id"
            columns: ["coupon_type_id"]
            isOneToOne: false
            referencedRelation: "coupon_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_owned_coupon_lists_user_id"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_registrations: {
        Row: {
          always_available: boolean | null
          created_date: string | null
          creater: string | null
          cur_same_day: boolean | null
          decoration: boolean | null
          descriprion: string | null
          description: string | null
          expiration_days: number | null
          id: number
          image: string | null
          ingredients: string | null
          is_ec: boolean | null
          max_per_day: number | null
          max_per_order: number | null
          name: string | null
          order_end_date: string | null
          order_start_date: string | null
          preparation_days: number | null
          price: number | null
          product_type_id: number | null
          shipping_type: string | null
          storage_type: string | null
          store_id: number | null
          whole_size: number[] | null
        }
        Insert: {
          always_available?: boolean | null
          created_date?: string | null
          creater?: string | null
          cur_same_day?: boolean | null
          decoration?: boolean | null
          descriprion?: string | null
          description?: string | null
          expiration_days?: number | null
          id?: never
          image?: string | null
          ingredients?: string | null
          is_ec?: boolean | null
          max_per_day?: number | null
          max_per_order?: number | null
          name?: string | null
          order_end_date?: string | null
          order_start_date?: string | null
          preparation_days?: number | null
          price?: number | null
          product_type_id?: number | null
          shipping_type?: string | null
          storage_type?: string | null
          store_id?: number | null
          whole_size?: number[] | null
        }
        Update: {
          always_available?: boolean | null
          created_date?: string | null
          creater?: string | null
          cur_same_day?: boolean | null
          decoration?: boolean | null
          descriprion?: string | null
          description?: string | null
          expiration_days?: number | null
          id?: never
          image?: string | null
          ingredients?: string | null
          is_ec?: boolean | null
          max_per_day?: number | null
          max_per_order?: number | null
          name?: string | null
          order_end_date?: string | null
          order_start_date?: string | null
          preparation_days?: number | null
          price?: number | null
          product_type_id?: number | null
          shipping_type?: string | null
          storage_type?: string | null
          store_id?: number | null
          whole_size?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_registrations_product_type_id"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_registrations_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_types: {
        Row: {
          created_date: string | null
          creater: string | null
          id: number
          product_type: string | null
          type_code: number | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          id?: never
          product_type?: string | null
          type_code?: number | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          id?: never
          product_type?: string | null
          type_code?: number | null
        }
        Relationships: []
      }
      shipping_fees: {
        Row: {
          created_date: string | null
          creater: string | null
          id: number
          max_distance: number | null
          min_distance: number | null
          price: number | null
        }
        Insert: {
          created_date?: string | null
          creater?: string | null
          id?: never
          max_distance?: number | null
          min_distance?: number | null
          price?: number | null
        }
        Update: {
          created_date?: string | null
          creater?: string | null
          id?: never
          max_distance?: number | null
          min_distance?: number | null
          price?: number | null
        }
        Relationships: []
      }
      stores: {
        Row: {
          address_url: string | null
          created_date: string | null
          creater: string | null
          default_close_time: string | null
          default_open_time: string | null
          delivery: boolean | null
          ec: boolean | null
          id: number
          image: string | null
          logo: string | null
          mail: string | null
          max_per_day: number | null
          max_per_order: number | null
          name: string | null
          notification: boolean | null
          phone_num: string | null
          plan: number | null
          specified_commercial_transaction: string | null
          tenant_id: string | null
        }
        Insert: {
          address_url?: string | null
          created_date?: string | null
          creater?: string | null
          default_close_time?: string | null
          default_open_time?: string | null
          delivery?: boolean | null
          ec?: boolean | null
          id?: never
          image?: string | null
          logo?: string | null
          mail?: string | null
          max_per_day?: number | null
          max_per_order?: number | null
          name?: string | null
          notification?: boolean | null
          phone_num?: string | null
          plan?: number | null
          specified_commercial_transaction?: string | null
          tenant_id?: string | null
        }
        Update: {
          address_url?: string | null
          created_date?: string | null
          creater?: string | null
          default_close_time?: string | null
          default_open_time?: string | null
          delivery?: boolean | null
          ec?: boolean | null
          id?: never
          image?: string | null
          logo?: string | null
          mail?: string | null
          max_per_day?: number | null
          max_per_order?: number | null
          name?: string | null
          notification?: boolean | null
          phone_num?: string | null
          plan?: number | null
          specified_commercial_transaction?: string | null
          tenant_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          allergies: string[] | null
          birthday: string | null
          building: string | null
          card_id: string | null
          created_at: string | null
          created_date: string | null
          creater: string | null
          creater_alt: string | null
          first_name_kn: string | null
          gender: string | null
          id: number
          is_locked: boolean | null
          last_name_kn: string | null
          last_purchase_date: string | null
          line_name: string | null
          line_user_id: string | null
          login_num: string | null
          password: string | null
          phone_num: string | null
          points: number | null
          rank: string | null
          selected_store_id: number | null
          store_id: number | null
          street_num: string | null
          total_purchase_amount: number | null
          user_type: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          allergies?: string[] | null
          birthday?: string | null
          building?: string | null
          card_id?: string | null
          created_at?: string | null
          created_date?: string | null
          creater?: string | null
          creater_alt?: string | null
          first_name_kn?: string | null
          gender?: string | null
          id?: never
          is_locked?: boolean | null
          last_name_kn?: string | null
          last_purchase_date?: string | null
          line_name?: string | null
          line_user_id?: string | null
          login_num?: string | null
          password?: string | null
          phone_num?: string | null
          points?: number | null
          rank?: string | null
          selected_store_id?: number | null
          store_id?: number | null
          street_num?: string | null
          total_purchase_amount?: number | null
          user_type?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          allergies?: string[] | null
          birthday?: string | null
          building?: string | null
          card_id?: string | null
          created_at?: string | null
          created_date?: string | null
          creater?: string | null
          creater_alt?: string | null
          first_name_kn?: string | null
          gender?: string | null
          id?: never
          is_locked?: boolean | null
          last_name_kn?: string | null
          last_purchase_date?: string | null
          line_name?: string | null
          line_user_id?: string | null
          login_num?: string | null
          password?: string | null
          phone_num?: string | null
          points?: number | null
          rank?: string | null
          selected_store_id?: number | null
          store_id?: number | null
          street_num?: string | null
          total_purchase_amount?: number | null
          user_type?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_selected_store_id"
            columns: ["selected_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_users_store_id"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
