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
      auth_users_backup_20251103: {
        Row: {
          aud: string | null
          banned_until: string | null
          confirmation_sent_at: string | null
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          deleted_at: string | null
          email: string | null
          email_change: string | null
          email_change_confirm_status: number | null
          email_change_sent_at: string | null
          email_change_token_current: string | null
          email_change_token_new: string | null
          email_confirmed_at: string | null
          encrypted_password: string | null
          id: string | null
          instance_id: string | null
          invited_at: string | null
          is_anonymous: boolean | null
          is_sso_user: boolean | null
          is_super_admin: boolean | null
          last_sign_in_at: string | null
          phone: string | null
          phone_change: string | null
          phone_change_sent_at: string | null
          phone_change_token: string | null
          phone_confirmed_at: string | null
          raw_app_meta_data: Json | null
          raw_user_meta_data: Json | null
          reauthentication_sent_at: string | null
          reauthentication_token: string | null
          recovery_sent_at: string | null
          recovery_token: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          aud?: string | null
          banned_until?: string | null
          confirmation_sent_at?: string | null
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string | null
          email_change?: string | null
          email_change_confirm_status?: number | null
          email_change_sent_at?: string | null
          email_change_token_current?: string | null
          email_change_token_new?: string | null
          email_confirmed_at?: string | null
          encrypted_password?: string | null
          id?: string | null
          instance_id?: string | null
          invited_at?: string | null
          is_anonymous?: boolean | null
          is_sso_user?: boolean | null
          is_super_admin?: boolean | null
          last_sign_in_at?: string | null
          phone?: string | null
          phone_change?: string | null
          phone_change_sent_at?: string | null
          phone_change_token?: string | null
          phone_confirmed_at?: string | null
          raw_app_meta_data?: Json | null
          raw_user_meta_data?: Json | null
          reauthentication_sent_at?: string | null
          reauthentication_token?: string | null
          recovery_sent_at?: string | null
          recovery_token?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      dispatch_orders: {
        Row: {
          accepted_at: string | null
          actual_loading_date: string | null
          completed_at: string | null
          completion_remarks: string | null
          created_at: string | null
          driver_id: string
          expected_cost: number | null
          expected_loading_date: string | null
          expected_weight: number | null
          fleet_manager_id: string
          id: string
          loading_location: string
          loading_location_id: string | null
          loading_weight: number | null
          logistics_record_id: string | null
          order_number: string
          project_id: string
          reject_reason: string | null
          rejected_at: string | null
          remarks: string | null
          scale_record_photos: Json | null
          status: string | null
          unloading_location: string
          unloading_location_id: string | null
          unloading_weight: number | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          actual_loading_date?: string | null
          completed_at?: string | null
          completion_remarks?: string | null
          created_at?: string | null
          driver_id: string
          expected_cost?: number | null
          expected_loading_date?: string | null
          expected_weight?: number | null
          fleet_manager_id: string
          id?: string
          loading_location: string
          loading_location_id?: string | null
          loading_weight?: number | null
          logistics_record_id?: string | null
          order_number: string
          project_id: string
          reject_reason?: string | null
          rejected_at?: string | null
          remarks?: string | null
          scale_record_photos?: Json | null
          status?: string | null
          unloading_location: string
          unloading_location_id?: string | null
          unloading_weight?: number | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          actual_loading_date?: string | null
          completed_at?: string | null
          completion_remarks?: string | null
          created_at?: string | null
          driver_id?: string
          expected_cost?: number | null
          expected_loading_date?: string | null
          expected_weight?: number | null
          fleet_manager_id?: string
          id?: string
          loading_location?: string
          loading_location_id?: string | null
          loading_weight?: number | null
          logistics_record_id?: string | null
          order_number?: string
          project_id?: string
          reject_reason?: string | null
          rejected_at?: string | null
          remarks?: string | null
          scale_record_photos?: Json | null
          status?: string | null
          unloading_location?: string
          unloading_location_id?: string | null
          unloading_weight?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_loading_location_id_fkey"
            columns: ["loading_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_orders_unloading_location_id_fkey"
            columns: ["unloading_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
          driver_type: string | null
          driving_license_photos: Json | null
          id: string
          id_card_photos: Json | null
          license_plate: string | null
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
          driver_type?: string | null
          driving_license_photos?: Json | null
          id?: string
          id_card_photos?: Json | null
          license_plate?: string | null
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
          driver_type?: string | null
          driving_license_photos?: Json | null
          id?: string
          id_card_photos?: Json | null
          license_plate?: string | null
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
      fleet_manager_favorite_route_drivers: {
        Row: {
          created_at: string | null
          driver_id: string
          fleet_manager_id: string | null
          id: string
          route_id: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          fleet_manager_id?: string | null
          id?: string
          route_id: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          fleet_manager_id?: string | null
          id?: string
          route_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_manager_favorite_route_drivers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_manager_favorite_route_drivers_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "fleet_manager_favorite_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_manager_favorite_routes: {
        Row: {
          created_at: string | null
          fleet_manager_id: string
          id: string
          last_used_at: string | null
          loading_location: string
          loading_location_id: string | null
          notes: string | null
          project_id: string | null
          route_name: string
          unloading_location: string
          unloading_location_id: string | null
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          created_at?: string | null
          fleet_manager_id: string
          id?: string
          last_used_at?: string | null
          loading_location: string
          loading_location_id?: string | null
          notes?: string | null
          project_id?: string | null
          route_name: string
          unloading_location: string
          unloading_location_id?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          created_at?: string | null
          fleet_manager_id?: string
          id?: string
          last_used_at?: string | null
          loading_location?: string
          loading_location_id?: string | null
          notes?: string | null
          project_id?: string | null
          route_name?: string
          unloading_location?: string
          unloading_location_id?: string | null
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fleet_manager_favorite_routes_loading_location_id_fkey"
            columns: ["loading_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_manager_favorite_routes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fleet_manager_favorite_routes_unloading_location_id_fkey"
            columns: ["unloading_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      fleet_manager_projects: {
        Row: {
          assigned_at: string | null
          created_at: string | null
          created_by: string | null
          fleet_manager_id: string
          id: string
          project_id: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fleet_manager_id: string
          id?: string
          project_id: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string | null
          created_by?: string | null
          fleet_manager_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fleet_manager_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      frontend_error_logs: {
        Row: {
          created_at: string
          error_info: Json | null
          error_message: string
          error_name: string | null
          error_stack: string | null
          error_type: string
          id: string
          is_resolved: boolean | null
          metadata: Json | null
          resolved_at: string | null
          resolved_by: string | null
          resolved_note: string | null
          retry_count: number | null
          url: string | null
          user_agent: string | null
          user_id: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          created_at?: string
          error_info?: Json | null
          error_message: string
          error_name?: string | null
          error_stack?: string | null
          error_type: string
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          retry_count?: number | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          created_at?: string
          error_info?: Json | null
          error_message?: string
          error_name?: string | null
          error_stack?: string | null
          error_type?: string
          id?: string
          is_resolved?: boolean | null
          metadata?: Json | null
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_note?: string | null
          retry_count?: number | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "frontend_error_logs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frontend_error_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      internal_driver_expense_applications: {
        Row: {
          actual_amount: number | null
          amount: number
          application_number: string
          created_at: string | null
          description: string | null
          driver_id: string
          driver_name: string | null
          expense_date: string
          expense_type: string
          id: string
          payment_time: string | null
          payment_vouchers: Json | null
          receipt_photos: Json | null
          review_comment: string | null
          review_time: string | null
          reviewer_id: string | null
          status: string | null
          updated_at: string | null
          writeoff_time: string | null
        }
        Insert: {
          actual_amount?: number | null
          amount: number
          application_number: string
          created_at?: string | null
          description?: string | null
          driver_id: string
          driver_name?: string | null
          expense_date: string
          expense_type: string
          id?: string
          payment_time?: string | null
          payment_vouchers?: Json | null
          receipt_photos?: Json | null
          review_comment?: string | null
          review_time?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
          writeoff_time?: string | null
        }
        Update: {
          actual_amount?: number | null
          amount?: number
          application_number?: string
          created_at?: string | null
          description?: string | null
          driver_id?: string
          driver_name?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          payment_time?: string | null
          payment_vouchers?: Json | null
          receipt_photos?: Json | null
          review_comment?: string | null
          review_time?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
          writeoff_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_driver_expense_applications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_driver_monthly_salary: {
        Row: {
          base_salary: number | null
          created_at: string | null
          deductions: number | null
          driver_id: string
          id: string
          net_salary: number | null
          payment_date: string | null
          remarks: string | null
          status: string | null
          total_income: number | null
          trip_commission: number | null
          trip_count: number | null
          updated_at: string | null
          year_month: string
        }
        Insert: {
          base_salary?: number | null
          created_at?: string | null
          deductions?: number | null
          driver_id: string
          id?: string
          net_salary?: number | null
          payment_date?: string | null
          remarks?: string | null
          status?: string | null
          total_income?: number | null
          trip_commission?: number | null
          trip_count?: number | null
          updated_at?: string | null
          year_month: string
        }
        Update: {
          base_salary?: number | null
          created_at?: string | null
          deductions?: number | null
          driver_id?: string
          id?: string
          net_salary?: number | null
          payment_date?: string | null
          remarks?: string | null
          status?: string | null
          total_income?: number | null
          trip_commission?: number | null
          trip_count?: number | null
          updated_at?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_driver_monthly_salary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_driver_project_routes: {
        Row: {
          common_loading_location_ids: string[] | null
          common_unloading_location_ids: string[] | null
          created_at: string | null
          driver_id: string
          id: string
          is_primary_route: boolean | null
          project_id: string
        }
        Insert: {
          common_loading_location_ids?: string[] | null
          common_unloading_location_ids?: string[] | null
          created_at?: string | null
          driver_id: string
          id?: string
          is_primary_route?: boolean | null
          project_id: string
        }
        Update: {
          common_loading_location_ids?: string[] | null
          common_unloading_location_ids?: string[] | null
          created_at?: string | null
          driver_id?: string
          id?: string
          is_primary_route?: boolean | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_driver_project_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_driver_project_routes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_driver_vehicle_relations: {
        Row: {
          created_at: string | null
          driver_id: string
          id: string
          is_primary: boolean | null
          relation_type: string | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          driver_id: string
          id?: string
          is_primary?: boolean | null
          relation_type?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string
          id?: string
          is_primary?: boolean | null
          relation_type?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_driver_vehicle_relations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_driver_vehicle_relations_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "internal_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_drivers: {
        Row: {
          account_holder_name: string | null
          bank_account: string | null
          bank_name: string | null
          base_salary: number | null
          commission_rate: number | null
          created_at: string | null
          driver_license_expire_date: string | null
          driver_license_photos: Json | null
          employment_status: string | null
          fleet_manager_id: string | null
          hire_date: string | null
          id: string
          id_card_expire_date: string | null
          id_card_number: string | null
          id_card_photos: Json | null
          is_active: boolean | null
          linked_user_id: string | null
          name: string
          phone: string
          qualification_certificate_expire_date: string | null
          qualification_certificate_photos: Json | null
          remarks: string | null
          salary_calculation_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_holder_name?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          commission_rate?: number | null
          created_at?: string | null
          driver_license_expire_date?: string | null
          driver_license_photos?: Json | null
          employment_status?: string | null
          fleet_manager_id?: string | null
          hire_date?: string | null
          id?: string
          id_card_expire_date?: string | null
          id_card_number?: string | null
          id_card_photos?: Json | null
          is_active?: boolean | null
          linked_user_id?: string | null
          name: string
          phone: string
          qualification_certificate_expire_date?: string | null
          qualification_certificate_photos?: Json | null
          remarks?: string | null
          salary_calculation_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_holder_name?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number | null
          commission_rate?: number | null
          created_at?: string | null
          driver_license_expire_date?: string | null
          driver_license_photos?: Json | null
          employment_status?: string | null
          fleet_manager_id?: string | null
          hire_date?: string | null
          id?: string
          id_card_expire_date?: string | null
          id_card_number?: string | null
          id_card_photos?: Json | null
          is_active?: boolean | null
          linked_user_id?: string | null
          name?: string
          phone?: string
          qualification_certificate_expire_date?: string | null
          qualification_certificate_photos?: Json | null
          remarks?: string | null
          salary_calculation_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_drivers_fleet_manager_id_fkey"
            columns: ["fleet_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_vehicle_certificates: {
        Row: {
          alert_days: number | null
          cert_number: string | null
          cert_type: string
          created_at: string | null
          created_by: string | null
          expire_date: string
          file_url: string | null
          id: string
          issue_date: string | null
          issuing_authority: string | null
          remarks: string | null
          updated_at: string | null
          vehicle_id: string | null
        }
        Insert: {
          alert_days?: number | null
          cert_number?: string | null
          cert_type: string
          created_at?: string | null
          created_by?: string | null
          expire_date: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          remarks?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Update: {
          alert_days?: number | null
          cert_number?: string | null
          cert_type?: string
          created_at?: string | null
          created_by?: string | null
          expire_date?: string
          file_url?: string | null
          id?: string
          issue_date?: string | null
          issuing_authority?: string | null
          remarks?: string | null
          updated_at?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      internal_vehicle_change_applications: {
        Row: {
          application_number: string
          application_type: string | null
          created_at: string | null
          current_vehicle_id: string | null
          driver_id: string
          id: string
          reason: string
          requested_vehicle_id: string
          review_comment: string | null
          review_time: string | null
          reviewer_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          application_number: string
          application_type?: string | null
          created_at?: string | null
          current_vehicle_id?: string | null
          driver_id: string
          id?: string
          reason: string
          requested_vehicle_id: string
          review_comment?: string | null
          review_time?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          application_number?: string
          application_type?: string | null
          created_at?: string | null
          current_vehicle_id?: string | null
          driver_id?: string
          id?: string
          reason?: string
          requested_vehicle_id?: string
          review_comment?: string | null
          review_time?: string | null
          reviewer_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_vehicle_change_applications_current_vehicle_id_fkey"
            columns: ["current_vehicle_id"]
            isOneToOne: false
            referencedRelation: "internal_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_vehicle_change_applications_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "internal_drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_vehicle_change_applications_requested_vehicle_id_fkey"
            columns: ["requested_vehicle_id"]
            isOneToOne: false
            referencedRelation: "internal_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_vehicle_driver_history: {
        Row: {
          bind_reason: string | null
          created_at: string | null
          driver_id: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          start_date: string
          unbind_reason: string | null
          vehicle_id: string | null
        }
        Insert: {
          bind_reason?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          start_date: string
          unbind_reason?: string | null
          vehicle_id?: string | null
        }
        Update: {
          bind_reason?: string | null
          created_at?: string | null
          driver_id?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          start_date?: string
          unbind_reason?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_vehicle_driver_history_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_vehicle_expense_details: {
        Row: {
          amount: number | null
          created_at: string | null
          date: string | null
          expense_category: string
          expense_item: string | null
          id: string
          item_number: number | null
          month_period: string | null
          payer: string | null
          vehicle_id: string | null
          voucher: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          date?: string | null
          expense_category: string
          expense_item?: string | null
          id?: string
          item_number?: number | null
          month_period?: string | null
          payer?: string | null
          vehicle_id?: string | null
          voucher?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          date?: string | null
          expense_category?: string
          expense_item?: string | null
          id?: string
          item_number?: number | null
          month_period?: string | null
          payer?: string | null
          vehicle_id?: string | null
          voucher?: string | null
        }
        Relationships: []
      }
      internal_vehicle_ledger: {
        Row: {
          balance: number | null
          category: string | null
          created_at: string | null
          created_by: string | null
          credit: number | null
          debit: number | null
          description: string
          id: string
          sequence_number: number | null
          source_id: string | null
          source_type: string | null
          transaction_date: string
          transaction_type: string | null
          vehicle_id: string | null
        }
        Insert: {
          balance?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          description: string
          id?: string
          sequence_number?: number | null
          source_id?: string | null
          source_type?: string | null
          transaction_date: string
          transaction_type?: string | null
          vehicle_id?: string | null
        }
        Update: {
          balance?: number | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          credit?: number | null
          debit?: number | null
          description?: string
          id?: string
          sequence_number?: number | null
          source_id?: string | null
          source_type?: string | null
          transaction_date?: string
          transaction_type?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      internal_vehicle_monthly_income: {
        Row: {
          created_at: string | null
          id: string
          income_amount: number
          income_date: string | null
          income_source: string | null
          income_type: string | null
          input_by: string | null
          month_period: string
          related_logistics_ids: string[] | null
          related_project_id: string | null
          remarks: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          income_amount: number
          income_date?: string | null
          income_source?: string | null
          income_type?: string | null
          input_by?: string | null
          month_period: string
          related_logistics_ids?: string[] | null
          related_project_id?: string | null
          remarks?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          income_amount?: number
          income_date?: string | null
          income_source?: string | null
          income_type?: string | null
          input_by?: string | null
          month_period?: string
          related_logistics_ids?: string[] | null
          related_project_id?: string | null
          remarks?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_vehicle_monthly_income_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_vehicle_monthly_summary: {
        Row: {
          company_fuel: number | null
          created_at: string | null
          driver_fuel: number | null
          driver_id: string | null
          etc_fee: number | null
          freight_income: number | null
          gross_profit: number | null
          id: string
          maintenance_fee: number | null
          mileage: number | null
          month_period: string
          salary_overtime: number | null
          salary_public_transfer: number | null
          salary_subsidy: number | null
          salary_total: number | null
          total_expense: number | null
          traffic_fine: number | null
          updated_at: string | null
          urea_welding: number | null
          vehicle_id: string | null
        }
        Insert: {
          company_fuel?: number | null
          created_at?: string | null
          driver_fuel?: number | null
          driver_id?: string | null
          etc_fee?: number | null
          freight_income?: number | null
          gross_profit?: number | null
          id?: string
          maintenance_fee?: number | null
          mileage?: number | null
          month_period: string
          salary_overtime?: number | null
          salary_public_transfer?: number | null
          salary_subsidy?: number | null
          salary_total?: number | null
          total_expense?: number | null
          traffic_fine?: number | null
          updated_at?: string | null
          urea_welding?: number | null
          vehicle_id?: string | null
        }
        Update: {
          company_fuel?: number | null
          created_at?: string | null
          driver_fuel?: number | null
          driver_id?: string | null
          etc_fee?: number | null
          freight_income?: number | null
          gross_profit?: number | null
          id?: string
          maintenance_fee?: number | null
          mileage?: number | null
          month_period?: string
          salary_overtime?: number | null
          salary_public_transfer?: number | null
          salary_subsidy?: number | null
          salary_total?: number | null
          total_expense?: number | null
          traffic_fine?: number | null
          updated_at?: string | null
          urea_welding?: number | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_vehicle_monthly_summary_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_vehicles: {
        Row: {
          annual_inspection_date: string | null
          created_at: string | null
          current_mileage: number | null
          driving_license_expire_date: string | null
          driving_license_number: string | null
          driving_license_photos: Json | null
          engine_number: string | null
          fleet_manager_id: string | null
          fuel_type: string | null
          id: string
          insurance_amount: number | null
          insurance_certificate_photos: Json | null
          insurance_company: string | null
          insurance_expire_date: string | null
          insurance_policy_number: string | null
          insurance_start_date: string | null
          insurance_type: string | null
          is_active: boolean | null
          last_maintenance_date: string | null
          license_plate: string
          load_capacity: number | null
          maintenance_mileage: number | null
          manufacture_year: number | null
          next_maintenance_date: string | null
          purchase_date: string | null
          purchase_price: number | null
          purchase_type: string | null
          remarks: string | null
          transport_license_expire_date: string | null
          transport_license_number: string | null
          transport_license_photos: Json | null
          updated_at: string | null
          user_id: string | null
          vehicle_brand: string | null
          vehicle_color: string | null
          vehicle_height: number | null
          vehicle_length: number | null
          vehicle_model: string | null
          vehicle_number: string | null
          vehicle_photos: Json | null
          vehicle_status: string | null
          vehicle_type: string | null
          vehicle_width: number | null
          vin: string | null
        }
        Insert: {
          annual_inspection_date?: string | null
          created_at?: string | null
          current_mileage?: number | null
          driving_license_expire_date?: string | null
          driving_license_number?: string | null
          driving_license_photos?: Json | null
          engine_number?: string | null
          fleet_manager_id?: string | null
          fuel_type?: string | null
          id?: string
          insurance_amount?: number | null
          insurance_certificate_photos?: Json | null
          insurance_company?: string | null
          insurance_expire_date?: string | null
          insurance_policy_number?: string | null
          insurance_start_date?: string | null
          insurance_type?: string | null
          is_active?: boolean | null
          last_maintenance_date?: string | null
          license_plate: string
          load_capacity?: number | null
          maintenance_mileage?: number | null
          manufacture_year?: number | null
          next_maintenance_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_type?: string | null
          remarks?: string | null
          transport_license_expire_date?: string | null
          transport_license_number?: string | null
          transport_license_photos?: Json | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_height?: number | null
          vehicle_length?: number | null
          vehicle_model?: string | null
          vehicle_number?: string | null
          vehicle_photos?: Json | null
          vehicle_status?: string | null
          vehicle_type?: string | null
          vehicle_width?: number | null
          vin?: string | null
        }
        Update: {
          annual_inspection_date?: string | null
          created_at?: string | null
          current_mileage?: number | null
          driving_license_expire_date?: string | null
          driving_license_number?: string | null
          driving_license_photos?: Json | null
          engine_number?: string | null
          fleet_manager_id?: string | null
          fuel_type?: string | null
          id?: string
          insurance_amount?: number | null
          insurance_certificate_photos?: Json | null
          insurance_company?: string | null
          insurance_expire_date?: string | null
          insurance_policy_number?: string | null
          insurance_start_date?: string | null
          insurance_type?: string | null
          is_active?: boolean | null
          last_maintenance_date?: string | null
          license_plate?: string
          load_capacity?: number | null
          maintenance_mileage?: number | null
          manufacture_year?: number | null
          next_maintenance_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          purchase_type?: string | null
          remarks?: string | null
          transport_license_expire_date?: string | null
          transport_license_number?: string | null
          transport_license_photos?: Json | null
          updated_at?: string | null
          user_id?: string | null
          vehicle_brand?: string | null
          vehicle_color?: string | null
          vehicle_height?: number | null
          vehicle_length?: number | null
          vehicle_model?: string | null
          vehicle_number?: string | null
          vehicle_photos?: Json | null
          vehicle_status?: string | null
          vehicle_type?: string | null
          vehicle_width?: number | null
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_vehicles_fleet_manager_id_fkey"
            columns: ["fleet_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_receipt_records: {
        Row: {
          created_at: string
          id: string
          invoice_request_id: string
          notes: string | null
          receipt_amount: number
          receipt_bank: string | null
          receipt_date: string
          receipt_images: string[] | null
          receipt_number: string | null
          received_by: string | null
          refund_amount: number | null
          refund_date: string | null
          refund_reason: string | null
          refunded_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_request_id: string
          notes?: string | null
          receipt_amount: number
          receipt_bank?: string | null
          receipt_date?: string
          receipt_images?: string[] | null
          receipt_number?: string | null
          received_by?: string | null
          refund_amount?: number | null
          refund_date?: string | null
          refund_reason?: string | null
          refunded_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_request_id?: string
          notes?: string | null
          receipt_amount?: number
          receipt_bank?: string | null
          receipt_date?: string
          receipt_images?: string[] | null
          receipt_number?: string | null
          received_by?: string | null
          refund_amount?: number | null
          refund_date?: string | null
          refund_reason?: string | null
          refunded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_receipt_records_invoice_request_id_fkey"
            columns: ["invoice_request_id"]
            isOneToOne: false
            referencedRelation: "invoice_requests"
            referencedColumns: ["id"]
          },
        ]
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
          is_merged_request: boolean | null
          is_voided: boolean | null
          last_reminder_at: string | null
          merged_count: number | null
          merged_from_requests: string[] | null
          overdue_days: number | null
          partner_full_name: string | null
          partner_id: string | null
          partner_name: string
          payment_due_date: string | null
          receipt_bank: string | null
          receipt_images: string[] | null
          receipt_number: string | null
          received_amount: number | null
          received_at: string | null
          received_by: string | null
          reconciliation_by: string | null
          reconciliation_date: string | null
          reconciliation_notes: string | null
          reconciliation_status: string | null
          record_count: number
          remarks: string | null
          reminder_count: number | null
          request_number: string
          status: string | null
          tax_number: string | null
          total_amount: number
          total_received_amount: number | null
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
          is_merged_request?: boolean | null
          is_voided?: boolean | null
          last_reminder_at?: string | null
          merged_count?: number | null
          merged_from_requests?: string[] | null
          overdue_days?: number | null
          partner_full_name?: string | null
          partner_id?: string | null
          partner_name: string
          payment_due_date?: string | null
          receipt_bank?: string | null
          receipt_images?: string[] | null
          receipt_number?: string | null
          received_amount?: number | null
          received_at?: string | null
          received_by?: string | null
          reconciliation_by?: string | null
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string | null
          record_count?: number
          remarks?: string | null
          reminder_count?: number | null
          request_number: string
          status?: string | null
          tax_number?: string | null
          total_amount?: number
          total_received_amount?: number | null
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
          is_merged_request?: boolean | null
          is_voided?: boolean | null
          last_reminder_at?: string | null
          merged_count?: number | null
          merged_from_requests?: string[] | null
          overdue_days?: number | null
          partner_full_name?: string | null
          partner_id?: string | null
          partner_name?: string
          payment_due_date?: string | null
          receipt_bank?: string | null
          receipt_images?: string[] | null
          receipt_number?: string | null
          received_amount?: number | null
          received_at?: string | null
          received_by?: string | null
          reconciliation_by?: string | null
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string | null
          record_count?: number
          remarks?: string | null
          reminder_count?: number | null
          request_number?: string
          status?: string | null
          tax_number?: string | null
          total_amount?: number
          total_received_amount?: number | null
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
          nickname: string | null
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
          nickname?: string | null
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
          nickname?: string | null
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
          is_manually_modified: boolean | null
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          payment_applied_at: string | null
          payment_completed_at: string | null
          payment_reference: string | null
          payment_request_id: string | null
          payment_status: string | null
          reconciliation_by: string | null
          reconciliation_date: string | null
          reconciliation_notes: string | null
          reconciliation_status: string | null
          tax_rate: number
          updated_at: string | null
          user_id: string | null
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
          is_manually_modified?: boolean | null
          level: number
          logistics_record_id: string
          partner_id: string
          payable_amount: number
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string | null
          reconciliation_by?: string | null
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string | null
          tax_rate: number
          updated_at?: string | null
          user_id?: string | null
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
          is_manually_modified?: boolean | null
          level?: number
          logistics_record_id?: string
          partner_id?: string
          payable_amount?: number
          payment_applied_at?: string | null
          payment_completed_at?: string | null
          payment_reference?: string | null
          payment_request_id?: string | null
          payment_status?: string | null
          reconciliation_by?: string | null
          reconciliation_date?: string | null
          reconciliation_notes?: string | null
          reconciliation_status?: string | null
          tax_rate?: number
          updated_at?: string | null
          user_id?: string | null
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
            foreignKeyName: "fk_logistics_partner_costs_payment_request_id"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
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
          calculation_mode: string | null
          cargo_type: string | null
          chain_id: string | null
          created_at: string
          created_by_user_id: string
          current_cost: number | null
          driver_id: string | null
          driver_name: string
          driver_phone: string
          effective_quantity: number | null
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
          receipt_status: string | null
          remarks: string | null
          transport_type: string
          unit_price: number | null
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
          calculation_mode?: string | null
          cargo_type?: string | null
          chain_id?: string | null
          created_at?: string
          created_by_user_id: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name: string
          driver_phone: string
          effective_quantity?: number | null
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
          receipt_status?: string | null
          remarks?: string | null
          transport_type: string
          unit_price?: number | null
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
          calculation_mode?: string | null
          cargo_type?: string | null
          chain_id?: string | null
          created_at?: string
          created_by_user_id?: string
          current_cost?: number | null
          driver_id?: string | null
          driver_name?: string
          driver_phone?: string
          effective_quantity?: number | null
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
          receipt_status?: string | null
          remarks?: string | null
          transport_type?: string
          unit_price?: number | null
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
      menu_config: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_group: boolean | null
          key: string
          order_index: number
          parent_key: string | null
          required_permissions: string[] | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          key: string
          order_index?: number
          parent_key?: string | null
          required_permissions?: string[] | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_group?: boolean | null
          key?: string
          order_index?: number
          parent_key?: string | null
          required_permissions?: string[] | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
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
      partner_balance: {
        Row: {
          balance: number
          partner_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          partner_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          partner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_balance_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_balance_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners_hierarchy_view"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_balance_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          partner_id: string
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          transaction_category: string
          transaction_type: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          partner_id: string
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          transaction_category: string
          transaction_type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          partner_id?: string
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          transaction_category?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_balance_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_balance_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners_hierarchy_view"
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
      payment_items: {
        Row: {
          created_at: string | null
          logistics_record_id: string
          payment_request_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          logistics_record_id: string
          payment_request_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          logistics_record_id?: string
          payment_request_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_status_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_items_logistics_record_id_fkey"
            columns: ["logistics_record_id"]
            isOneToOne: false
            referencedRelation: "logistics_records_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_items_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
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
          is_merged_request: boolean | null
          logistics_record_ids: string[] | null
          merged_count: number | null
          merged_from_requests: string[] | null
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
          is_merged_request?: boolean | null
          logistics_record_ids?: string[] | null
          merged_count?: number | null
          merged_from_requests?: string[] | null
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
          is_merged_request?: boolean | null
          logistics_record_ids?: string[] | null
          merged_count?: number | null
          merged_from_requests?: string[] | null
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
          unit_price: number | null
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
          unit_price?: number | null
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
          unit_price?: number | null
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
      role_permission_templates_backup_20251103: {
        Row: {
          color: string | null
          created_at: string | null
          data_permissions: string[] | null
          description: string | null
          function_permissions: string[] | null
          id: string | null
          is_system: boolean | null
          menu_permissions: string[] | null
          name: string | null
          project_permissions: string[] | null
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          data_permissions?: string[] | null
          description?: string | null
          function_permissions?: string[] | null
          id?: string | null
          is_system?: boolean | null
          menu_permissions?: string[] | null
          name?: string | null
          project_permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          data_permissions?: string[] | null
          description?: string | null
          function_permissions?: string[] | null
          id?: string | null
          is_system?: boolean | null
          menu_permissions?: string[] | null
          name?: string | null
          project_permissions?: string[] | null
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string | null
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
      tracking_token_cache: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_type: string
          token_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_type: string
          token_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_type?: string
          token_value?: string
          updated_at?: string | null
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
      user_permissions_backup_20251103: {
        Row: {
          created_at: string | null
          created_by: string | null
          custom_settings: Json | null
          data_permissions: string[] | null
          function_permissions: string[] | null
          id: string | null
          inherit_role: boolean | null
          menu_permissions: string[] | null
          project_id: string | null
          project_permissions: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          custom_settings?: Json | null
          data_permissions?: string[] | null
          function_permissions?: string[] | null
          id?: string | null
          inherit_role?: boolean | null
          menu_permissions?: string[] | null
          project_id?: string | null
          project_permissions?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          custom_settings?: Json | null
          data_permissions?: string[] | null
          function_permissions?: string[] | null
          id?: string | null
          inherit_role?: boolean | null
          menu_permissions?: string[] | null
          project_id?: string | null
          project_permissions?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      vehicle_tracking_id_mappings: {
        Row: {
          created_at: string | null
          dept_id: string | null
          external_tracking_id: string
          id: string
          last_synced_at: string | null
          license_plate: string
          updated_at: string | null
          vehicle_desc: string | null
        }
        Insert: {
          created_at?: string | null
          dept_id?: string | null
          external_tracking_id: string
          id?: string
          last_synced_at?: string | null
          license_plate: string
          updated_at?: string | null
          vehicle_desc?: string | null
        }
        Update: {
          created_at?: string | null
          dept_id?: string | null
          external_tracking_id?: string
          id?: string
          last_synced_at?: string | null
          license_plate?: string
          updated_at?: string | null
          vehicle_desc?: string | null
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
          calculation_mode: string | null
          cargo_type: string | null
          chain_id: string | null
          chain_name: string | null
          created_at: string | null
          created_by_user_id: string | null
          current_cost: number | null
          driver_id: string | null
          driver_name: string | null
          driver_phone: string | null
          effective_quantity: number | null
          external_tracking_numbers: string[] | null
          extra_cost: number | null
          id: string | null
          invoice_applied_at: string | null
          invoice_completed_at: string | null
          invoice_number: string | null
          invoice_request_id: string | null
          invoice_status: string | null
          license_plate: string | null
          loading_date: string | null
          loading_location: string | null
          loading_location_ids: string[] | null
          loading_weight: number | null
          other_platform_names: string[] | null
          payable_cost: number | null
          payment_applied_at: string | null
          payment_completed_at: string | null
          payment_reference: string | null
          payment_request_id: string | null
          payment_status: string | null
          project_id: string | null
          project_name: string | null
          receipt_status: string | null
          remarks: string | null
          transport_type: string | null
          unit_price: number | null
          unloading_date: string | null
          unloading_location: string | null
          unloading_location_ids: string[] | null
          unloading_weight: number | null
          updated_at: string | null
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
      accept_dispatch_order: { Args: { p_order_id: string }; Returns: Json }
      add_custom_platform: {
        Args: { p_description?: string; p_platform_name: string }
        Returns: string
      }
      add_enum_value: {
        Args: { enum_name: string; enum_value: string }
        Returns: undefined
      }
      add_expense_application_photos: {
        Args: { p_additional_photos: string[]; p_application_id: string }
        Returns: Json
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
        Returns: string
      }
      add_logistics_record_with_costs_1120: {
        Args: {
          p_billing_type_id: number
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
          p_unit_price: number
          p_unloading_date: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: string
      }
      add_logistics_record_with_costs_1126: {
        Args: {
          p_billing_type_id: number
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
          p_unit_price: number
          p_unloading_date: string
          p_unloading_location: string
          p_unloading_weight: number
        }
        Returns: string
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
      add_payment_vouchers: {
        Args: { p_application_id: string; p_payment_vouchers: string[] }
        Returns: Json
      }
      apply_standard_rls_policies: {
        Args: { p_table_name: string; p_user_id_column: string }
        Returns: undefined
      }
      approve_invoice_request: {
        Args: { p_action: string; p_remarks?: string; p_request_id: string }
        Returns: Json
      }
      approve_invoice_request_v2: {
        Args: { p_request_number: string }
        Returns: Json
      }
      approve_invoice_request_v2_1126: {
        Args: { p_request_number: string }
        Returns: Json
      }
      approve_payment_request: { Args: { p_request_id: string }; Returns: Json }
      approve_vehicle_change: {
        Args: {
          p_application_id: string
          p_approved: boolean
          p_review_comment?: string
        }
        Returns: Json
      }
      assign_project_to_fleet_manager: {
        Args: { p_fleet_manager_id?: string; p_project_id: string }
        Returns: Json
      }
      assign_route_to_drivers: {
        Args: { p_driver_ids: string[]; p_route_id: string }
        Returns: Json
      }
      auto_reconcile_by_waybill_1116: {
        Args: { p_partner_id?: string }
        Returns: Json
      }
      auto_reconcile_smart_1116: {
        Args: { p_auto_confirm_confidence?: number; p_partner_id?: string }
        Returns: Json
      }
      auto_sync_admin_menu_permissions: { Args: never; Returns: undefined }
      batch_approve_invoice_requests: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_approve_invoice_requests_1126: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_approve_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_approve_payment_requests_1126: {
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
      batch_cancel_invoice_requests: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_cancel_invoice_requests_1126: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_cancel_payment_application: {
        Args: { p_record_ids: string[] }
        Returns: number
      }
      batch_cancel_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_complete_invoice_requests: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_complete_invoice_requests_1126: {
        Args: { p_request_numbers: string[] }
        Returns: Json
      }
      batch_debug_duplicate_check: { Args: { p_records: Json }; Returns: Json }
      batch_import_logistics_records: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_1112: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_1112_2: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_backup_base: {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_import_logistics_records_with_update: {
        Args: { p_records: Json; p_update_mode?: boolean }
        Returns: Json
      }
      batch_import_logistics_records_with_update_1123: {
        Args: { p_records: Json; p_update_mode?: boolean }
        Returns: Json
      }
      "batch_import_logistics_records—buneng": {
        Args: { p_records: Json }
        Returns: Json
      }
      batch_modify_chain: {
        Args: { p_chain_name: string; p_record_ids: string[] }
        Returns: Json
      }
      batch_modify_chain_1126: {
        Args: { p_chain_name: string; p_record_ids: string[] }
        Returns: Json
      }
      batch_modify_partner_cost: {
        Args: { p_new_amount: number; p_record_ids: string[] }
        Returns: Json
      }
      batch_modify_partner_cost_1126: {
        Args: { p_new_amount: number; p_record_ids: string[] }
        Returns: Json
      }
      batch_pay_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_pay_payment_requests_1126: {
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
      batch_recalculate_by_filter_1116: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      batch_recalculate_by_filter_1120: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      batch_recalculate_partner_costs: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      batch_recalculate_partner_costs_1120: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      batch_rollback_invoice_approval: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_rollback_invoice_approval_1126: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_rollback_payment_approval: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_rollback_payment_approval_1126: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      batch_update_location_geocoding: {
        Args: { p_locations: Json }
        Returns: Json
      }
      batch_update_logistics_records: {
        Args: { p_updates: Json }
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
      cancel_invoice_request: {
        Args: { p_request_number: string }
        Returns: Json
      }
      cancel_invoice_request_1126: {
        Args: { p_request_number: string }
        Returns: Json
      }
      cancel_payment_request: { Args: { p_request_id: string }; Returns: Json }
      cancel_payment_request_1126: {
        Args: { p_request_id: string }
        Returns: Json
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
      check_partner_name_consistency: {
        Args: never
        Returns: {
          bank_details_full_name: string
          is_consistent: boolean
          issue_description: string
          partner_id: string
          partner_name: string
          partners_full_name: string
        }[]
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
      complete_dispatch_order: {
        Args: {
          p_completion_remarks?: string
          p_loading_weight: number
          p_order_id: string
          p_scale_photos?: string[]
          p_unloading_weight?: number
        }
        Returns: Json
      }
      complete_invoice_request: {
        Args: {
          p_invoice_date?: string
          p_invoice_number?: string
          p_request_id: string
        }
        Returns: Json
      }
      complete_invoice_request_v2: {
        Args: {
          p_invoice_date?: string
          p_invoice_number?: string
          p_request_number: string
        }
        Returns: Json
      }
      complete_invoice_request_v2_1126: {
        Args: {
          p_invoice_date?: string
          p_invoice_number?: string
          p_request_number: string
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
      create_dispatch_order: {
        Args: {
          p_current_cost?: number
          p_driver_id: string
          p_expected_loading_date?: string
          p_expected_weight?: number
          p_loading_location_id: string
          p_project_id: string
          p_remarks?: string
          p_unloading_location_id: string
        }
        Returns: Json
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
      debug_payment_requests_data: {
        Args: never
        Returns: {
          count: number
          data_type: string
          sample_data: string
        }[]
      }
      deduct_overdue_fee: {
        Args: { p_amount: number; p_description?: string; p_partner_id: string }
        Returns: Json
      }
      deduct_partner_fee: {
        Args: {
          p_amount: number
          p_description?: string
          p_partner_id: string
          p_transaction_category?: string
        }
        Returns: Json
      }
      deduct_service_fee: {
        Args: { p_amount: number; p_description?: string; p_partner_id: string }
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
      delete_single_logistics_record: {
        Args: { p_record_id: string }
        Returns: Json
      }
      delete_waybills_by_project: {
        Args: { p_project_name: string }
        Returns: Json
      }
      delete_waybills_by_project_and_date: {
        Args: {
          p_end_date?: string
          p_project_name: string
          p_start_date?: string
        }
        Returns: Json
      }
      driver_add_location: {
        Args: {
          p_location_name: string
          p_location_type?: string
          p_project_id: string
        }
        Returns: Json
      }
      driver_add_route: {
        Args: {
          p_loading_location_name: string
          p_project_id: string
          p_unloading_location_name: string
        }
        Returns: Json
      }
      driver_manual_create_waybill: {
        Args: {
          p_chain_id?: string
          p_current_cost?: number
          p_extra_cost?: number
          p_loading_date?: string
          p_loading_location_id: string
          p_loading_weight: number
          p_project_id: string
          p_remarks?: string
          p_unloading_date?: string
          p_unloading_location_id: string
          p_unloading_weight?: number
        }
        Returns: Json
      }
      driver_quick_create_waybill: {
        Args: {
          p_chain_id?: string
          p_loading_date?: string
          p_loading_location_id: string
          p_loading_weight: number
          p_project_id: string
          p_remarks?: string
          p_unloading_date?: string
          p_unloading_location_id: string
          p_unloading_weight?: number
        }
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
      fix_inconsistent_location_names: { Args: never; Returns: Json }
      fix_inconsistent_project_names: { Args: never; Returns: Json }
      fix_partner_name_consistency_simple: { Args: never; Returns: string }
      fleet_manager_add_route: {
        Args: {
          p_loading_location_name: string
          p_project_id: string
          p_unloading_location_name: string
        }
        Returns: Json
      }
      generate_auto_number: {
        Args: { loading_date_input: string }
        Returns: string
      }
      generate_invoice_request_number: { Args: never; Returns: string }
      generate_merged_invoice_request_number: { Args: never; Returns: string }
      generate_merged_payment_request_number: { Args: never; Returns: string }
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
      get_all_filtered_record_ids_1113: {
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
      get_all_filtered_record_ids_1115: {
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
      get_all_filtered_record_ids_1116: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_all_filtered_record_ids_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_all_filtered_record_ids_1201: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
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
      get_batch_user_effective_permissions_1121: {
        Args: { p_user_ids: string[] }
        Returns: Json
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
      get_current_driver_id: { Args: never; Returns: string }
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
      get_dashboard_stats_with_billing_types_1113: {
        Args: {
          p_end_date?: string
          p_project_id?: string
          p_start_date?: string
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
          driver_type: string | null
          driving_license_photos: Json | null
          id: string
          id_card_photos: Json | null
          license_plate: string | null
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
      get_driver_balances_by_fleet_manager: {
        Args: never
        Returns: {
          balance: number
          driver_id: string
          driver_name: string
          fleet_manager_id: string
          fleet_manager_name: string
        }[]
      }
      get_driver_expense_balance: { Args: never; Returns: Json }
      get_driver_vehicles: {
        Args: { p_driver_id: string }
        Returns: {
          is_primary: boolean
          license_plate: string
          relation_type: string
          vehicle_id: string
          vehicle_type: string
        }[]
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
      get_drivers_paginated_1122: {
        Args: {
          p_driver_names?: string
          p_license_plates?: string
          p_page_number?: number
          p_page_size?: number
          p_phone_numbers?: string
          p_photo_status?: string
          p_project_id?: string
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
          photo_status: string
          project_ids: string[]
          qualification_certificate_photos: Json
          total_records: number
          transport_license_photos: Json
        }[]
      }
      get_effective_quantity_for_record_1120: {
        Args: {
          p_chain_id?: string
          p_loading_weight: number
          p_project_id: string
          p_unloading_weight: number
        }
        Returns: number
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
          is_merged_request: boolean | null
          logistics_record_ids: string[] | null
          merged_count: number | null
          merged_from_requests: string[] | null
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
          is_merged_request: boolean | null
          logistics_record_ids: string[] | null
          merged_count: number | null
          merged_from_requests: string[] | null
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
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: string[]
      }
      get_filtered_unpaid_ids_1116: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: string[]
      }
      get_filtered_unpaid_ids_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: string[]
      }
      get_filtered_unpaid_ids_1122: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
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
      get_finance_reconciliation_by_partner_1115: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_by_partner_1116:
        | {
            Args: {
              p_driver_name?: string
              p_driver_phone?: string
              p_end_date?: string
              p_license_plate?: string
              p_other_platform_name?: string
              p_page_number?: number
              p_page_size?: number
              p_partner_id?: string
              p_project_id?: string
              p_start_date?: string
              p_waybill_numbers?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_driver_name?: string
              p_driver_phone?: string
              p_end_date?: string
              p_license_plate?: string
              p_other_platform_name?: string
              p_page_number?: number
              p_page_size?: number
              p_partner_id?: string
              p_project_id?: string
              p_reconciliation_status?: string
              p_start_date?: string
              p_waybill_numbers?: string
            }
            Returns: Json
          }
      get_finance_reconciliation_by_partner_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_reconciliation_status?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_finance_reconciliation_by_partner_1122: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_reconciliation_status?: string
          p_start_date?: string
          p_waybill_numbers?: string
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
      get_financial_overview_data: { Args: never; Returns: Json }
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
      get_internal_drivers: {
        Args: { p_page?: number; p_page_size?: number; p_search?: string }
        Returns: {
          base_salary: number
          created_at: string
          driver_license_expire_date: string
          employment_status: string
          hire_date: string
          id: string
          id_card_expire_date: string
          id_card_number: string
          is_active: boolean
          name: string
          phone: string
          qualification_certificate_expire_date: string
          salary_calculation_type: string
          total_count: number
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
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_invoice_request_data_1113: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_driver_receivable?: string
          p_end_date?: string
          p_invoice_status_array?: string[]
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_invoice_request_data_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_driver_receivable?: string
          p_end_date?: string
          p_invoice_status_array?: string[]
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_invoice_requests_filtered: {
        Args: {
          p_driver_name?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
          p_request_number?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invoice_number: string
          invoicing_partner_full_name: string
          invoicing_partner_id: string
          invoicing_partner_tax_number: string
          loading_date_range: string
          partner_full_name: string
          partner_id: string
          partner_name: string
          record_count: number
          remarks: string
          request_number: string
          status: string
          tax_number: string
          total_amount: number
          total_count: number
          total_payable_cost: number
        }[]
      }
      get_invoice_requests_filtered_1113: {
        Args: {
          p_driver_name?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
          p_request_number?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          invoice_number: string
          invoicing_partner_full_name: string
          invoicing_partner_id: string
          invoicing_partner_tax_number: string
          loading_date_range: string
          partner_full_name: string
          partner_id: string
          partner_name: string
          record_count: number
          remarks: string
          request_number: string
          status: string
          tax_number: string
          total_amount: number
          total_count: number
          total_payable_cost: number
        }[]
      }
      get_invoice_requests_filtered_1114: {
        Args: {
          p_driver_name: string
          p_invoicing_partner_id: string
          p_license_plate: string
          p_limit: number
          p_loading_date: string
          p_offset: number
          p_page_number: number
          p_page_size: number
          p_phone_number: string
          p_platform_name: string
          p_project_id: string
          p_request_number: string
          p_status: string
          p_waybill_number: string
        }
        Returns: Json
      }
      get_invoice_requests_filtered_1115: {
        Args: {
          p_driver_name?: string
          p_invoicing_partner_id?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_page_number?: number
          p_page_size?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
          p_request_number?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: Json
      }
      get_invoice_requests_filtered_1116: {
        Args: {
          p_driver_name?: string
          p_invoicing_partner_id?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_page_number?: number
          p_page_size?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
          p_request_number?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: Json
      }
      get_invoice_requests_filtered_1120: {
        Args: {
          p_driver_name?: string
          p_invoicing_partner_id?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_page_number?: number
          p_page_size?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
          p_request_number?: string
          p_status?: string
          p_waybill_number?: string
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
      get_logistics_records_columns: {
        Args: never
        Returns: {
          column_name: string
          data_type: string
          is_nullable: string
          table_name: string
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
      get_logistics_summary_and_records_enhanced_1113: {
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
      get_logistics_summary_and_records_enhanced_1115: {
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
      get_logistics_summary_and_records_enhanced_1116: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_logistics_summary_and_records_enhanced_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_logistics_summary_and_records_enhanced_1201: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_has_scale_record?: string
          p_invoice_status?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_payment_status?: string
          p_project_name?: string
          p_receipt_status?: string
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
      get_my_dispatch_orders: {
        Args: { p_status?: string }
        Returns: {
          created_at: string
          expected_loading_date: string
          expected_weight: number
          id: string
          loading_location: string
          order_number: string
          project_name: string
          remarks: string
          status: string
          unloading_location: string
        }[]
      }
      get_my_driver_info: {
        Args: never
        Returns: {
          bank_account: string
          bank_name: string
          base_salary: number
          commission_rate: number
          driver_id: string
          employment_status: string
          fleet_manager_id: string
          hire_date: string
          id: string
          name: string
          phone: string
          salary_calculation_type: string
        }[]
      }
      get_my_drivers: {
        Args: never
        Returns: {
          base_salary: number
          driver_id: string
          driver_name: string
          employment_status: string
          hire_date: string
          phone: string
          primary_vehicle: string
        }[]
      }
      get_my_expense_applications: {
        Args: { p_limit?: number; p_status?: string }
        Returns: {
          amount: number
          application_number: string
          created_at: string
          description: string
          expense_date: string
          expense_type: string
          id: string
          receipt_photos: Json
          review_comment: string
          status: string
        }[]
      }
      get_my_managed_projects: {
        Args: never
        Returns: {
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
        }[]
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_my_project_routes: {
        Args: never
        Returns: {
          common_loading_locations: Json
          common_unloading_locations: Json
          is_primary_route: boolean
          project_id: string
          project_name: string
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_my_salary: {
        Args: { p_year_month?: string }
        Returns: {
          base_salary: number
          deductions: number
          net_salary: number
          payment_date: string
          status: string
          total_income: number
          trip_commission: number
          trip_count: number
          year_month: string
        }[]
      }
      get_my_vehicle_change_applications: {
        Args: never
        Returns: {
          application_number: string
          created_at: string
          current_vehicle: string
          id: string
          reason: string
          requested_vehicle: string
          review_comment: string
          status: string
        }[]
      }
      get_my_vehicles: {
        Args: never
        Returns: {
          assigned_at: string
          is_primary: boolean
          license_plate: string
          relation_type: string
          vehicle_brand: string
          vehicle_id: string
          vehicle_model: string
          vehicle_type: string
        }[]
      }
      get_my_waybills: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          auto_number: string
          created_at: string
          id: string
          loading_date: string
          loading_location: string
          loading_weight: number
          payment_status: string
          project_name: string
          unloading_location: string
          unloading_weight: number
        }[]
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
      get_partner_balance: { Args: { p_partner_id: string }; Returns: Json }
      get_partner_balance_transactions: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_partner_id: string
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
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
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
      get_payment_request_data_1113: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_payment_request_data_1116: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_payment_request_data_1120: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
        }
        Returns: Json
      }
      get_payment_request_data_1122: {
        Args: {
          p_driver_name?: string
          p_driver_phone?: string
          p_end_date?: string
          p_license_plate?: string
          p_other_platform_name?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_payment_status_array?: string[]
          p_project_id?: string
          p_start_date?: string
          p_waybill_numbers?: string
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
      get_payment_request_data_v2_1122: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      get_payment_request_data_v2_1124: {
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
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
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
      get_payment_requests_filtered_1113: {
        Args: {
          p_driver_name?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
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
      get_payment_requests_filtered_1116: {
        Args: {
          p_driver_name?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
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
      get_payment_requests_filtered_1120: {
        Args: {
          p_driver_name?: string
          p_license_plate?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_phone_number?: string
          p_platform_name?: string
          p_project_id?: string
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
      get_payment_requests_filtered_backup_20251026: {
        Args: {
          p_driver_name?: string
          p_limit?: number
          p_loading_date?: string
          p_offset?: number
          p_project_id?: string
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
          p_project_id?: string
          p_request_id?: string
          p_status?: string
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
      get_pending_vehicle_change_applications: {
        Args: never
        Returns: {
          application_number: string
          created_at: string
          current_vehicle: string
          driver_name: string
          id: string
          reason: string
          requested_vehicle: string
        }[]
      }
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
      get_projects_with_details_fixed_1120: { Args: never; Returns: Json }
      get_projects_with_details_optimized: { Args: never; Returns: Json }
      get_receipt_details_report_1114: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_start_date?: string
          p_status?: string
        }
        Returns: Json
      }
      get_receipt_details_report_1120: {
        Args: {
          p_end_date?: string
          p_page_number?: number
          p_page_size?: number
          p_partner_id?: string
          p_start_date?: string
          p_status?: string
        }
        Returns: Json
      }
      get_receipt_records_1114: {
        Args: {
          p_invoice_request_id?: string
          p_page_number?: number
          p_page_size?: number
          p_request_number?: string
        }
        Returns: Json
      }
      get_receipt_statistics_1114: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_receipt_statistics_1120: {
        Args: {
          p_end_date?: string
          p_partner_id?: string
          p_start_date?: string
        }
        Returns: Json
      }
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
      get_shipper_dashboard_stats_1115: {
        Args: {
          p_end_date?: string
          p_include_self?: boolean
          p_include_subordinates?: boolean
          p_shipper_id: string
          p_start_date?: string
        }
        Returns: Json
      }
      get_shipper_dashboard_stats_1120: {
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
      get_subordinate_shippers_stats_1115: {
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
      get_subordinate_shippers_stats_1120: {
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
      get_unlinked_drivers_and_users: { Args: never; Returns: Json }
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
      get_vehicle_drivers: {
        Args: { p_vehicle_id: string }
        Returns: {
          driver_id: string
          driver_name: string
          is_primary: boolean
          phone: string
          relation_type: string
        }[]
      }
      has_data_permission: { Args: { p_data_scope: string }; Returns: boolean }
      has_function_permission: {
        Args: { p_function_key: string }
        Returns: boolean
      }
      has_menu_permission: { Args: { p_menu_key: string }; Returns: boolean }
      has_project_permission: {
        Args: { p_project_scope: string }
        Returns: boolean
      }
      has_role:
        | { Args: { p_role: string }; Returns: boolean }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      import_logistics_data: { Args: { p_records: Json }; Returns: Json }
      import_logistics_data_v2: { Args: { p_records: Json }; Returns: Json }
      internal_approve_expense_application: {
        Args: { p_action: string; p_application_id: string; p_remarks?: string }
        Returns: Json
      }
      internal_confirm_expense_payment: {
        Args: { p_application_id: string; p_payment_method?: string }
        Returns: Json
      }
      internal_generate_expense_application_number: {
        Args: never
        Returns: string
      }
      internal_get_maintenance_alerts: {
        Args: { p_days_before?: number }
        Returns: {
          alert_level: string
          cert_type: string
          days_remaining: number
          expire_date: string
          license_plate: string
          vehicle_code: string
        }[]
      }
      internal_get_pending_expense_count: { Args: never; Returns: number }
      is_admin: { Args: never; Returns: boolean }
      is_admin_for_invoice: { Args: { _user_id?: string }; Returns: boolean }
      is_authenticated_user: { Args: never; Returns: boolean }
      is_finance_operator_or_admin: { Args: never; Returns: boolean }
      is_finance_or_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_finance_or_admin_for_invoice: { Args: never; Returns: boolean }
      is_finance_or_admin_old: { Args: never; Returns: boolean }
      link_driver_to_user: {
        Args: { p_driver_id: string; p_user_id: string }
        Returns: Json
      }
      link_user_to_driver: { Args: never; Returns: Json }
      log_frontend_error: {
        Args: {
          p_error_info?: Json
          p_error_message: string
          p_error_name: string
          p_error_stack?: string
          p_error_type: string
          p_metadata?: Json
          p_retry_count?: number
          p_url?: string
          p_user_agent?: string
          p_viewport_height?: number
          p_viewport_width?: number
        }
        Returns: Json
      }
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
      manual_recharge_partner_balance: {
        Args: { p_amount: number; p_description?: string; p_partner_id: string }
        Returns: Json
      }
      mark_all_notifications_as_read: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      mark_notification_as_read: {
        Args: { p_notification_id: string; p_user_id: string }
        Returns: undefined
      }
      merge_invoice_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      merge_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      modify_logistics_record_chain_with_recalc: {
        Args: { p_chain_name: string; p_record_id: string }
        Returns: Json
      }
      modify_logistics_record_chain_with_recalc_1120: {
        Args: { p_chain_name: string; p_record_id: string }
        Returns: Json
      }
      modify_logistics_record_chain_with_recalc_1126: {
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
      notify_driver_on_dispatch: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      notify_driver_on_expense_review: {
        Args: { p_application_id: string; p_approved: boolean }
        Returns: boolean
      }
      notify_drivers_on_payment_approval: {
        Args: { p_record_ids: string[]; p_request_id: string }
        Returns: number
      }
      parse_location_string: {
        Args: { location_string: string }
        Returns: string[]
      }
      parse_location_string_v2: {
        Args: { location_string: string }
        Returns: string[]
      }
      pay_payment_request: { Args: { p_request_id: string }; Returns: Json }
      pay_payment_request_1126: {
        Args: { p_request_id: string }
        Returns: Json
      }
      preview_delete_waybills: {
        Args: {
          p_end_date?: string
          p_page?: number
          p_page_size?: number
          p_project_name: string
          p_start_date?: string
        }
        Returns: Json
      }
      preview_driver_project_association: {
        Args: { p_driver_ids: string[] }
        Returns: Json
      }
      preview_import_v2: { Args: { p_records: Json }; Returns: Json }
      preview_import_with_custom_duplicate_check: {
        Args: { p_check_fields?: string[]; p_records: Json }
        Returns: Json
      }
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
        Returns: Json
      }
      process_payment_application_1126: {
        Args: { p_record_ids: string[] }
        Returns: Json
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
      recalculate_costs_for_chain_1120: {
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
      recalculate_costs_for_chain_safe_1120: {
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
      recalculate_costs_for_project_1120: {
        Args: { p_project_id: string }
        Returns: Json
      }
      recalculate_costs_for_records_safe: {
        Args: { p_record_ids: string[] }
        Returns: Json
      }
      receive_invoice_payment_1114: {
        Args: {
          p_notes?: string
          p_receipt_bank?: string
          p_receipt_images?: string[]
          p_receipt_number?: string
          p_received_amount: number
          p_request_number: string
        }
        Returns: Json
      }
      reconcile_invoice_receipt_1114: {
        Args: {
          p_reconciliation_notes?: string
          p_reconciliation_status?: string
          p_request_number: string
        }
        Returns: Json
      }
      reconcile_partner_cost: {
        Args: {
          p_logistics_record_id: string
          p_partner_id: string
          p_reconciliation_notes?: string
          p_reconciliation_status?: string
        }
        Returns: Json
      }
      reconcile_partner_costs_batch: {
        Args: {
          p_cost_ids: string[]
          p_reconciliation_notes?: string
          p_reconciliation_status?: string
        }
        Returns: Json
      }
      reconcile_partner_costs_batch_1126: {
        Args: {
          p_cost_ids: string[]
          p_reconciliation_notes?: string
          p_reconciliation_status?: string
        }
        Returns: Json
      }
      refund_invoice_receipt_1114: {
        Args: {
          p_receipt_record_id?: string
          p_refund_amount: number
          p_refund_reason?: string
          p_request_number: string
        }
        Returns: Json
      }
      reject_dispatch_order: {
        Args: { p_order_id: string; p_reason?: string }
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
      review_expense_application: {
        Args: {
          p_application_id: string
          p_approved: boolean
          p_notes?: string
        }
        Returns: Json
      }
      review_expense_application_with_vouchers: {
        Args: {
          p_application_id: string
          p_approved: boolean
          p_notes?: string
          p_payment_vouchers?: string[]
        }
        Returns: Json
      }
      rollback_payment_request_approval: {
        Args: { p_request_id: string }
        Returns: Json
      }
      rollback_payment_request_approval_1126: {
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
      save_favorite_route: {
        Args: {
          p_fleet_manager_id?: string
          p_loading_location_id: string
          p_notes?: string
          p_project_id: string
          p_route_name: string
          p_unloading_location_id: string
        }
        Returns: Json
      }
      save_invoice_request: { Args: { p_invoice_data: Json }; Returns: Json }
      save_invoice_request_1014: {
        Args: { p_invoice_data: Json }
        Returns: Json
      }
      save_invoice_request_1126: {
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
        Args: { chains_data: Json[]; project_data: Json; project_id_in: string }
        Returns: Json
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
      send_receipt_reminders_1114: {
        Args: {
          p_days_before_due?: number
          p_overdue_reminder_interval?: number
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
      submit_expense_application: {
        Args: {
          p_amount: number
          p_description?: string
          p_expense_date: string
          p_expense_type: string
          p_receipt_photos?: string[]
        }
        Returns: Json
      }
      submit_vehicle_change_application: {
        Args: {
          p_application_type?: string
          p_current_vehicle_id: string
          p_reason: string
          p_requested_vehicle_id: string
        }
        Returns: Json
      }
      sync_admin_menu_from_frontend: { Args: never; Returns: Json }
      sync_admin_permissions_smart: { Args: never; Returns: Json }
      sync_all_partner_names: { Args: never; Returns: Json }
      sync_partner_names_manual: {
        Args: { p_partner_id: string }
        Returns: Json
      }
      sync_user_permissions_with_role:
        | { Args: never; Returns: undefined }
        | { Args: { role_name: string }; Returns: undefined }
      sync_vehicle_tracking_ids: {
        Args: { p_dept_id?: string; p_vehicle_mappings: Json }
        Returns: Json
      }
      test_payment_requests_filter: {
        Args: {
          p_driver_name?: string
          p_loading_date?: string
          p_project_id?: string
          p_request_id?: string
          p_status?: string
          p_waybill_number?: string
        }
        Returns: {
          result_count: number
          test_type: string
          test_value: string
        }[]
      }
      test_platform_fields_import: { Args: never; Returns: Json }
      test_supabase_realtime: {
        Args: never
        Returns: {
          test_name: string
          test_result: string
          test_time: string
        }[]
      }
      unassign_project_from_fleet_manager: {
        Args: { p_fleet_manager_id?: string; p_project_id: string }
        Returns: Json
      }
      unlink_driver_from_user: { Args: { p_driver_id: string }; Returns: Json }
      unmerge_invoice_request: {
        Args: { p_merged_request_number: string }
        Returns: Json
      }
      unmerge_payment_request: {
        Args: { p_merged_request_id: string }
        Returns: Json
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
      update_logistics_record_via_recalc_1128: {
        Args: {
          p_billing_type_id: number
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
          p_unit_price: number
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
      update_partner_balance: {
        Args: {
          p_amount: number
          p_description?: string
          p_partner_id: string
          p_reference_id?: string
          p_reference_number?: string
          p_reference_type?: string
          p_transaction_category?: string
          p_transaction_type: string
        }
        Returns: Json
      }
      update_permission_performance_stats: { Args: never; Returns: undefined }
      update_project_chains_incremental: {
        Args: {
          p_changed_chains: Json[]
          p_deleted_chain_ids?: string[]
          p_project_data: Json
          p_project_id: string
        }
        Returns: Json
      }
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
      void_and_delete_invoice_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      void_and_delete_invoice_requests_1126: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      void_and_delete_payment_requests: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      void_and_delete_payment_requests_1126: {
        Args: { p_request_ids: string[] }
        Returns: Json
      }
      void_invoice_request: {
        Args: { p_request_id: string; p_void_reason?: string }
        Returns: Json
      }
      void_invoice_request_1126: {
        Args: { p_request_id: string; p_void_reason?: string }
        Returns: Json
      }
      void_payment_for_request: {
        Args: { p_cancel_reason?: string; p_request_id: string }
        Returns: Json
      }
      void_payment_for_request_1126: {
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
      writeoff_expense_application: {
        Args: { p_actual_amount: number; p_application_id: string }
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
        | "fleet_manager"
        | "driver"
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
        "fleet_manager",
        "driver",
      ],
      contract_category: ["行政合同", "内部合同", "业务合同"],
      effective_quantity_type: ["min_value", "loading", "unloading"],
      geocoding_status: ["pending", "success", "failed", "retry"],
      partner_type_enum: ["货主", "合作商", "资方", "本公司"],
    },
  },
} as const
