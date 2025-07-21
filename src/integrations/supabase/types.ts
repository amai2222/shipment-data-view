export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      drivers: {
        Row: {
          created_at: string
          id: string
          license_plate: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          id?: string
          license_plate: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          id?: string
          license_plate?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      logistics_partner_costs: {
        Row: {
          base_amount: number
          created_at: string
          id: string
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          tax_rate: number
        }
        Insert: {
          base_amount: number
          created_at?: string
          id?: string
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          tax_rate: number
        }
        Update: {
          base_amount?: number
          created_at?: string
          id?: string
          level?: number
          logistics_record_id?: string
          partner_id?: string
          payable_amount?: number
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "logistics_partner_costs_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_partner_costs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_records: {
        Row: {
          auto_number: string
          chain_id: string | null
          created_at: string
          created_by_user_id: string
          current_cost: number | null
          driver_id: string | null
          driver_name: string
          driver_phone: string
          extra_cost: number | null
          id: string
          license_plate: string
          loading_date: string
          loading_location: string
          loading_weight: number | null
          payable_cost: number | null
          project_id: string | null
          project_name: string
          remarks: string | null
          transport_type: string
          unloading_date: string | null
          unloading_location: string
          unloading_weight: number | null
        }
        Insert: {
          auto_number: string
          chain_id?: string | null
          created_at?: string
          created_by_user_id: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name: string
          driver_phone: string
          extra_cost?: number | null
          id?: string
          license_plate: string
          loading_date: string
          loading_location: string
          loading_weight?: number | null
          payable_cost?: number | null
          project_id?: string | null
          project_name: string
          remarks?: string | null
          transport_type: string
          unloading_date?: string | null
          unloading_location: string
          unloading_weight?: number | null
        }
        Update: {
          auto_number?: string
          chain_id?: string | null
          created_at?: string
          created_by_user_id?: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name?: string
          driver_phone?: string
          extra_cost?: number | null
          id?: string
          license_plate?: string
          loading_date?: string
          loading_location?: string
          loading_weight?: number | null
          payable_cost?: number | null
          project_id?: string | null
          project_name?: string
          remarks?: string | null
          transport_type?: string
          unloading_date?: string | null
          unloading_location?: string
          unloading_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_records_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_records_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "logistics_records_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_chains: {
        Row: {
          chain_name: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          project_id: string
        }
        Insert: {
          chain_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          project_id: string
        }
        Update: {
          chain_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_chains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          created_at: string
          id: string
          name: string
          tax_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tax_rate: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tax_rate?: number
        }
        Relationships: []
      }
      project_partners: {
        Row: {
          calculation_method: string | null
          chain_id: string
          created_at: string
          id: string
          level: number
          partner_id: string
          profit_rate: number | null
          project_id: string
          tax_rate: number
        }
        Insert: {
          calculation_method?: string | null
          chain_id: string
          created_at?: string
          id?: string
          level: number
          partner_id: string
          profit_rate?: number | null
          project_id: string
          tax_rate?: number
        }
        Update: {
          calculation_method?: string | null
          chain_id?: string
          created_at?: string
          id?: string
          level?: number
          partner_id?: string
          profit_rate?: number | null
          project_id?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_partners_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "partner_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_partners_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          auto_code: string | null
          created_at: string
          end_date: string
          id: string
          loading_address: string
          manager: string
          name: string
          start_date: string
          unloading_address: string
        }
        Insert: {
          auto_code?: string | null
          created_at?: string
          end_date: string
          id?: string
          loading_address: string
          manager: string
          name: string
          start_date: string
          unloading_address: string
        }
        Update: {
          auto_code?: string | null
          created_at?: string
          end_date?: string
          id?: string
          loading_address?: string
          manager?: string
          name?: string
          start_date?: string
          unloading_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_partner_costs: {
        Args: { p_base_amount: number; p_project_id: string }
        Returns: {
          partner_id: string
          partner_name: string
          level: number
          base_amount: number
          payable_amount: number
          tax_rate: number
        }[]
      }
      calculate_partner_costs_v2: {
        Args: {
          p_base_amount: number
          p_project_id: string
          p_loading_weight?: number
          p_unloading_weight?: number
        }
        Returns: {
          partner_id: string
          partner_name: string
          level: number
          base_amount: number
          payable_amount: number
          tax_rate: number
          calculation_method: string
          profit_rate: number
        }[]
      }
      generate_auto_number: {
        Args: { loading_date_input: string }
        Returns: string
      }
      generate_project_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      save_project_with_chains: {
        Args: { project_id_in: string; project_data: Json; chains_data: Json }
        Returns: undefined
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
