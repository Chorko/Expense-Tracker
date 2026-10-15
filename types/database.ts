// Generated from the database schema after migrations 001-005 (supabase/postgres-meta).
// Regenerate after schema changes:
//   npx supabase gen types typescript --project-id <project-ref> --schema public > types/database.ts
// Helper functions listed under Functions that are not granted to `authenticated`
// (e.g. sync_user_periods) fail with "permission denied" if called from the app.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          group_id: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_flexible: boolean
          monthly_budget_amount: number
          name: string
          parent_id: string | null
          sort_order: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          monthly_budget_amount?: number
          name: string
          parent_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          group_id?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_flexible?: boolean
          monthly_budget_amount?: number
          name?: string
          parent_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "category_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_groups: {
        Row: {
          color_hex: string
          created_at: string | null
          id: string
          is_sweep_eligible: boolean | null
          name: string
          sort_order: number | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          color_hex?: string
          created_at?: string | null
          id?: string
          is_sweep_eligible?: boolean | null
          name: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string | null
          id?: string
          is_sweep_eligible?: boolean | null
          name?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      category_periods: {
        Row: {
          accrued_amount: number
          budgeted_amount: number
          category_id: string
          closed: boolean
          closed_at: string | null
          created_at: string | null
          id: string
          month: number
          rollover_in: number
          spent_amount: number
          user_id: string
          year: number
        }
        ComputedFields: never
        Insert: {
          accrued_amount?: number
          budgeted_amount?: number
          category_id: string
          closed?: boolean
          closed_at?: string | null
          created_at?: string | null
          id?: string
          month: number
          rollover_in?: number
          spent_amount?: number
          user_id: string
          year: number
        }
        Update: {
          accrued_amount?: number
          budgeted_amount?: number
          category_id?: string
          closed?: boolean
          closed_at?: string | null
          created_at?: string | null
          id?: string
          month?: number
          rollover_in?: number
          spent_amount?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_periods_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_stacks: {
        Row: {
          category_id: string
          current_balance: number
          id: string
          last_updated: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          category_id: string
          current_balance?: number
          id?: string
          last_updated?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          current_balance?: number
          id?: string
          last_updated?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_stacks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      email_reports_log: {
        Row: {
          id: string
          month: number | null
          report_type: string
          sent_at: string | null
          status: string | null
          user_id: string
          year: number | null
        }
        ComputedFields: never
        Insert: {
          id?: string
          month?: number | null
          report_type?: string
          sent_at?: string | null
          status?: string | null
          user_id: string
          year?: number | null
        }
        Update: {
          id?: string
          month?: number | null
          report_type?: string
          sent_at?: string | null
          status?: string | null
          user_id?: string
          year?: number | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          color_hex: string
          created_at: string | null
          current_amount: number
          icon: string
          id: string
          name: string
          target_amount: number
          target_date: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          color_hex?: string
          created_at?: string | null
          current_amount?: number
          icon?: string
          id?: string
          name: string
          target_amount: number
          target_date?: string | null
          user_id: string
        }
        Update: {
          color_hex?: string
          created_at?: string | null
          current_amount?: number
          icon?: string
          id?: string
          name?: string
          target_amount?: number
          target_date?: string | null
          user_id?: string
        }
        Relationships: []
      }
      loan_repayments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          loan_id: string
          notes: string | null
          repaid_date: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          loan_id: string
          notes?: string | null
          repaid_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          loan_id?: string
          notes?: string | null
          repaid_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          amount: number
          borrower_name: string
          created_at: string | null
          date_lent: string
          direction: string
          expected_return_date: string | null
          id: string
          notes: string | null
          reason: string | null
          reminder_date: string | null
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          borrower_name: string
          created_at?: string | null
          date_lent?: string
          direction?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reminder_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          borrower_name?: string
          created_at?: string | null
          date_lent?: string
          direction?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          reminder_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          currency: string
          display_name: string | null
          email: string | null
          email_reports_enabled: boolean
          id: string
          monthly_income: number
          onboarded_at: string | null
          timezone: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          currency?: string
          display_name?: string | null
          email?: string | null
          email_reports_enabled?: boolean
          id: string
          monthly_income?: number
          onboarded_at?: string | null
          timezone?: string
        }
        Update: {
          created_at?: string | null
          currency?: string
          display_name?: string | null
          email?: string | null
          email_reports_enabled?: boolean
          id?: string
          monthly_income?: number
          onboarded_at?: string | null
          timezone?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          amount: number
          anchor_day: number | null
          category_id: string | null
          created_at: string | null
          description: string | null
          frequency: string
          id: string
          is_active: boolean
          last_posted_date: string | null
          next_due_date: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_posted_date?: string | null
          next_due_date: string
          user_id: string
        }
        Update: {
          amount?: number
          anchor_day?: number | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_posted_date?: string | null
          next_due_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stack_transactions: {
        Row: {
          amount: number
          category_id: string | null
          comment: string | null
          created_at: string | null
          id: string
          month: number | null
          related_category_id: string | null
          related_goal_id: string | null
          related_stock_purchase_id: string | null
          type: string
          user_id: string
          year: number | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          category_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          month?: number | null
          related_category_id?: string | null
          related_goal_id?: string | null
          related_stock_purchase_id?: string | null
          type: string
          user_id: string
          year?: number | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: string
          month?: number | null
          related_category_id?: string | null
          related_goal_id?: string | null
          related_stock_purchase_id?: string | null
          type?: string
          user_id?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_stack_txn_stock_purchase"
            columns: ["related_stock_purchase_id"]
            isOneToOne: false
            referencedRelation: "stock_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_transactions_related_category_id_fkey"
            columns: ["related_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stack_transactions_related_goal_id_fkey"
            columns: ["related_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_purchases: {
        Row: {
          amount: number
          created_at: string | null
          funded_from: Json | null
          id: string
          purchase_date: string
          ticker_or_note: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string | null
          funded_from?: Json | null
          id?: string
          purchase_date?: string
          ticker_or_note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          funded_from?: Json | null
          id?: string
          purchase_date?: string
          ticker_or_note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          recurring_id: string | null
          source: string
          txn_date: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          recurring_id?: string | null
          source?: string
          txn_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          recurring_id?: string | null
          source?: string
          txn_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_goal_amount: {
        Args: { p_delta: number; p_goal_id: string }
        Returns: number
      }
      app_timezone: { Args: { p_user_id: string }; Returns: string }
      app_today: { Args: { p_user_id: string }; Returns: string }
      apply_period_spend_delta: {
        Args: {
          p_category_id: string
          p_delta: number
          p_txn_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      close_periods_and_accrue_stacks: {
        Args: { p_month?: number; p_year?: number }
        Returns: undefined
      }
      close_user_periods: {
        Args: { p_before: string; p_user_id: string }
        Returns: number
      }
      get_due_loan_reminders: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          borrower_name: string
          date_lent: string
          days_overdue: number
          direction: string
          display_name: string
          loan_id: string
          outstanding: number
          reason: string
          reminder_date: string
          user_email: string
          user_id: string
        }[]
      }
      get_report_recipients: {
        Args: Record<PropertyKey, never>
        Returns: {
          display_name: string
          email: string
          monthly_income: number
          timezone: string
          user_id: string
        }[]
      }
      monthly_trend: {
        Args: { p_from: string; p_to: string }
        Returns: {
          budgeted: number
          month_start: string
          spent: number
        }[]
      }
      move_stack_money: {
        Args: {
          p_comment?: string
          p_dest_category_id?: string
          p_dest_goal_id?: string
          p_dest_type: string
          p_sources: Json
          p_ticker_or_note?: string
        }
        Returns: Json
      }
      next_recurring_date: {
        Args: { p_anchor_day: number; p_frequency: string; p_from: string }
        Returns: string
      }
      open_new_periods: {
        Args: { p_month?: number; p_year?: number }
        Returns: undefined
      }
      open_user_periods: {
        Args: {
          p_month: number
          p_only_existing?: boolean
          p_user_id: string
          p_year: number
        }
        Returns: number
      }
      post_due_recurring: {
        Args: { p_today: string; p_user_id: string }
        Returns: number
      }
      rebalance_closed_period: {
        Args: { p_comment: string; p_period_id: string }
        Returns: number
      }
      recompute_loan_status: { Args: { p_loan_id: string }; Returns: undefined }
      sync_all_periods: { Args: Record<PropertyKey, never>; Returns: number }
      sync_my_periods: { Args: Record<PropertyKey, never>; Returns: undefined }
      sync_user_periods: { Args: { p_user_id: string }; Returns: undefined }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
