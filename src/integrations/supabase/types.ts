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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      media: {
        Row: {
          alt_text: string | null
          created_at: string
          file_path: string
          file_type: string
          file_url: string
          id: string
          media_category: string
          reference_key: string | null
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_path: string
          file_type?: string
          file_url: string
          id?: string
          media_category: string
          reference_key?: string | null
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_path?: string
          file_type?: string
          file_url?: string
          id?: string
          media_category?: string
          reference_key?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          allergens: string[] | null
          badge_emoji: string | null
          badge_key: string | null
          badge_style: string | null
          category: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          allergens?: string[] | null
          badge_emoji?: string | null
          badge_key?: string | null
          badge_style?: string | null
          category: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          allergens?: string[] | null
          badge_emoji?: string | null
          badge_key?: string | null
          badge_style?: string | null
          category?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          item_description: string | null
          item_name: string
          order_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          id?: string
          item_description?: string | null
          item_name: string
          order_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          id?: string
          item_description?: string | null
          item_name?: string
          order_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_postal_code: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          id: string
          notes: string | null
          order_type: string
          payment_method: string
          payment_status: string
          pickup_store: string | null
          scheduled_for: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          total_amount: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          id?: string
          notes?: string | null
          order_type?: string
          payment_method?: string
          payment_status?: string
          pickup_store?: string | null
          scheduled_for?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_postal_code?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          notes?: string | null
          order_type?: string
          payment_method?: string
          payment_status?: string
          pickup_store?: string | null
          scheduled_for?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          allergies: string[] | null
          avg_spend: number | null
          city: string | null
          created_at: string
          favorite_table_area: string | null
          food_preferences: string | null
          full_name: string | null
          id: string
          internal_notes: string | null
          phone: string | null
          postal_code: string | null
          special_dates: Json | null
          updated_at: string
          user_id: string
          visit_count: number | null
        }
        Insert: {
          address?: string | null
          allergies?: string[] | null
          avg_spend?: number | null
          city?: string | null
          created_at?: string
          favorite_table_area?: string | null
          food_preferences?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          postal_code?: string | null
          special_dates?: Json | null
          updated_at?: string
          user_id: string
          visit_count?: number | null
        }
        Update: {
          address?: string | null
          allergies?: string[] | null
          avg_spend?: number | null
          city?: string | null
          created_at?: string
          favorite_table_area?: string | null
          food_preferences?: string | null
          full_name?: string | null
          id?: string
          internal_notes?: string | null
          phone?: string | null
          postal_code?: string | null
          special_dates?: Json | null
          updated_at?: string
          user_id?: string
          visit_count?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          created_at: string
          email: string
          guest_name: string
          guests: string
          id: string
          location: string
          notes: string | null
          phone: string
          reservation_date: string
          reservation_time: string
          status: string
          table_id: string | null
          table_ids: string[] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          guest_name: string
          guests?: string
          id?: string
          location: string
          notes?: string | null
          phone: string
          reservation_date: string
          reservation_time: string
          status?: string
          table_id?: string | null
          table_ids?: string[] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          guest_name?: string
          guests?: string
          id?: string
          location?: string
          notes?: string | null
          phone?: string
          reservation_date?: string
          reservation_time?: string
          status?: string
          table_id?: string | null
          table_ids?: string[] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string | null
          rating: number
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          message?: string | null
          rating: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string | null
          rating?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tables: {
        Row: {
          capacity: number
          created_at: string
          id: string
          is_active: boolean
          location: string
          name: string
          position_x: number
          position_y: number
          shape: string
        }
        Insert: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name: string
          position_x?: number
          position_y?: number
          shape?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          position_x?: number
          position_y?: number
          shape?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_available_table: {
        Args: {
          _date: string
          _guests: number
          _location: string
          _time: string
        }
        Returns: string
      }
      find_available_tables_multi: {
        Args: {
          _date: string
          _guests: number
          _location: string
          _time: string
        }
        Returns: string[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
