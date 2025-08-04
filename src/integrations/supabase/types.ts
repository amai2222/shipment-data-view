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
      driver_projects: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_projects_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          id: string
          license_plate: string
          name: string
          phone: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          license_plate: string
          name: string
          phone: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          license_plate?: string
          name?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_records: {
        Row: {
          created_at: string
          id: string
          invoice_amount: number
          invoice_date: string
          invoice_number: string | null
          logistics_record_id: string
          partner_id: string
          remarks: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_amount?: number
          invoice_date?: string
          invoice_number?: string | null
          logistics_record_id: string
          partner_id: string
          remarks?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          invoice_amount?: number
          invoice_date?: string
          invoice_number?: string | null
          logistics_record_id?: string
          partner_id?: string
          remarks?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_records_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_records_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      location_projects: {
        Row: {
          created_at: string
          id: string
          location_id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string | null
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
            foreignKeyName: "logistics_partner_costs_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
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
          driver_payable_cost: number | null
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
          user_id: string | null
        }
        Insert: {
          auto_number: string
          chain_id?: string | null
          created_at?: string
          created_by_user_id: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name: string
          driver_payable_cost?: number | null
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
          user_id?: string | null
        }
        Update: {
          auto_number?: string
          chain_id?: string | null
          created_at?: string
          created_by_user_id?: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name?: string
          driver_payable_cost?: number | null
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
          user_id?: string | null
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tax_rate: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tax_rate?: number
          user_id?: string | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          created_at: string
          id: string
          logistics_record_id: string
          partner_id: string
          payment_amount: number
          payment_date: string
          remarks: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logistics_record_id: string
          partner_id: string
          payment_amount?: number
          payment_date?: string
          remarks?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logistics_record_id?: string
          partner_id?: string
          payment_amount?: number
          payment_date?: string
          remarks?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          role: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string | null
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
          finance_manager: string | null
          id: string
          loading_address: string
          manager: string
          name: string
          project_status: string
          start_date: string
          unloading_address: string
          user_id: string | null
        }
        Insert: {
          auto_code?: string | null
          created_at?: string
          end_date: string
          finance_manager?: string | null
          id?: string
          loading_address: string
          manager: string
          name: string
          project_status?: string
          start_date: string
          unloading_address: string
          user_id?: string | null
        }
        Update: {
          auto_code?: string | null
          created_at?: string
          end_date?: string
          finance_manager?: string | null
          id?: string
          loading_address?: string
          manager?: string
          name?: string
          project_status?: string
          start_date?: string
          unloading_address?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      logistics_records_view: {
        Row: {
          any_text: string | null
          auto_number: string | null
          chain_id: string | null
          chain_name: string | null
          created_at: string | null
          created_by_user_id: string | null
          current_cost: number | null
          driver_id: string | null
          driver_name: string | null
          driver_payable_cost: number | null
          driver_phone: string | null
          extra_cost: number | null
          id: string | null
          license_plate: string | null
          loading_date: string | null
          loading_location: string | null
          loading_weight: number | null
          payable_cost: number | null
          project_id: string | null
          project_name: string | null
          remarks: string | null
          transport_type: string | null
          unloading_date: string | null
          unloading_location: string | null
          unloading_weight: number | null
          user_id: string | null
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
    }
    Functions: {
      add_logistics_record_with_costs: {
        Args: {
          p_project_id: string
          p_project_name: string
          p_chain_id: string
          p_driver_id: string
          p_driver_name: string
          p_loading_location: string
          p_unloading_location: string
          p_loading_date: string
          p_loading_weight: number
          p_unloading_weight: number
          p_current_cost: number
          p_license_plate: string
          p_driver_phone: string
          p_transport_type: string
          p_extra_cost: number
          p_remarks: string
          p_unloading_date: string
        }
        Returns: undefined
      }
      batch_import_logistics_records: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_recalculate_by_filter: {
        Args: {
          p_project_id: string
          p_partner_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: undefined
      }
      batch_recalculate_partner_costs: {
        Args: { p_record_ids: string[] }
        Returns: undefined
      }
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
        Args:
          | {
              p_base_amount: number
              p_project_id: string
              p_chain_id: string
              p_loading_weight: number
              p_unloading_weight: number
            }
          | {
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
      check_existing_waybills: {
        Args: {
          p_fingerprints: Database["public"]["CompositeTypes"]["waybill_fingerprint"][]
        }
        Returns: Database["public"]["CompositeTypes"]["waybill_fingerprint"][]
      }
      create_waybill_with_check: {
        Args: {
          p_project_name: string
          p_driver_name: string
          p_cooperative_partner: string
          p_license_plate: string
          p_loading_location: string
          p_unloading_location: string
          p_loading_date: string
          p_loading_weight: number
          p_unloading_weight: number
          p_freight_cost: number
          p_force_create?: boolean
        }
        Returns: Json
      }
      delete_records_by_project_name: {
        Args: { p_project_name: string }
        Returns: string
      }
      generate_auto_number: {
        Args: { loading_date_input: string }
        Returns: string
      }
      generate_project_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_dashboard_stats: {
        Args: {
          start_date_param: string
          end_date_param: string
          project_id_param?: string
        }
        Returns: Json
      }
      get_filtered_logistics_records: {
        Args: {
          p_project_id?: string
          p_driver_id?: string
          p_start_date?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          auto_number: string
          project_id: string
          project_name: string
          chain_id: string
          loading_date: string
          loading_location: string
          unloading_location: string
          driver_id: string
          driver_name: string
          license_plate: string
          driver_phone: string
          loading_weight: number
          unloading_date: string
          unloading_weight: number
          transport_type: string
          current_cost: number
          extra_cost: number
          payable_cost: number
          remarks: string
          created_at: string
          created_by_user_id: string
          total_count: number
        }[]
      }
      get_finance_reconciliation_data: {
        Args:
          | {
              p_project_id: string
              p_partner_id: string
              p_start_date: string
              p_end_date: string
              p_page_number: number
              p_page_size: number
            }
          | {
              p_project_id: string
              p_start_date: string
              p_end_date: string
              p_partner_id: string
            }
        Returns: Json
      }
      get_logistics_records_paginated: {
        Args:
          | {
              p_start_date: string
              p_end_date: string
              p_page_number: number
              p_page_size: number
              p_project_name?: string
              p_search_term?: string
            }
          | {
              p_start_date: string
              p_end_date: string
              p_project_name: string
              p_search_term: string
              p_page_number: number
              p_page_size: number
            }
        Returns: {
          id: string
          auto_number: string
          project_name: string
          driver_name: string
          loading_location: string
          unloading_location: string
          loading_date: string
          unloading_date: string
          loading_weight: number
          unloading_weight: number
          current_cost: number
          payable_cost: number
          license_plate: string
          cooperative_partner: string
          remarks: string
        }[]
      }
      get_logistics_summary_and_records: {
        Args: {
          p_start_date: string
          p_end_date: string
          p_project_name: string
          p_driver_name: string
          p_license_plate: string
          p_driver_phone: string
          p_page_number: number
          p_page_size: number
        }
        Returns: Json
      }
      get_or_create_driver: {
        Args: {
          p_driver_name: string
          p_license_plate: string
          p_phone: string
          p_project_id: string
        }
        Returns: {
          driver_id: string
          driver_name: string
        }[]
      }
      get_or_create_driver_and_link_project: {
        Args: {
          p_driver_name: string
          p_license_plate: string
          p_phone: string
          p_project_id: string
          p_user_id?: string
        }
        Returns: string
      }
      get_or_create_driver_with_project: {
        Args: {
          p_driver_name: string
          p_license_plate: string
          p_phone: string
          p_project_id: string
        }
        Returns: {
          driver_id: string
          driver_name: string
        }[]
      }
      get_or_create_location: {
        Args: { p_location_name: string; p_project_id: string }
        Returns: string
      }
      get_or_create_location_and_link_project: {
        Args: {
          p_location_name: string
          p_project_id: string
          p_user_id?: string
        }
        Returns: undefined
      }
      get_or_create_location_with_project: {
        Args: { p_location_name: string; p_project_id: string }
        Returns: string
      }
      get_paginated_logistics_records: {
        Args: {
          p_page_size: number
          p_offset: number
          p_start_date?: string
          p_end_date?: string
          p_search_query?: string
        }
        Returns: Json
      }
      get_paginated_logistics_records_with_filters: {
        Args: {
          p_page_size: number
          p_offset: number
          p_start_date?: string
          p_end_date?: string
          p_search_query?: string
          p_project_id?: string
        }
        Returns: Json
      }
      get_partner_payables_summary: {
        Args: {
          p_project_id?: string
          p_start_date?: string
          p_end_date?: string
          p_partner_id?: string
        }
        Returns: {
          partner_id: string
          partner_name: string
          level: number
          total_payable: number
          records_count: number
        }[]
      }
      get_project_drivers_with_details: {
        Args: { p_project_id: string }
        Returns: {
          driver_id: string
          driver_name: string
          license_plate: string
          phone: string
        }[]
      }
      get_projects_with_details: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_projects_with_details_optimized: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      preview_import_with_duplicates_check: {
        Args: { p_records: Json }
        Returns: Json
      }
      recalculate_and_update_costs_for_record: {
        Args: { p_record_id: string }
        Returns: undefined
      }
      save_project_addresses_to_locations: {
        Args: {
          p_project_id: string
          p_loading_address: string
          p_unloading_address: string
        }
        Returns: undefined
      }
      save_project_with_chains: {
        Args: { project_id_in: string; project_data: Json; chains_data: Json }
        Returns: undefined
      }
      search_project_linked_items: {
        Args: {
          p_project_id: string
          p_item_type: string
          p_search_term: string
        }
        Returns: Json
      }
      update_logistics_record_with_costs: {
        Args:
          | {
              p_record_id: string
              p_project_id: string
              p_project_name: string
              p_chain_id: string
              p_driver_id: string
              p_driver_name: string
              p_loading_location: string
              p_unloading_location: string
              p_loading_date: string
              p_loading_weight: number
              p_unloading_weight: number
              p_current_cost: number
              p_license_plate: string
              p_driver_phone: string
              p_transport_type: string
              p_extra_cost: number
              p_driver_payable_cost: number
              p_remarks: string
            }
          | {
              p_record_id: string
              p_project_id: string
              p_project_name: string
              p_chain_id: string
              p_driver_id: string
              p_driver_name: string
              p_loading_location: string
              p_unloading_location: string
              p_loading_date: string
              p_loading_weight: number
              p_unloading_weight: number
              p_current_cost: number
              p_license_plate: string
              p_driver_phone: string
              p_transport_type: string
              p_extra_cost: number
              p_remarks: string
              p_unloading_date: string
            }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      partner_chain_type: {
        id: string | null
        chainName: string | null
        description: string | null
        isDefault: boolean | null
        partners: Json | null
      }
      project_partner_type: {
        id: string | null
        partnerId: string | null
        level: number | null
        taxRate: number | null
        calculationMethod: string | null
        profitRate: number | null
      }
      waybill_fingerprint: {
        project_name_check: string | null
        driver_name_check: string | null
        loading_location_check: string | null
        unloading_location_check: string | null
        loading_date_check: string | null
        loading_weight_check: number | null
      }
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
