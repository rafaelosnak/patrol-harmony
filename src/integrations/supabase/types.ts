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
      alerts: {
        Row: {
          alert_type: string
          client_id: string | null
          company_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          message: string | null
          resolved_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          alert_type: string
          client_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          resolved_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          alert_type?: string
          client_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          message?: string | null
          resolved_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          author_id: string
          body: string
          company_id: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          audience?: string
          author_id: string
          body: string
          company_id: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          audience?: string
          author_id?: string
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      checkpoint_locations: {
        Row: {
          active: boolean
          client_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          client_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          client_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_locations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoint_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkpoint_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_employees: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          client_id: string
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_employees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          company_id: string
          contact: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          document: string | null
          geocoded_at: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
        }
        Insert: {
          address?: string | null
          company_id: string
          contact?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string
          contact?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          geocoded_at?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          billing_day: number
          cnpj: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          due_date: string | null
          id: string
          last_payment_at: string | null
          max_users: number
          monthly_fee: number
          name: string
          notes: string | null
          plan: Database["public"]["Enums"]["company_plan"]
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_day?: number
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          last_payment_at?: string | null
          max_users?: number
          monthly_fee?: number
          name: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["company_plan"]
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_day?: number
          cnpj?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          last_payment_at?: string | null
          max_users?: number
          monthly_fee?: number
          name?: string
          notes?: string | null
          plan?: Database["public"]["Enums"]["company_plan"]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          thread_user_id: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          thread_user_id: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          thread_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      occurrences: {
        Row: {
          client_id: string | null
          closed_at: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          media_urls: string[] | null
          severity: string
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          closed_at?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[] | null
          severity?: string
          status?: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          closed_at?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          media_urls?: string[] | null
          severity?: string
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "occurrences_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "occurrences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          birth_date: string | null
          company_id: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          hired_at: string | null
          id: string
          last_lat: number | null
          last_lng: number | null
          last_location_at: string | null
          notes: string | null
          phone: string | null
          rg: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hired_at?: string | null
          id: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          notes?: string | null
          phone?: string | null
          rg?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          birth_date?: string | null
          company_id?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hired_at?: string | null
          id?: string
          last_lat?: number | null
          last_lng?: number | null
          last_location_at?: string | null
          notes?: string | null
          phone?: string | null
          rg?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      round_checkpoints: {
        Row: {
          accuracy: number | null
          checkpoint_location_id: string | null
          company_id: string
          created_at: string
          id: string
          label: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          photo_url: string | null
          round_id: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          checkpoint_location_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_url?: string | null
          round_id: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          checkpoint_location_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          label?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          photo_url?: string | null
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_checkpoints_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_checkpoints_location_fk"
            columns: ["checkpoint_location_id"]
            isOneToOne: false
            referencedRelation: "checkpoint_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_checkpoints_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          checkpoints_done: number
          checkpoints_total: number
          client_id: string | null
          company_id: string
          finished_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          checkpoints_done?: number
          checkpoints_total?: number
          client_id?: string | null
          company_id: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          checkpoints_done?: number
          checkpoints_total?: number
          client_id?: string | null
          company_id?: string
          finished_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rounds_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rounds_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          client_id: string | null
          company_id: string
          created_at: string
          end_at: string
          id: string
          shift_type: string
          start_at: string
          status: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          company_id: string
          created_at?: string
          end_at: string
          id?: string
          shift_type?: string
          start_at: string
          status?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          company_id?: string
          created_at?: string
          end_at?: string
          id?: string
          shift_type?: string
          start_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          company_id: string
          created_at: string
          from_super_admin: boolean
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          company_id: string
          created_at?: string
          from_super_admin?: boolean
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          company_id?: string
          created_at?: string
          from_super_admin?: boolean
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          company_id: string
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          note: string | null
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at: string
          selfie_url: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          punch_type: Database["public"]["Enums"]["punch_type"]
          punched_at?: string
          selfie_url?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          punch_type?: Database["public"]["Enums"]["punch_type"]
          punched_at?: string
          selfie_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          company_id: string
          created_at: string
          id: string
          mileage: number | null
          model: string | null
          plate: string
          prefix: string
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          mileage?: number | null
          model?: string | null
          plate: string
          prefix: string
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          mileage?: number | null
          model?: string | null
          plate?: string
          prefix?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      company_can_add_user: { Args: { _company_id: string }; Returns: boolean }
      company_is_active: { Args: { _company_id: string }; Returns: boolean }
      company_user_count: { Args: { _company_id: string }; Returns: number }
      get_user_company: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_supervisor_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "coordenador"
        | "supervisor"
        | "central"
        | "vigia"
        | "super_admin"
      company_plan: "starter" | "pro" | "business" | "enterprise"
      punch_type: "entrada" | "almoco_saida" | "almoco_volta" | "saida"
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
      app_role: [
        "admin",
        "coordenador",
        "supervisor",
        "central",
        "vigia",
        "super_admin",
      ],
      company_plan: ["starter", "pro", "business", "enterprise"],
      punch_type: ["entrada", "almoco_saida", "almoco_volta", "saida"],
    },
  },
} as const
