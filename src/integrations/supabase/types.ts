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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      billing_types: {
        Row: {
          billing_type_id: number
          created_at: string | null
          type_code: string | null
          type_name: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          billing_type_id?: number
          created_at?: string | null
          type_code?: string | null
          type_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          billing_type_id?: number
          created_at?: string | null
          type_code?: string | null
          type_name?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      contract_access_logs: {
        Row: {
          action: string
          contract_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          contract_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          contract_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_access_logs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_category_permission_templates: {
        Row: {
          category: Database["public"]["Enums"]["contract_category"]
          created_at: string | null
          default_permissions: string[] | null
          description: string | null
          id: string
          is_active: boolean | null
          role_permissions: Json | null
          template_name: string
          updated_at: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["contract_category"]
          created_at?: string | null
          default_permissions?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_permissions?: Json | null
          template_name: string
          updated_at?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["contract_category"]
          created_at?: string | null
          default_permissions?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          role_permissions?: Json | null
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contract_file_versions: {
        Row: {
          contract_id: string
          description: string | null
          file_hash: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_current: boolean
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          version_number: number
        }
        Insert: {
          contract_id: string
          description?: string | null
          file_hash?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          is_current?: boolean
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Update: {
          contract_id?: string
          description?: string | null
          file_hash?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_current?: boolean
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_file_versions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_numbering_rules: {
        Row: {
          category: Database["public"]["Enums"]["contract_category"]
          created_at: string | null
          current_sequence: number
          format: string
          id: string
          is_active: boolean
          month: number
          prefix: string
          updated_at: string | null
          year: number
        }
        Insert: {
          category: Database["public"]["Enums"]["contract_category"]
          created_at?: string | null
          current_sequence?: number
          format?: string
          id?: string
          is_active?: boolean
          month?: number
          prefix: string
          updated_at?: string | null
          year?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["contract_category"]
          created_at?: string | null
          current_sequence?: number
          format?: string
          id?: string
          is_active?: boolean
          month?: number
          prefix?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      contract_owner_permissions: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          owner_id: string
          permissions: string[] | null
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          owner_id: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          owner_id?: string
          permissions?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_owner_permissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: true
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_owner_permissions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_permissions: {
        Row: {
          contract_id: string | null
          created_at: string | null
          department: string | null
          field_permissions: Json | null
          file_permissions: Json | null
          id: string
          is_active: boolean | null
          permission_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          department?: string | null
          field_permissions?: Json | null
          file_permissions?: Json | null
          id?: string
          is_active?: boolean | null
          permission_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          department?: string | null
          field_permissions?: Json | null
          file_permissions?: Json | null
          id?: string
          is_active?: boolean | null
          permission_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_permissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_reminders: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          is_sent: boolean
          recipient_emails: string[] | null
          reminder_date: string
          reminder_type: string
          sent_at: string | null
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          is_sent?: boolean
          recipient_emails?: string[] | null
          reminder_date: string
          reminder_type: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          is_sent?: boolean
          recipient_emails?: string[] | null
          reminder_date?: string
          reminder_type?: string
          sent_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_reminders_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_tag_relations: {
        Row: {
          contract_id: string
          created_at: string | null
          id: string
          tag_id: string
          updated_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string | null
          id?: string
          tag_id: string
          updated_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string | null
          id?: string
          tag_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_tag_relations_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_tag_relations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "contract_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_tags: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contracts: {
        Row: {
          access_count: number
          attachment_url: string | null
          category: Database["public"]["Enums"]["contract_category"]
          contract_amount: number | null
          contract_number: string | null
          contract_original_url: string | null
          counterparty_company: string
          created_at: string | null
          department: string | null
          end_date: string
          id: string
          is_confidential: boolean
          last_accessed_at: string | null
          our_company: string
          priority: string
          remarks: string | null
          responsible_person: string | null
          start_date: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_count?: number
          attachment_url?: string | null
          category: Database["public"]["Enums"]["contract_category"]
          contract_amount?: number | null
          contract_number?: string | null
          contract_original_url?: string | null
          counterparty_company: string
          created_at?: string | null
          department?: string | null
          end_date: string
          id?: string
          is_confidential?: boolean
          last_accessed_at?: string | null
          our_company: string
          priority?: string
          remarks?: string | null
          responsible_person?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_count?: number
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["contract_category"]
          contract_amount?: number | null
          contract_number?: string | null
          contract_original_url?: string | null
          counterparty_company?: string
          created_at?: string | null
          department?: string | null
          end_date?: string
          id?: string
          is_confidential?: boolean
          last_accessed_at?: string | null
          our_company?: string
          priority?: string
          remarks?: string | null
          responsible_person?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_projects: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          project_id?: string
          updated_at?: string | null
          user_id?: string
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
          driver_license_photos: Json | null
          driving_license_photos: Json | null
          id: string
          id_card_photos: Json | null
          license_plate: string
          name: string
          phone: string
          qualification_certificate_photos: Json | null
          transport_license_photos: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          driver_license_photos?: Json | null
          driving_license_photos?: Json | null
          id?: string
          id_card_photos?: Json | null
          license_plate: string
          name: string
          phone: string
          qualification_certificate_photos?: Json | null
          transport_license_photos?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          driver_license_photos?: Json | null
          driving_license_photos?: Json | null
          id?: string
          id_card_photos?: Json | null
          license_plate?: string
          name?: string
          phone?: string
          qualification_certificate_photos?: Json | null
          transport_license_photos?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      external_platforms: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          platform_code: string
          platform_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_code: string
          platform_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          platform_code?: string
          platform_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      function_backup_log: {
        Row: {
          backup_reason: string | null
          backup_time: string | null
          function_arguments: string | null
          function_name: string
          function_type: string | null
          id: number
          original_definition: string | null
          schema_name: string | null
          updated_at: string | null
        }
        Insert: {
          backup_reason?: string | null
          backup_time?: string | null
          function_arguments?: string | null
          function_name: string
          function_type?: string | null
          id?: number
          original_definition?: string | null
          schema_name?: string | null
          updated_at?: string | null
        }
        Update: {
          backup_reason?: string | null
          backup_time?: string | null
          function_arguments?: string | null
          function_name?: string
          function_type?: string | null
          id?: number
          original_definition?: string | null
          schema_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      import_field_mappings: {
        Row: {
          created_at: string | null
          database_field: string
          default_value: string | null
          display_order: number | null
          excel_column: string
          field_type: string
          id: string
          is_required: boolean | null
          template_id: string
          updated_at: string | null
          validation_rules: Json | null
        }
        Insert: {
          created_at?: string | null
          database_field: string
          default_value?: string | null
          display_order?: number | null
          excel_column: string
          field_type: string
          id?: string
          is_required?: boolean | null
          template_id: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Update: {
          created_at?: string | null
          database_field?: string
          default_value?: string | null
          display_order?: number | null
          excel_column?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          template_id?: string
          updated_at?: string | null
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_field_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_fixed_mappings: {
        Row: {
          created_at: string | null
          database_value: string
          excel_value: string
          id: string
          is_case_sensitive: boolean | null
          mapping_type: string
          template_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          database_value: string
          excel_value: string
          id?: string
          is_case_sensitive?: boolean | null
          mapping_type: string
          template_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          database_value?: string
          excel_value?: string
          id?: string
          is_case_sensitive?: boolean | null
          mapping_type?: string
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_fixed_mappings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "import_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_templates: {
        Row: {
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          field_mappings: Json
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          platform_type: string
          template_config: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          field_mappings?: Json
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          platform_type: string
          template_config?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          field_mappings?: Json
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          platform_type?: string
          template_config?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      invoice_records: {
        Row: {
          created_at: string
          id: string
          invoice_amount: number
          invoice_date: string
          invoice_image_urls: string[] | null
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
          invoice_image_urls?: string[] | null
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
          invoice_image_urls?: string[] | null
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
            referencedRelation: "logistics_records_status_summary"
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
          {
            foreignKeyName: "invoice_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_request_details: {
        Row: {
          amount: number | null
          auto_number: string | null
          created_at: string | null
          driver_name: string | null
          id: string
          invoice_request_id: string
          invoiceable_amount: number
          loading_date: string | null
          loading_location: string | null
          logistics_record_id: string
          project_name: string | null
          unloading_location: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          auto_number?: string | null
          created_at?: string | null
          driver_name?: string | null
          id?: string
          invoice_request_id: string
          invoiceable_amount?: number
          loading_date?: string | null
          loading_location?: string | null
          logistics_record_id: string
          project_name?: string | null
          unloading_location?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          auto_number?: string | null
          created_at?: string | null
          driver_name?: string | null
          id?: string
          invoice_request_id?: string
          invoiceable_amount?: number
          loading_date?: string | null
          loading_location?: string | null
          logistics_record_id?: string
          project_name?: string | null
          unloading_location?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_request_details_record_id"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_request_details_record_id"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_request_details_record_id"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_request_details_request_id"
            columns: ["invoice_request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_request_details_invoice_request_id_fkey"
            columns: ["invoice_request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_request_details_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_request_details_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_request_details_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_requests: {
        Row: {
          applicant_id: string | null
          applicant_name: string | null
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          bank_account: string | null
          bank_name: string | null
          company_address: string | null
          created_at: string | null
          created_by: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          invoicing_partner_bank_account: string | null
          invoicing_partner_bank_name: string | null
          invoicing_partner_company_address: string | null
          invoicing_partner_full_name: string | null
          invoicing_partner_id: string
          invoicing_partner_tax_number: string | null
          is_voided: boolean | null
          partner_full_name: string | null
          partner_id: string | null
          partner_name: string
          record_count: number
          remarks: string | null
          request_number: string
          status: string | null
          tax_number: string | null
          total_amount: number
          updated_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          applicant_id?: string | null
          applicant_name?: string | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_name?: string | null
          company_address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoicing_partner_bank_account?: string | null
          invoicing_partner_bank_name?: string | null
          invoicing_partner_company_address?: string | null
          invoicing_partner_full_name?: string | null
          invoicing_partner_id: string
          invoicing_partner_tax_number?: string | null
          is_voided?: boolean | null
          partner_full_name?: string | null
          partner_id?: string | null
          partner_name: string
          record_count?: number
          remarks?: string | null
          request_number: string
          status?: string | null
          tax_number?: string | null
          total_amount?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          applicant_id?: string | null
          applicant_name?: string | null
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          bank_account?: string | null
          bank_name?: string | null
          company_address?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          invoicing_partner_bank_account?: string | null
          invoicing_partner_bank_name?: string | null
          invoicing_partner_company_address?: string | null
          invoicing_partner_full_name?: string | null
          invoicing_partner_id?: string
          invoicing_partner_tax_number?: string | null
          is_voided?: boolean | null
          partner_full_name?: string | null
          partner_id?: string | null
          partner_name?: string
          record_count?: number
          remarks?: string | null
          request_number?: string
          status?: string | null
          tax_number?: string | null
          total_amount?: number
          updated_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_requests_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_requests_invoicing_partner_id"
            columns: ["invoicing_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_requests_invoicing_partner_id"
            columns: ["invoicing_partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_requests_partner_id"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_requests_partner_id"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_requests_voided_by"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_partner_id_fkey"
            columns: ["invoicing_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_requests_partner_id_fkey"
            columns: ["invoicing_partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
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
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          project_id?: string
          updated_at?: string | null
          user_id?: string
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
          adcode: string | null
          address: string | null
          city: string | null
          citycode: string | null
          created_at: string
          district: string | null
          formatted_address: string | null
          geocoding_error: string | null
          geocoding_status:
            | Database["public"]["Enums"]["geocoding_status"]
            | null
          geocoding_updated_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          province: string | null
          street: string | null
          street_number: string | null
          township: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          adcode?: string | null
          address?: string | null
          city?: string | null
          citycode?: string | null
          created_at?: string
          district?: string | null
          formatted_address?: string | null
          geocoding_error?: string | null
          geocoding_status?:
            | Database["public"]["Enums"]["geocoding_status"]
            | null
          geocoding_updated_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          province?: string | null
          street?: string | null
          street_number?: string | null
          township?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          adcode?: string | null
          address?: string | null
          city?: string | null
          citycode?: string | null
          created_at?: string
          district?: string | null
          formatted_address?: string | null
          geocoding_error?: string | null
          geocoding_status?:
            | Database["public"]["Enums"]["geocoding_status"]
            | null
          geocoding_updated_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          province?: string | null
          street?: string | null
          street_number?: string | null
          township?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      logistics_partner_costs: {
        Row: {
          base_amount: number
          created_at: string
          id: string
          invoice_applied_at: string | null
          invoice_completed_at: string | null
          invoice_number: string | null
          invoice_request_id: string | null
          invoice_status: string | null
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          payment_applied_at: string | null
          payment_completed_at: string | null
          payment_reference: string | null
          payment_request_id: string | null
          payment_status: string | null
          tax_rate: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          base_amount: number
          created_at?: string
          id?: string
          invoice_applied_at?: string | null
          invoice_completed_at?: string | null
          invoice_number?: string | null
          invoice_request_id?: string | null
          invoice_status?: string | null
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string | null
          tax_rate: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          base_amount?: number
          created_at?: string
          id?: string
          invoice_applied_at?: string | null
          invoice_completed_at?: string | null
          invoice_number?: string | null
          invoice_request_id?: string | null
          invoice_status?: string | null
          level?: number
          logistics_record_id?: string
          partner_id?: string
          payable_amount?: number
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string | null
          tax_rate?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_logistics_partner_costs_invoice_request_id"
            columns: ["invoice_request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "logistics_records_status_summary"
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
          {
            foreignKeyName: "logistics_partner_costs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_records: {
        Row: {
          auto_number: string
          billing_type_id: number | null
          cargo_type: string | null
          chain_id: string | null
          created_at: string
          created_by_user_id: string
          current_cost: number | null
          driver_id: string | null
          driver_name: string
          driver_phone: string
          external_tracking_numbers: string[] | null
          extra_cost: number | null
          id: string
          invoice_applied_at: string | null
          invoice_completed_at: string | null
          invoice_number: string | null
          invoice_request_id: string | null
          invoice_status: string | null
          license_plate: string
          loading_date: string
          loading_location: string
          loading_location_ids: string[] | null
          loading_weight: number | null
          other_platform_names: string[] | null
          payable_cost: number | null
          payment_applied_at: string | null
          payment_completed_at: string | null
          payment_reference: string | null
          payment_request_id: string | null
          payment_status: string
          project_id: string | null
          project_name: string
          remarks: string | null
          transport_type: string
          unloading_date: string | null
          unloading_location: string
          unloading_location_ids: string[] | null
          unloading_weight: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_number: string
          billing_type_id?: number | null
          cargo_type?: string | null
          chain_id?: string | null
          created_at?: string
          created_by_user_id: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name: string
          driver_phone: string
          external_tracking_numbers?: string[] | null
          extra_cost?: number | null
          id?: string
          invoice_applied_at?: string | null
          invoice_completed_at?: string | null
          invoice_number?: string | null
          invoice_request_id?: string | null
          invoice_status?: string | null
          license_plate: string
          loading_date: string
          loading_location: string
          loading_location_ids?: string[] | null
          loading_weight?: number | null
          other_platform_names?: string[] | null
          payable_cost?: number | null
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string
          project_id?: string | null
          project_name: string
          remarks?: string | null
          transport_type: string
          unloading_date?: string | null
          unloading_location: string
          unloading_location_ids?: string[] | null
          unloading_weight?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_number?: string
          billing_type_id?: number | null
          cargo_type?: string | null
          chain_id?: string | null
          created_at?: string
          created_by_user_id?: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name?: string
          driver_phone?: string
          external_tracking_numbers?: string[] | null
          extra_cost?: number | null
          id?: string
          invoice_applied_at?: string | null
          invoice_completed_at?: string | null
          invoice_number?: string | null
          invoice_request_id?: string | null
          invoice_status?: string | null
          license_plate?: string
          loading_date?: string
          loading_location?: string
          loading_location_ids?: string[] | null
          loading_weight?: number | null
          other_platform_names?: string[] | null
          payable_cost?: number | null
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string
          project_id?: string | null
          project_name?: string
          remarks?: string | null
          transport_type?: string
          unloading_date?: string | null
          unloading_location?: string
          unloading_location_ids?: string[] | null
          unloading_weight?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_logistics_records_billing_type"
            columns: ["billing_type_id"]
            isOneToOne: false
            referencedRelation: "billing_types"
            referencedColumns: ["billing_type_id"]
          },
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
      notifications: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          related_id: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          related_id?: string | null
          title: string
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          related_id?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      operation_logs: {
        Row: {
          id: string
          operated_at: string
          operated_by: string | null
          operation_type: string
          record_id: string | null
          record_info: Json | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          operated_at?: string
          operated_by?: string | null
          operation_type: string
          record_id?: string | null
          record_info?: Json | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          operated_at?: string
          operated_by?: string | null
          operation_type?: string
          record_id?: string | null
          record_info?: Json | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_logs_operated_by_fkey"
            columns: ["operated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_bank_details: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          branch_name: string | null
          company_address: string | null
          created_at: string
          full_name: string | null
          partner_id: string
          tax_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          branch_name?: string | null
          company_address?: string | null
          created_at?: string
          full_name?: string | null
          partner_id: string
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          branch_name?: string | null
          company_address?: string | null
          created_at?: string
          full_name?: string | null
          partner_id?: string
          tax_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_bank_details_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_bank_details_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_chains: {
        Row: {
          billing_type_id: number | null
          chain_name: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          project_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          billing_type_id?: number | null
          chain_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          project_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          billing_type_id?: number | null
          chain_name?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          project_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_chains_billing_type_id_fkey"
            columns: ["billing_type_id"]
            isOneToOne: false
            referencedRelation: "billing_types"
            referencedColumns: ["billing_type_id"]
          },
          {
            foreignKeyName: "partner_chains_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payment_items: {
        Row: {
          logistics_record_id: string
          payment_request_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          logistics_record_id: string
          payment_request_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          logistics_record_id?: string
          payment_request_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_payment_items_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "partner_payment_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payment_requests: {
        Row: {
          created_at: string
          id: string
          request_date: string
          request_id: string
          status: string
          total_amount: number
          total_records: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          request_date: string
          request_id: string
          status?: string
          total_amount: number
          total_records: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          request_date?: string
          request_id?: string
          status?: string
          total_amount?: number
          total_records?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          created_at: string
          full_name: string | null
          hierarchy_depth: number | null
          hierarchy_path: string | null
          id: string
          is_root: boolean | null
          name: string
          parent_partner_id: string | null
          partner_type: Database["public"]["Enums"]["partner_type_enum"] | null
          tax_rate: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          hierarchy_depth?: number | null
          hierarchy_path?: string | null
          id?: string
          is_root?: boolean | null
          name: string
          parent_partner_id?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type_enum"] | null
          tax_rate: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          hierarchy_depth?: number | null
          hierarchy_path?: string | null
          id?: string
          is_root?: boolean | null
          name?: string
          parent_partner_id?: string | null
          partner_type?: Database["public"]["Enums"]["partner_type_enum"] | null
          tax_rate?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          bank_receipt_number: string | null
          created_at: string
          id: string
          logistics_record_id: string
          partner_id: string
          payment_amount: number
          payment_date: string
          payment_image_urls: string[] | null
          remarks: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bank_receipt_number?: string | null
          created_at?: string
          id?: string
          logistics_record_id: string
          partner_id: string
          payment_amount?: number
          payment_date?: string
          payment_image_urls?: string[] | null
          remarks?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bank_receipt_number?: string | null
          created_at?: string
          id?: string
          logistics_record_id?: string
          partner_id?: string
          payment_amount?: number
          payment_date?: string
          payment_image_urls?: string[] | null
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
            referencedRelation: "logistics_records_status_summary"
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
          {
            foreignKeyName: "payment_records_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_requests: {
        Row: {
          approval_result: Json | null
          created_at: string
          created_by: string | null
          id: string
          logistics_record_ids: string[] | null
          notes: string | null
          record_count: number
          request_id: string
          status: string
          updated_at: string | null
          user_id: string
          work_wechat_sp_no: string | null
        }
        Insert: {
          approval_result?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          logistics_record_ids?: string[] | null
          notes?: string | null
          record_count: number
          request_id: string
          status?: string
          updated_at?: string | null
          user_id: string
          work_wechat_sp_no?: string | null
        }
        Update: {
          approval_result?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          logistics_record_ids?: string[] | null
          notes?: string | null
          record_count?: number
          request_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          work_wechat_sp_no?: string | null
        }
        Relationships: []
      }
      permission_audit_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string
          id: string
          new_value: Json | null
          old_value: Json | null
          permission_key: string
          permission_type: string
          reason: string | null
          target_project_id: string | null
          target_user_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          created_by: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          permission_key: string
          permission_type: string
          reason?: string | null
          target_project_id?: string | null
          target_user_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          permission_key?: string
          permission_type?: string
          reason?: string | null
          target_project_id?: string | null
          target_user_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_audit_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_logs_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          username: string | null
          work_wechat_department: number[] | null
          work_wechat_name: string | null
          work_wechat_userid: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          username?: string | null
          work_wechat_department?: number[] | null
          work_wechat_name?: string | null
          work_wechat_userid?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          username?: string | null
          work_wechat_department?: number[] | null
          work_wechat_name?: string | null
          work_wechat_userid?: string | null
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
          updated_at: string | null
          user_id: string
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
          updated_at?: string | null
          user_id: string
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
          updated_at?: string | null
          user_id?: string
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
            foreignKeyName: "project_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
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
          cargo_type: string
          created_at: string
          effective_quantity_type: Database["public"]["Enums"]["effective_quantity_type"]
          end_date: string
          finance_manager: string | null
          id: string
          loading_address: string
          manager: string
          name: string
          planned_total_tons: number | null
          project_status: string
          start_date: string
          unloading_address: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_code?: string | null
          cargo_type?: string
          created_at?: string
          effective_quantity_type?: Database["public"]["Enums"]["effective_quantity_type"]
          end_date: string
          finance_manager?: string | null
          id?: string
          loading_address: string
          manager: string
          name: string
          planned_total_tons?: number | null
          project_status?: string
          start_date: string
          unloading_address: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_code?: string | null
          cargo_type?: string
          created_at?: string
          effective_quantity_type?: Database["public"]["Enums"]["effective_quantity_type"]
          end_date?: string
          finance_manager?: string | null
          id?: string
          loading_address?: string
          manager?: string
          name?: string
          planned_total_tons?: number | null
          project_status?: string
          start_date?: string
          unloading_address?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      role_permission_templates: {
        Row: {
          color: string | null
          created_at: string
          data_permissions: string[] | null
          description: string | null
          function_permissions: string[] | null
          id: string
          is_system: boolean | null
          menu_permissions: string[] | null
          name: string | null
          project_permissions: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          data_permissions?: string[] | null
          description?: string | null
          function_permissions?: string[] | null
          id?: string
          is_system?: boolean | null
          menu_permissions?: string[] | null
          name?: string | null
          project_permissions?: string[] | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          data_permissions?: string[] | null
          description?: string | null
          function_permissions?: string[] | null
          id?: string
          is_system?: boolean | null
          menu_permissions?: string[] | null
          name?: string | null
          project_permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string | null
          filters: Json
          id: string
          name: string
          search_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters: Json
          id?: string
          name: string
          search_type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json
          id?: string
          name?: string
          search_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      scale_records: {
        Row: {
          billing_type_id: number
          created_at: string
          created_by_user_id: string
          driver_name: string | null
          id: string
          image_urls: string[] | null
          license_plate: string | null
          loading_date: string
          logistics_number: string | null
          project_id: string
          project_name: string
          trip_number: number
          updated_at: string
          user_id: string
          valid_quantity: number | null
        }
        Insert: {
          billing_type_id?: number
          created_at?: string
          created_by_user_id?: string
          driver_name?: string | null
          id?: string
          image_urls?: string[] | null
          license_plate?: string | null
          loading_date: string
          logistics_number?: string | null
          project_id: string
          project_name: string
          trip_number: number
          updated_at?: string
          user_id?: string
          valid_quantity?: number | null
        }
        Update: {
          billing_type_id?: number
          created_at?: string
          created_by_user_id?: string
          driver_name?: string | null
          id?: string
          image_urls?: string[] | null
          license_plate?: string | null
          loading_date?: string
          logistics_number?: string | null
          project_id?: string
          project_name?: string
          trip_number?: number
          updated_at?: string
          user_id?: string
          valid_quantity?: number | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string
          created_by: string | null
          custom_settings: Json | null
          data_permissions: string[] | null
          function_permissions: string[] | null
          id: string
          inherit_role: boolean | null
          menu_permissions: string[] | null
          project_id: string | null
          project_permissions: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_settings?: Json | null
          data_permissions?: string[] | null
          function_permissions?: string[] | null
          id?: string
          inherit_role?: boolean | null
          menu_permissions?: string[] | null
          project_id?: string | null
          project_permissions?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_settings?: Json | null
          data_permissions?: string[] | null
          function_permissions?: string[] | null
          id?: string
          inherit_role?: boolean | null
          menu_permissions?: string[] | null
          project_id?: string | null
          project_permissions?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_projects: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          created_by: string | null
          id: string
          project_id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      v_p_policy_count: {
        Row: {
          count: number | null
          updated_at: string | null
        }
        Insert: {
          count?: number | null
          updated_at?: string | null
        }
        Update: {
          count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      logistics_records_status_summary: {
        Row: {
          auto_number: string | null
          current_cost: number | null
          driver_name: string | null
          extra_cost: number | null
          id: string | null
          invoice_applied_at: string | null
          invoice_completed_at: string | null
          invoice_number: string | null
          invoice_processing_hours: number | null
          invoice_request_id: string | null
          invoice_status: string | null
          invoice_status_text: string | null
          loading_date: string | null
          loading_location: string | null
          payable_cost: number | null
          payment_applied_at: string | null
          payment_completed_at: string | null
          payment_processing_hours: number | null
          payment_reference: string | null
          payment_request_id: string | null
          payment_status: string | null
          payment_status_text: string | null
          project_name: string | null
          unloading_date: string | null
          unloading_location: string | null
        }
        Relationships: []
      }
      logistics_records_view: {
        Row: {
          auto_number: string | null
          billing_type_id: number | null
          cargo_type: string | null
          chain_id: string | null
          chain_name: string | null
          created_at: string | null
          created_by_user_id: string | null
          current_cost: number | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          external_tracking_numbers: string[] | null
          extra_cost: number | null
          id: string | null
          invoice_status: string | null
          license_plate: string | null
          loading_date: string | null
          loading_location: string | null
          loading_weight: number | null
          other_platform_names: string[] | null
          payable_cost: number | null
          payment_status: string | null
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
            foreignKeyName: "fk_logistics_records_billing_type"
            columns: ["billing_type_id"]
            isOneToOne: false
            referencedRelation: "billing_types"
            referencedColumns: ["billing_type_id"]
          },
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
      partners_hierarchy_view: {
        Row: {
          created_at: string | null
          direct_children_count: number | null
          full_name: string | null
          hierarchy_depth: number | null
          hierarchy_path: string | null
          id: string | null
          is_root: boolean | null
          name: string | null
          parent_depth: number | null
          parent_name: string | null
          parent_partner_id: string | null
          partner_type: Database["public"]["Enums"]["partner_type_enum"] | null
          tax_rate: number | null
          total_subordinates_count: number | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_parent_partner_id_fkey"
            columns: ["parent_partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_custom_platform: {
        Args: { p_description?: string; p_platform_name: string }
        Returns: string
      }
      add_enum_value: {
        Args: { enum_name: string; enum_value: string }
        Returns: undefined
      }
      add_external_tracking_number: {
        Args: {
          p_logistics_record_id: string
          p_platform: string
          p_remarks?: string
          p_status?: string
          p_tracking_number: string
        }
        Returns: boolean
      }
      add_logistics_record_with_costs: {
        Args: {
          p_chain_id: string
          p_current_cost: number
          p_driver_id: string
          p_driver_name: string
          p_driver_phone: string
          p_extra_cost: number
          p_license_plate: string
          p_loading_date: string
          p_loading_location: string
          p_loading_weight: number
          p_project_id: string
          p_project_name: string
          p_remarks: string
          p_transport_type: string
          p_unloading_date: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: undefined
      }
      add_logistics_record_with_costs_v2:
        | {
            Args: {
              p_chain_id: string
              p_current_cost: number
              p_driver_id: string
              p_driver_name: string
              p_driver_payable_cost: number
              p_driver_phone: string
              p_extra_cost: number
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_id: string
              p_project_name: string
              p_remarks: string
              p_transport_type: string
              p_unloading_date?: string
              p_unloading_location: string
              p_unloading_weight: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_chain_id: string
              p_chain_name: string
              p_driver_id: string
              p_driver_name: string
              p_driver_phone: string
              p_license_plate: string
              p_loading_cost: number
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_id: string
              p_project_name: string
              p_transport_type: string
              p_unloading_cost: number
              p_unloading_location: string
              p_user_id: string
            }
            Returns: string
          }
      apply_standard_rls_policies: {
        Args: { p_table_name: string; p_user_id_column: string }
        Returns: undefined
      }
      approve_invoice_request: {
        Args: { p_action: string; p_remarks?: string; p_request_id: string }
        Returns: Json
      }
      batch_approve_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_associate_driver_projects: {
        Args: { p_driver_ids: string[] }
        Returns: Json
      }
      batch_cancel_by_filter: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: number
      }
      batch_cancel_payment_application: {
        Args: { p_record_ids: string[] }
        Returns: number
      }
      batch_import_logistics_records: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_backup_base: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_with_update:
        | { Args: { p_records: Json; p_update_mode?: boolean }; Returns: Json }
        | { Args: { p_records: Json; p_update_options?: Json }; Returns: Json }
      "batch_import_logistics_records—buneng": {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_modify_logistics_records_chain: {
        Args: { p_chain_name: string; p_record_ids: string[] }
        Returns: Json
      }
      batch_pay_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_recalculate_by_filter:
        | {
            Args: {
              p_end_date: string
              p_partner_id: string
              p_project_id: string
              p_start_date: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_end_date?: string
              p_partner_id?: string
              p_project_id?: string
              p_start_date?: string
            }
            Returns: undefined
          }
      batch_recalculate_partner_costs: {
        Args: { p_record_ids: string[] }
        Returns: undefined
      }
      batch_update_location_geocoding: {
        Args: { p_locations: Json }
        Returns: Json
      }
      batch_update_permissions: {
        Args: { p_permissions: Json }
        Returns: {
          error_count: number
          inserted_count: number
          updated_count: number
        }[]
      }
      bulk_calculate_partner_costs: {
        Args: { p_record_ids: string[] }
        Returns: undefined
      }
      calculate_effective_quantity: {
        Args: {
          p_effective_quantity_type: Database["public"]["Enums"]["effective_quantity_type"]
          p_loading_quantity: number
          p_unloading_quantity: number
        }
        Returns: number
      }
      calculate_hierarchy_depth: {
        Args: { partner_id: string }
        Returns: number
      }
      calculate_hierarchy_path: {
        Args: { partner_id: string }
        Returns: string
      }
      calculate_partner_costs: {
        Args: { p_base_amount: number; p_project_id: string }
        Returns: {
          base_amount: number
          level: number
          partner_id: string
          partner_name: string
          payable_amount: number
          tax_rate: number
        }[]
      }
      calculate_partner_costs_for_project_v2: {
        Args: {
          p_base_amount: number
          p_loading_weight?: number
          p_project_id: string
          p_unloading_weight?: number
        }
        Returns: {
          base_amount: number
          calculation_method: string
          level: number
          partner_id: string
          partner_name: string
          payable_amount: number
          profit_rate: number
          tax_rate: number
        }[]
      }
      calculate_partner_costs_v2: {
        Args: {
          p_base_amount: number
          p_chain_id: string
          p_loading_weight: number
          p_project_id: string
          p_unloading_weight: number
        }
        Returns: {
          base_amount: number
          calculation_method: string
          level: number
          partner_id: string
          partner_name: string
          payable_amount: number
          profit_rate: number
          tax_rate: number
        }[]
      }
      can_view_partner: {
        Args: { target_partner_id: string }
        Returns: boolean
      }
      cancel_payment_requests_by_ids: {
        Args: { p_request_ids: string[] }
        Returns: number
      }
      cancel_payment_status_for_waybills: {
        Args: { p_record_ids: string[]; p_user_id?: string }
        Returns: Json
      }
      check_enum_value: {
        Args: { enum_name: string; enum_value: string }
        Returns: boolean
      }
      check_existing_waybills: {
        Args: {
          p_fingerprints: Database["public"]["CompositeTypes"]["waybill_fingerprint"][]
        }
        Returns: Database["public"]["CompositeTypes"]["waybill_fingerprint"][]
        SetofOptions: {
          from: "*"
          to: "waybill_fingerprint"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      check_expiring_contracts: { Args: never; Returns: undefined }
      check_logistics_record_duplicate:
        | {
            Args: {
              p_chain_name: string
              p_driver_name: string
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_name: string
              p_unloading_location: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_chain_id: string
              p_driver_name: string
              p_exclude_id?: string
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_name: string
              p_unloading_location: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_driver_name: string
              p_driver_phone: string
              p_exclude_id?: string
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_unloading_location: string
            }
            Returns: boolean
          }
      check_logistics_record_duplicate_v2:
        | {
            Args: {
              p_chain_name: string
              p_driver_name: string
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_name: string
              p_unloading_location: string
            }
            Returns: boolean
          }
        | {
            Args: {
              p_chain_id: string
              p_driver_name: string
              p_exclude_id?: string
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_name: string
              p_unloading_location: string
            }
            Returns: boolean
          }
      check_payment_rollback_eligibility: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      check_permission_inheritance: {
        Args: never
        Returns: {
          data_count: number
          function_count: number
          menu_count: number
          permission_source: string
          permission_type: string
          project_count: number
          user_email: string
          user_id: string
          user_role: string
        }[]
      }
      cleanup_permissions: {
        Args: never
        Returns: {
          cleaned_count: number
          orphaned_count: number
        }[]
      }
      compare_location_arrays: {
        Args: { locations1: string; locations2: string }
        Returns: boolean
      }
      compare_location_arrays_v2: {
        Args: { locations1: string; locations2: string }
        Returns: boolean
      }
      complete_invoice_request: {
        Args: {
          p_invoice_date: string
          p_invoice_number: string
          p_request_id: string
        }
        Returns: Json
      }
      create_contract_expiry_notification: {
        Args: {
          p_contract_id: string
          p_contract_number: string
          p_days_until_expiry: number
          p_user_id: string
        }
        Returns: undefined
      }
      create_contract_permission: {
        Args: {
          p_contract_id: string
          p_department_id?: string
          p_description?: string
          p_expires_at?: string
          p_permission_type: string
          p_role_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      create_payment_request_notification: {
        Args: {
          p_amount: number
          p_project_name: string
          p_request_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      create_project_completion_notification: {
        Args: {
          p_project_id: string
          p_project_name: string
          p_total_tonnage: number
          p_user_id: string
        }
        Returns: undefined
      }
      create_role_complete: {
        Args: {
          data_permissions?: string[]
          function_permissions?: string[]
          menu_permissions?: string[]
          project_permissions?: string[]
          role_color?: string
          role_description?: string
          role_key: string
          role_label: string
        }
        Returns: undefined
      }
      create_single_logistics_record: {
        Args: { p_record: Json }
        Returns: Json
      }
      create_waybill_with_check: {
        Args: {
          p_cooperative_partner: string
          p_driver_name: string
          p_force_create?: boolean
          p_freight_cost: number
          p_license_plate: string
          p_loading_date: string
          p_loading_location: string
          p_loading_weight: number
          p_project_name: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: Json
      }
      delete_invoice_request: { Args: { p_request_id: string }; Returns: Json }
      delete_notification: {
        Args: { p_notification_id: string; p_user_id: string }
        Returns: undefined
      }
      delete_records_by_project_name: {
        Args: { p_project_name: string }
        Returns: string
      }
      delete_role_complete: { Args: { role_key: string }; Returns: undefined }
      delete_waybills_by_project: {
        Args: { p_project_name: string }
        Returns: Json
      }
      execute_import_v2: {
        Args: { p_records_to_insert: Json; p_records_to_update: Json }
        Returns: Json
      }
      fetch_comprehensive_project_report: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_final_v2: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_final_v3: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_final_v4: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_final_v5: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_v2: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      fetch_comprehensive_project_report_v3: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      find_driver_projects: {
        Args: { p_driver_ids: string[] }
        Returns: {
          driver_id: string
          driver_name: string
          license_plate: string
          project_ids: string[]
          project_names: string[]
          record_count: number
        }[]
      }
      generate_auto_number: {
        Args: { loading_date_input: string }
        Returns: string
      }
      generate_invoice_request_number: { Args: never; Returns: string }
      generate_project_code: { Args: never; Returns: string }
      get_all_ancestor_ids: { Args: { partner_id: string }; Returns: string[] }
      get_all_filtered_record_ids: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_project_name?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_all_projects_overview_data: {
        Args: { p_project_ids?: string[]; p_report_date: string }
        Returns: Json
      }
      get_all_projects_overview_data_0827: {
        Args: { p_report_date: string }
        Returns: Json
      }
      get_all_projects_overview_data_optimized: {
        Args: { p_project_ids?: string[]; p_report_date: string }
        Returns: Json
      }
      get_all_projects_overview_data_v3: {
        Args: { p_project_ids?: string[]; p_report_date: string }
        Returns: Json
      }
      get_all_projects_overview_data_with_driver_receivable: {
        Args: { p_project_ids?: string[]; p_report_date: string }
        Returns: Json
      }
      get_all_roles: {
        Args: never
        Returns: {
          role_key: string
          role_label: string
          template_exists: boolean
          user_count: number
        }[]
      }
      get_all_subordinate_ids: {
        Args: { partner_id: string }
        Returns: string[]
      }
      get_all_used_platforms: {
        Args: never
        Returns: {
          platform_name: string
          usage_count: number
        }[]
      }
      get_available_platforms: {
        Args: never
        Returns: {
          last_used: string
          platform_name: string
          usage_count: number
        }[]
      }
      get_cached_permissions: { Args: { p_cache_key: string }; Returns: Json }
      get_contract_category_templates: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["contract_category"]
          created_at: string
          default_permissions: string[]
          description: string
          id: string
          is_active: boolean
          role_permissions: Json
          template_name: string
          updated_at: string
        }[]
      }
      get_contract_owner_permissions: {
        Args: never
        Returns: {
          contract_category: Database["public"]["Enums"]["contract_category"]
          contract_id: string
          contract_title: string
          created_at: string
          id: string
          owner_id: string
          owner_name: string
          permissions: string[]
          updated_at: string
        }[]
      }
      get_contract_permission_stats: {
        Args: never
        Returns: {
          active_permissions: number
          department_permissions: number
          expired_permissions: number
          owner_permissions: number
          role_permissions: number
          total_permissions: number
          user_permissions: number
        }[]
      }
      get_dashboard_quick_stats: {
        Args: {
          p_end_date?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_dashboard_stats: {
        Args: {
          end_date_param: string
          project_id_param?: string
          start_date_param: string
        }
        Returns: Json
      }
      get_dashboard_stats_v2: {
        Args: {
          p_end_date: string
          p_project_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      get_dashboard_stats_with_billing_types: {
        Args: {
          p_end_date: string
          p_project_id?: string
          p_start_date: string
        }
        Returns: Json
      }
      get_detailed_records_for_chart: {
        Args: {
          p_filter_type: string
          p_filter_value: string
          p_page_number: number
          p_page_size: number
        }
        Returns: Json
      }
      get_distinct_drivers_for_project: {
        Args: { p_project_id: string }
        Returns: {
          created_at: string
          driver_license_photos: Json | null
          driving_license_photos: Json | null
          id: string
          id_card_photos: Json | null
          license_plate: string
          name: string
          phone: string
          qualification_certificate_photos: Json | null
          transport_license_photos: Json | null
          updated_at: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "drivers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_distinct_locations_for_project: {
        Args: { p_project_id: string }
        Returns: string[]
      }
      get_drivers_for_project: {
        Args: { p_project_id: string }
        Returns: {
          id: string
          license_plate: string
          name: string
          phone: string
        }[]
      }
      get_drivers_paginated: {
        Args: {
          p_page_number?: number
          p_page_size?: number
          p_search_text?: string
        }
        Returns: {
          created_at: string
          driver_license_photos: Json
          driving_license_photos: Json
          id: string
          id_card_photos: Json
          license_plate: string
          name: string
          phone: string
          project_ids: string[]
          qualification_certificate_photos: Json
          total_records: number
          transport_license_photos: Json
        }[]
      }
      get_drivers_paginated_0827: {
        Args: { p_filter: string; p_page_number: number; p_page_size: number }
        Returns: Database["public"]["CompositeTypes"]["paginated_drivers_result"]
        SetofOptions: {
          from: "*"
          to: "paginated_drivers_result"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_filtered_logistics_records_fixed: {
        Args: {
          p_driver_id?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_filtered_logistics_records_v2: {
        Args: {
          p_billing_type_id: number
          p_driver_id: string
          p_end_date: string
          p_limit: number
          p_offset: number
          p_project_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_filtered_logistics_records_with_billing: {
        Args: {
          p_driver_id?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_filtered_logistics_with_billing: {
        Args: {
          p_driver_name?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_filtered_payment_requests: {
        Args: {
          p_application_end_date: string
          p_application_start_date: string
          p_driver_query: string
          p_end_date: string
          p_project_id: string
          p_record_autonumbers: string[]
          p_request_id: string
          p_start_date: string
        }
        Returns: {
          approval_result: Json | null
          created_at: string
          created_by: string | null
          id: string
          logistics_record_ids: string[] | null
          notes: string | null
          record_count: number
          request_id: string
          status: string
          updated_at: string | null
          user_id: string
          work_wechat_sp_no: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_filtered_payment_requests_0827: {
        Args: {
          p_driver_name: string
          p_end_date: string
          p_project_id: string
          p_request_id: string
          p_start_date: string
        }
        Returns: {
          approval_result: Json | null
          created_at: string
          created_by: string | null
          id: string
          logistics_record_ids: string[] | null
          notes: string | null
          record_count: number
          request_id: string
          status: string
          updated_at: string | null
          user_id: string
          work_wechat_sp_no: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "payment_requests"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_filtered_uninvoiced_partner_cost_ids: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: string[]
      }
      get_filtered_uninvoiced_record_ids:
        | {
            Args: {
              p_end_date?: string
              p_invoice_status_array?: string[]
              p_partner_id?: string
              p_project_id?: string
              p_start_date?: string
            }
            Returns: string[]
          }
        | {
            Args: {
              p_end_date?: string
              p_partner_id?: string
              p_project_id?: string
              p_start_date?: string
            }
            Returns: string[]
          }
      get_filtered_unpaid_ids: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: string[]
      }
      get_finance_reconciliation_by_partner: {
        Args: {
          p_end_date: string
          p_page_number: number
          p_page_size: number
          p_partner_id: string
          p_project_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_finance_reconciliation_by_partner_old: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_data: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_data_optimized: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_data_paginated: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_data2: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_financial_overview: { Args: never; Returns: Json }
      get_hierarchy_statistics: {
        Args: never
        Returns: {
          avg_depth: number
          leaf_partners: number
          max_depth: number
          partners_with_children: number
          root_partners: number
          total_partners: number
        }[]
      }
      get_hierarchy_tree: {
        Args: { root_id?: string }
        Returns: {
          children_count: number
          hierarchy_depth: number
          hierarchy_path: string
          id: string
          is_root: boolean
          name: string
          parent_id: string
        }[]
      }
      get_import_templates: {
        Args: { p_platform_type?: string }
        Returns: {
          created_at: string
          description: string
          field_mappings: Json
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          platform_type: string
          template_config: Json
        }[]
      }
      get_invoice_data_by_record_ids: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      get_invoice_request_data: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_driver_receivable?: string
          p_end_date?: string
          p_invoice_status_array?: string[]
          p_license_plate?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_invoice_request_data_latest: {
        Args: {
          p_end_date?: string
          p_invoice_status_array?: string[]
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_invoice_request_data_v2:
        | {
            Args: { p_record_ids: string[] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_invoice_request_data_v2(p_record_ids => _text), public.get_invoice_request_data_v2(p_record_ids => _uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { p_record_ids: string[] }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_invoice_request_data_v2(p_record_ids => _text), public.get_invoice_request_data_v2(p_record_ids => _uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: {
              p_end_date?: string
              p_invoice_status_array?: string[]
              p_page_number?: number
              p_page_size?: number
              p_partner_id?: string
              p_project_id?: string
              p_start_date?: string
            }
            Returns: Json
          }
      get_locations_for_geocoding: {
        Args: { p_limit?: number }
        Returns: {
          address: string
          geocoding_status: Database["public"]["Enums"]["geocoding_status"]
          geocoding_updated_at: string
          id: string
          name: string
        }[]
      }
      get_locations_for_project: {
        Args: { p_project_id: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_logistics_record_by_external_tracking: {
        Args: { p_tracking_number: string }
        Returns: {
          auto_number: string
          driver_name: string
          external_tracking_numbers: Json
          id: string
          loading_date: string
          loading_location: string
          project_name: string
        }[]
      }
      get_logistics_records_by_platform: {
        Args: { p_platform_name: string }
        Returns: {
          auto_number: string
          driver_name: string
          id: string
          loading_date: string
          loading_location: string
          other_platform_names: string[]
          project_name: string
        }[]
      }
      get_logistics_records_paginated: {
        Args: {
          p_end_date: string
          p_page_number: number
          p_page_size: number
          p_project_name?: string
          p_search_term?: string
          p_start_date: string
        }
        Returns: {
          auto_number: string
          cooperative_partner: string
          current_cost: number
          driver_name: string
          id: string
          license_plate: string
          loading_date: string
          loading_location: string
          loading_weight: number
          payable_cost: number
          project_name: string
          remarks: string
          unloading_date: string
          unloading_location: string
          unloading_weight: number
        }[]
      }
      get_logistics_records_paginated_old_sig: {
        Args: {
          p_end_date: string
          p_page_number: number
          p_page_size: number
          p_project_name: string
          p_search_term: string
          p_start_date: string
        }
        Returns: {
          auto_number: string
          cooperative_partner: string
          current_cost: number
          driver_name: string
          id: string
          license_plate: string
          loading_date: string
          loading_location: string
          loading_weight: number
          payable_cost: number
          project_name: string
          remarks: string
          unloading_date: string
          unloading_location: string
          unloading_weight: number
        }[]
      }
      get_logistics_summary_and_records: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_page_number?: number
          p_page_size?: number
          p_project_name?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_logistics_summary_and_records_backup: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_page_number?: number
          p_page_size?: number
          p_project_name?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_logistics_summary_and_records_bak: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_page_number?: number
          p_page_size?: number
          p_project_name?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_logistics_summary_and_records_enhanced: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_project_name?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_monthly_receivables: { Args: never; Returns: number }
      get_monthly_trends: {
        Args: never
        Returns: {
          month_start: string
          total_receivables: number
        }[]
      }
      get_my_claim: { Args: { claim: string }; Returns: string }
      get_my_role: { Args: never; Returns: string }
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
      get_or_create_locations_batch: {
        Args: { p_location_strings: string[] }
        Returns: string[]
      }
      get_or_create_locations_batch_v2: {
        Args: { p_location_strings: string[] }
        Returns: string[]
      }
      get_or_create_locations_from_string: {
        Args: { p_location_string: string }
        Returns: string[]
      }
      get_or_create_locations_from_string_v2: {
        Args: { p_location_string: string }
        Returns: string[]
      }
      get_paginated_logistics_records: {
        Args: {
          p_end_date?: string
          p_offset: number
          p_page_size: number
          p_search_query?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_paginated_logistics_records_with_filters: {
        Args: {
          p_end_date?: string
          p_offset: number
          p_page_size: number
          p_project_id?: string
          p_search_query?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_partner_payables_summary: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: {
          level: number
          partner_id: string
          partner_name: string
          records_count: number
          total_payable: number
        }[]
      }
      get_partner_ranking: {
        Args: never
        Returns: {
          partner_name: string
          total_payable: number
        }[]
      }
      get_payment_invoice_data: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_ids?: string[]
          p_project_ids?: string[]
          p_start_date?: string
        }
        Returns: Json
      }
      get_payment_invoice_data_optimized: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_ids?: string[]
          p_project_ids?: string[]
          p_start_date?: string
        }
        Returns: Json
      }
      get_payment_request_data: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_payment_request_data_0827: {
        Args: {
          p_end_date: string
          p_page_number: number
          p_page_size: number
          p_partner_id: string
          p_payment_status_array: string[]
          p_project_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_payment_request_data_925: {
        Args: {
          p_driver_names: string[]
          p_end_date: string
          p_page_number: number
          p_page_size: number
          p_partner_id: string
          p_payment_status_array: string[]
          p_project_id: string
          p_start_date: string
        }
        Returns: Json
      }
      get_payment_request_data_bak: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_payment_request_data_v2: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      get_payment_request_list: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_payment_request_pdf_data: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      get_payment_request_preview: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      get_payment_requests_filter_stats: {
        Args: {
          p_driver_name?: string
          p_loading_date?: string
          p_request_id?: string
          p_waybill_number?: string
        }
        Returns: {
          approved_requests: number
          paid_requests: number
          pending_requests: number
          rejected_requests: number
          total_amount: number
          total_requests: number
          total_waybills: number
        }[]
      }
      get_payment_requests_filtered: {
        Args: {
          p_driver_name?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_request_id?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: {
          created_at: string
          id: string
          logistics_record_ids: string[]
          notes: string
          record_count: number
          request_id: string
          status: string
          total_count: number
        }[]
      }
      get_payment_requests_filtered_export: {
        Args: {
          p_driver_name?: string
          p_export_format?: string
          p_loading_date?: string
          p_request_id?: string
          p_waybill_number?: string
        }
        Returns: string
      }
      get_payment_requests_suggestions: {
        Args: { p_limit?: number; p_query: string; p_type: string }
        Returns: {
          count: number
          value: string
        }[]
      }
      get_pending_invoicing: { Args: never; Returns: number }
      get_pending_payments: { Args: never; Returns: number }
      get_permission_stats: {
        Args: never
        Returns: {
          active_users: number
          total_role_templates: number
          total_user_permissions: number
          total_users: number
          users_with_custom_permissions: number
        }[]
      }
      get_permission_sync_status: {
        Args: never
        Returns: {
          last_sync: string
          minutes_since_sync: number
          sync_count: number
          table_name: string
        }[]
      }
      get_platform_usage_statistics: {
        Args: never
        Returns: {
          most_used_platform: string
          most_used_platform_count: number
          total_platform_mentions: number
          total_records_with_platforms: number
          unique_platforms: number
        }[]
      }
      get_project_available_chains:
        | {
            Args: { p_project_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_project_available_chains(p_project_id => text), public.get_project_available_chains(p_project_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { p_project_id: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.get_project_available_chains(p_project_id => text), public.get_project_available_chains(p_project_id => uuid). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      get_project_contribution: {
        Args: never
        Returns: {
          project_name: string
          total_receivables: number
        }[]
      }
      get_project_dashboard_data: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      get_project_dashboard_data_bak0817: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      get_project_dashboard_data_final: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      get_project_dashboard_data_v2: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Database["public"]["CompositeTypes"]["dashboard_data_type_v2"]
        SetofOptions: {
          from: "*"
          to: "dashboard_data_type_v2"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_project_dashboard_data_v3: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      get_project_dashboard_data_v8: {
        Args: { p_report_date: string; p_selected_project_id: string }
        Returns: Json
      }
      get_project_driver_ranking: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_order: string
          p_project_id: string
          p_report_date: string
          p_sort: string
        }
        Returns: {
          daily_trip_count: number
          driver_id: string
          driver_name: string
          license_plate: string
          phone: string
          total_driver_receivable: number
          total_tonnage: number
          total_trip_count: number
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
      get_project_overall_stats: {
        Args: { p_project_id: string }
        Returns: Json
      }
      get_project_quick_stats: { Args: never; Returns: Json }
      get_project_trend_by_range: {
        Args: { p_days: number; p_project_id: string }
        Returns: {
          date: string
          receivable: number
          trips: number
          weight: number
        }[]
      }
      get_projects_overview_with_driver_receivable:
        | {
            Args: {
              p_project_id?: string
              p_project_ids?: string[]
              p_report_date?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_project_id?: string
              p_project_ids?: string[]
              p_report_date?: string
            }
            Returns: Json
          }
      get_projects_with_details: { Args: never; Returns: Json }
      get_projects_with_details_fixed: { Args: never; Returns: Json }
      get_projects_with_details_optimized: { Args: never; Returns: Json }
      get_shipper_dashboard_stats: {
        Args: {
          p_end_date?: string
          p_include_self?: boolean
          p_include_subordinates?: boolean
          p_shipper_id: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_shipper_project_distribution: {
        Args: {
          p_end_date?: string
          p_shipper_id: string
          p_start_date?: string
        }
        Returns: {
          percentage: number
          project_id: string
          project_name: string
          record_count: number
          total_amount: number
          total_weight: number
        }[]
      }
      get_shipper_top_routes: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_shipper_id: string
          p_start_date?: string
        }
        Returns: {
          avg_amount: number
          avg_weight: number
          loading_location: string
          record_count: number
          total_amount: number
          total_weight: number
          unloading_location: string
        }[]
      }
      get_shipper_trend_data: {
        Args: { p_days?: number; p_shipper_id: string }
        Returns: {
          date: string
          self_amount: number
          self_count: number
          subordinates_amount: number
          subordinates_count: number
          total_amount: number
          total_count: number
        }[]
      }
      get_subordinate_shippers_stats: {
        Args: {
          p_end_date?: string
          p_shipper_id: string
          p_start_date?: string
        }
        Returns: {
          active_projects: number
          hierarchy_depth: number
          parent_id: string
          parent_name: string
          pending_invoices: number
          pending_payments: number
          record_count: number
          shipper_id: string
          shipper_name: string
          total_amount: number
          total_weight: number
        }[]
      }
      get_template_field_mappings: {
        Args: { p_template_id: string }
        Returns: {
          database_field: string
          default_value: string
          display_order: number
          excel_column: string
          field_type: string
          id: string
          is_required: boolean
          validation_rules: Json
        }[]
      }
      get_template_fixed_mappings: {
        Args: { p_mapping_type?: string; p_template_id: string }
        Returns: {
          database_value: string
          excel_value: string
          id: string
          is_case_sensitive: boolean
          mapping_type: string
        }[]
      }
      get_today_stats: { Args: never; Returns: Json }
      get_top_partner_daily_trend: {
        Args: { end_date: string; start_date: string }
        Returns: {
          date: string
          partner_name: string
          payable_amount: number
          trip_count: number
        }[]
      }
      get_total_receivables: { Args: never; Returns: number }
      get_transport_overview: {
        Args: { p_end_date: string; p_project_id: string; p_start_date: string }
        Returns: Json
      }
      get_unified_dashboard_stats: {
        Args: {
          end_date: string
          project_id_filter?: string
          start_date: string
        }
        Returns: Json
      }
      get_unread_notification_count: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_by_username: {
        Args: { username_input: string }
        Returns: string
      }
      get_user_contract_permissions: {
        Args: { p_contract_id?: string; p_user_id: string }
        Returns: {
          contract_id: string
          expires_at: string
          permission_type: string
          source: string
        }[]
      }
      get_user_id_by_email: { Args: { p_email: string }; Returns: string }
      get_user_notifications: {
        Args: {
          p_is_read?: boolean
          p_limit?: number
          p_offset?: number
          p_user_id: string
        }
        Returns: {
          category: string
          created_at: string
          id: string
          is_read: boolean
          link: string
          message: string
          read_at: string
          related_id: string
          title: string
          type: string
        }[]
      }
      get_user_projects: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_logistics_data: { Args: { p_records: Json }; Returns: Json }
      import_logistics_data_v2: { Args: { p_records: Json }; Returns: Json }
      is_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_admin_for_invoice: { Args: { _user_id?: string }; Returns: boolean }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_finance_operator_or_admin: { Args: never; Returns: boolean }
      is_finance_or_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_finance_or_admin_for_invoice: { Args: never; Returns: boolean }
      is_finance_or_admin_old: { Args: never; Returns: boolean }
      log_permission_change: {
        Args: {
          p_action: string
          p_new_value?: Json
          p_old_value?: Json
          p_permission_key: string
          p_permission_type: string
          p_reason?: string
          p_target_project_id?: string
          p_target_user_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      log_user_info_change: {
        Args: {
          p_change_type: string
          p_new_value: Json
          p_old_value: Json
          p_reason?: string
          p_user_id: string
        }
        Returns: undefined
      }
      login_with_username_or_email: {
        Args: { identifier: string }
        Returns: {
          user_email: string
        }[]
      }
      mark_all_notifications_as_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      mark_notification_as_read: {
        Args: { p_notification_id: string; p_user_id: string }
        Returns: undefined
      }
      modify_logistics_record_chain: {
        Args: { p_chain_name: string; p_record_id: string }
        Returns: Json
      }
      monitor_permission_realtime: {
        Args: never
        Returns: {
          message: string
          status: string
          update_time: string
        }[]
      }
      parse_location_string: {
        Args: { location_string: string }
        Returns: string[]
      }
      parse_location_string_v2: {
        Args: { location_string: string }
        Returns: string[]
      }
      preview_driver_project_association: {
        Args: { p_driver_ids: string[] }
        Returns: Json
      }
      preview_import_v2: { Args: { p_records: Json }; Returns: Json }
      preview_import_with_duplicates_check: {
        Args: { p_records: Json }
        Returns: Json
      }
      preview_import_with_duplicates_check_v2: {
        Args: { p_records: Json }
        Returns: Json
      }
      preview_import_with_optimized_duplicate_check: {
        Args: { p_records: Json }
        Returns: Json
      }
      preview_import_with_update_mode: {
        Args: { p_records: Json }
        Returns: Json
      }
      process_logistics_import: {
        Args: {
          records: Database["public"]["CompositeTypes"]["logistics_data_import_type"][]
        }
        Returns: {
          error_message: string
          line_number: number
        }[]
      }
      process_payment_application: {
        Args: { p_record_ids: string[] }
        Returns: string
      }
      process_payment_application_old: {
        Args: { p_record_ids: string[]; p_total_amount: number }
        Returns: string
      }
      recalculate_and_update_costs_for_record: {
        Args: { p_record_id: string }
        Returns: undefined
      }
      "recalculate_and_update_costs_for_record-old": {
        Args: { p_record_id: string }
        Returns: undefined
      }
      recalculate_and_update_costs_for_records: {
        Args: { p_record_ids: string[] }
        Returns: undefined
      }
      recalculate_and_update_costs_for_records_test: {
        Args: { p_record_ids: string[] }
        Returns: undefined
      }
      recalculate_costs_for_chain: {
        Args: { p_chain_id: string; p_project_id: string }
        Returns: number
      }
      recalculate_costs_for_chain_safe: {
        Args: {
          p_chain_id: string
          p_only_unpaid?: boolean
          p_project_id: string
        }
        Returns: Json
      }
      recalculate_costs_for_project: {
        Args: { p_project_id: string }
        Returns: Json
      }
      recalculate_costs_for_records_safe: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      remove_external_tracking_number: {
        Args: { p_logistics_record_id: string; p_tracking_number: string }
        Returns: boolean
      }
      resolve_and_preview_import: {
        Args: {
          p_records: Database["public"]["CompositeTypes"]["raw_import_record_input"][]
        }
        Returns: Json
      }
      rollback_payment_request_approval: {
        Args: { p_request_id: string }
        Returns: Json
      }
      rollback_payment_status_for_waybills: {
        Args: { p_record_ids: string[] }
        Returns: number
      }
      rollback_project_functions: { Args: never; Returns: undefined }
      safe_cast_effective_quantity_type: {
        Args: { input_text: string }
        Returns: Database["public"]["Enums"]["effective_quantity_type"]
      }
      safe_delete_logistics_records_by_project_v2: {
        Args: { p_project_name: string }
        Returns: Json
      }
      safe_delete_logistics_records_v2: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      safe_numeric_conversion: {
        Args: { default_value?: number; input_text: string }
        Returns: number
      }
      save_invoice_request: { Args: { p_record_ids: string[] }; Returns: Json }
      save_invoice_request_1014: {
        Args: { p_invoice_data: Json }
        Returns: Json
      }
      save_invoice_request_no: {
        Args: { p_invoice_status?: string; p_record_ids: string[] }
        Returns: Json
      }
      save_project_addresses_to_locations: {
        Args: {
          p_loading_address: string
          p_project_id: string
          p_unloading_address: string
        }
        Returns: undefined
      }
      save_project_with_chains: {
        Args: { chains_data: Json; project_data: Json; project_id_in: string }
        Returns: undefined
      }
      save_project_with_chains_bak: {
        Args: { chains_data: Json; project_data: Json; project_id_in: string }
        Returns: undefined
      }
      save_project_with_chains_fixed: {
        Args: { chains_data: Json; project_data: Json; project_id_in: string }
        Returns: undefined
      }
      save_project_with_chains_safe: {
        Args: { chains_data: Json; project_data: Json; project_id_in: string }
        Returns: undefined
      }
      schedule_permission_maintenance: {
        Args: never
        Returns: {
          maintenance_task: string
          next_run: string
          status: string
        }[]
      }
      search_locations_with_geocoding: {
        Args: { p_include_coordinates?: boolean; p_query?: string }
        Returns: {
          address: string
          city: string
          district: string
          formatted_address: string
          geocoding_status: Database["public"]["Enums"]["geocoding_status"]
          id: string
          latitude: number
          longitude: number
          name: string
          province: string
        }[]
      }
      search_project_linked_items: {
        Args: {
          p_item_type: string
          p_project_id: string
          p_search_term: string
        }
        Returns: Json
      }
      set_cached_permissions: {
        Args: { p_cache_key: string; p_data: Json; p_expires_minutes?: number }
        Returns: undefined
      }
      set_payment_status_for_waybills: {
        Args: {
          p_payment_status: string
          p_record_ids: string[]
          p_user_id?: string
        }
        Returns: Json
      }
      sync_user_permissions_with_role:
        | { Args: never; Returns: undefined }
        | { Args: { role_name: string }; Returns: undefined }
      test_platform_fields_import: { Args: never; Returns: Json }
      test_supabase_realtime: {
        Args: never
        Returns: {
          test_name: string
          test_result: string
          test_time: string
        }[]
      }
      update_external_tracking_status: {
        Args: {
          p_logistics_record_id: string
          p_status: string
          p_tracking_number: string
        }
        Returns: boolean
      }
      update_location_geocoding: {
        Args: {
          p_adcode?: string
          p_address?: string
          p_city?: string
          p_citycode?: string
          p_district?: string
          p_error?: string
          p_formatted_address?: string
          p_latitude?: number
          p_location_id: string
          p_longitude?: number
          p_province?: string
          p_status?: Database["public"]["Enums"]["geocoding_status"]
          p_street?: string
          p_street_number?: string
          p_township?: string
        }
        Returns: boolean
      }
      update_logistics_record_platforms: {
        Args: { p_logistics_record_id: string; p_platform_names: string[] }
        Returns: boolean
      }
      update_logistics_record_via_recalc:
        | {
            Args: {
              p_chain_id: string
              p_current_cost: number
              p_driver_id: string
              p_driver_name: string
              p_driver_phone: string
              p_extra_cost: number
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_id: string
              p_project_name: string
              p_record_id: string
              p_remarks: string
              p_transport_type: string
              p_unloading_date: string
              p_unloading_location: string
              p_unloading_weight: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_chain_id: string
              p_current_cost: number
              p_driver_id: string
              p_driver_name: string
              p_driver_phone: string
              p_extra_cost: number
              p_license_plate: string
              p_loading_date: string
              p_loading_location: string
              p_loading_weight: number
              p_project_id: string
              p_project_name: string
              p_record_id: string
              p_remarks: string
              p_transport_type: string
              p_unloading_date: string
              p_unloading_location: string
              p_unloading_weight: number
            }
            Returns: undefined
          }
      update_logistics_record_with_costs: {
        Args: {
          p_chain_id: string
          p_current_cost: number
          p_driver_id: string
          p_driver_name: string
          p_driver_payable_cost: number
          p_driver_phone: string
          p_extra_cost: number
          p_license_plate: string
          p_loading_date: string
          p_loading_location: string
          p_loading_weight: number
          p_project_id: string
          p_project_name: string
          p_record_id: string
          p_remarks: string
          p_transport_type: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: undefined
      }
      update_permission_performance_stats: { Args: never; Returns: undefined }
      update_single_logistics_record: {
        Args: { p_record: Json; p_record_id: string }
        Returns: Json
      }
      update_sync_status: { Args: { p_table_name: string }; Returns: undefined }
      upsert_logistics_record: {
        Args: {
          p_chain_id: string
          p_current_cost: number
          p_driver_id: string
          p_driver_name: string
          p_driver_phone: string
          p_extra_cost: number
          p_force_insert?: boolean
          p_license_plate: string
          p_loading_date: string
          p_loading_location: string
          p_loading_weight: number
          p_project_id: string
          p_record_id: string
          p_remarks: string
          p_transport_type: string
          p_unloading_date: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: {
          message: string
          record_id: string
          status: string
        }[]
      }
      validate_chain_modification_permission: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      validate_external_tracking_uniqueness: {
        Args: {
          p_exclude_logistics_record_id?: string
          p_tracking_number: string
        }
        Returns: boolean
      }
      validate_platform_names: {
        Args: { p_platform_names: string[] }
        Returns: {
          cleaned_platforms: string[]
          error_message: string
          is_valid: boolean
        }[]
      }
      verify_role_creation: {
        Args: { role_key: string }
        Returns: {
          check_type: string
          details: string
          status: string
        }[]
      }
      void_invoice_request: {
        Args: { p_request_id: string; p_void_reason?: string }
        Returns: Json
      }
      void_payment_for_request: {
        Args: { p_cancel_reason?: string; p_request_id: string }
        Returns: Json
      }
      void_payment_request_with_rollback: {
        Args: { p_request_id: string }
        Returns: Json
      }
      void_payment_requests_by_ids: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "finance"
        | "business"
        | "partner"
        | "operator"
        | "viewer"
      contract_category: "行政合同" | "内部合同" | "业务合同"
      effective_quantity_type: "min_value" | "loading" | "unloading"
      geocoding_status: "pending" | "success" | "failed" | "retry"
      partner_type_enum: "货主" | "合作商" | "资方" | "本公司"
    }
    CompositeTypes: {
      dashboard_data_type_v2: {
        project_details: Json | null
        daily_report: Json | null
        seven_day_trend: Json | null
        summary_stats: Json | null
        driver_report_table: Json | null
        daily_logistics_records: Json | null
      }
      logistics_data_import_type: {
        project_id: string | null
        chain_id: string | null
        driver_id: string | null
        loading_location: string | null
        unloading_location: string | null
        loading_date: string | null
        unloading_date: string | null
        loading_weight: number | null
        unloading_weight: number | null
        current_cost: number | null
        extra_cost: number | null
        transport_type: string | null
        remarks: string | null
      }
      paginated_drivers_result: {
        drivers: Json | null
        total_count: number | null
      }
      partner_chain_type: {
        id: string | null
        chainName: string | null
        description: string | null
        isDefault: boolean | null
        partners: Json | null
      }
      partner_cost_type: {
        partner_id: string | null
        partner_name: string | null
        level: number | null
        payable_amount: number | null
      }
      processed_import_record_output: {
        project_id: string | null
        chain_id: string | null
        driver_id: string | null
        loading_location: string | null
        unloading_location: string | null
        loading_date: string | null
        unloading_date: string | null
        loading_weight: number | null
        unloading_weight: number | null
        current_cost: number | null
        extra_cost: number | null
        transport_type: string | null
        remarks: string | null
      }
      project_partner_type: {
        id: string | null
        partnerId: string | null
        level: number | null
        taxRate: number | null
        calculationMethod: string | null
        profitRate: number | null
      }
      raw_import_record_input: {
        project_name: string | null
        chain_name: string | null
        driver_name: string | null
        license_plate: string | null
        driver_phone: string | null
        loading_location: string | null
        unloading_location: string | null
        loading_date: string | null
        unloading_date: string | null
        loading_weight: number | null
        unloading_weight: number | null
        current_cost: number | null
        extra_cost: number | null
        transport_type: string | null
        remarks: string | null
        original_row_index: number | null
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
    Enums: {
      app_role: [
        "admin",
        "finance",
        "business",
        "partner",
        "operator",
        "viewer",
      ],
      contract_category: ["行政合同", "内部合同", "业务合同"],
      effective_quantity_type: ["min_value", "loading", "unloading"],
      geocoding_status: ["pending", "success", "failed", "retry"],
      partner_type_enum: ["货主", "合作商", "资方", "本公司"],
    },
  },
} as const
