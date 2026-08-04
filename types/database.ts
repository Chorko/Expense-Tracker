// Auto-generated TypeScript types for Supabase schema
// Regenerate with: npx supabase gen types typescript --local > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          email: string | null
          monthly_income: number
          currency: string
          timezone: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          email?: string | null
          monthly_income?: number
          currency?: string
          timezone?: string
          created_at?: string
        }
        Update: {
          display_name?: string | null
          email?: string | null
          monthly_income?: number
          currency?: string
          timezone?: string
        }
      }
      category_groups: {
        Row: {
          id: string
          user_id: string
          name: string
          color_hex: string
          sort_order: number
          is_sweep_eligible: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color_hex?: string
          sort_order?: number
          is_sweep_eligible?: boolean
        }
        Update: {
          name?: string
          color_hex?: string
          sort_order?: number
          is_sweep_eligible?: boolean
        }
      }
      categories: {
        Row: {
          id: string
          user_id: string
          group_id: string | null
          name: string
          monthly_budget_amount: number
          is_flexible: boolean
          is_active: boolean
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          group_id?: string | null
          name: string
          monthly_budget_amount?: number
          is_flexible?: boolean
          is_active?: boolean
          icon?: string | null
        }
        Update: {
          group_id?: string | null
          name?: string
          monthly_budget_amount?: number
          is_flexible?: boolean
          is_active?: boolean
          icon?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          amount: number
          description: string | null
          txn_date: string
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          amount: number
          description?: string | null
          txn_date?: string
          source?: string
        }
        Update: {
          category_id?: string | null
          amount?: number
          description?: string | null
          txn_date?: string
        }
      }
      category_periods: {
        Row: {
          id: string
          user_id: string
          category_id: string
          month: number
          year: number
          budgeted_amount: number
          rollover_in: number
          spent_amount: number
          closed: boolean
          closed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          month: number
          year: number
          budgeted_amount?: number
          rollover_in?: number
          spent_amount?: number
          closed?: boolean
        }
        Update: {
          budgeted_amount?: number
          rollover_in?: number
          spent_amount?: number
          closed?: boolean
          closed_at?: string | null
        }
      }
      category_stacks: {
        Row: {
          id: string
          user_id: string
          category_id: string
          current_balance: number
          last_updated: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id: string
          current_balance?: number
        }
        Update: {
          current_balance?: number
          last_updated?: string
        }
      }
      stack_transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          type: 'accrual' | 'reallocation_out' | 'reallocation_in' | 'pulled_to_period'
          amount: number
          related_category_id: string | null
          related_stock_purchase_id: string | null
          comment: string | null
          month: number | null
          year: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          category_id?: string | null
          type: 'accrual' | 'reallocation_out' | 'reallocation_in' | 'pulled_to_period'
          amount: number
          related_category_id?: string | null
          related_stock_purchase_id?: string | null
          comment?: string | null
          month?: number | null
          year?: number | null
        }
        Update: {
          comment?: string | null
        }
      }
      stock_purchases: {
        Row: {
          id: string
          user_id: string
          amount: number
          purchase_date: string
          ticker_or_note: string | null
          funded_from: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          purchase_date?: string
          ticker_or_note?: string | null
          funded_from?: Json
        }
        Update: {
          ticker_or_note?: string | null
        }
      }
      loans: {
        Row: {
          id: string
          user_id: string
          borrower_name: string
          amount: number
          date_lent: string
          reason: string | null
          expected_return_date: string | null
          reminder_date: string | null
          status: 'outstanding' | 'partially_repaid' | 'repaid'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          borrower_name: string
          amount: number
          date_lent?: string
          reason?: string | null
          expected_return_date?: string | null
          reminder_date?: string | null
          status?: 'outstanding' | 'partially_repaid' | 'repaid'
          notes?: string | null
        }
        Update: {
          borrower_name?: string
          amount?: number
          date_lent?: string
          reason?: string | null
          expected_return_date?: string | null
          reminder_date?: string | null
          status?: 'outstanding' | 'partially_repaid' | 'repaid'
          notes?: string | null
        }
      }
      loan_repayments: {
        Row: {
          id: string
          loan_id: string
          user_id: string
          amount: number
          repaid_date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          loan_id: string
          user_id: string
          amount: number
          repaid_date?: string
          notes?: string | null
        }
        Update: {
          notes?: string | null
        }
      }
      goals: {
        Row: {
          id: string
          user_id: string
          name: string
          target_amount: number
          current_amount: number
          target_date: string | null
          color_hex: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          target_amount: number
          current_amount?: number
          target_date?: string | null
          color_hex?: string
        }
        Update: {
          name?: string
          target_amount?: number
          current_amount?: number
          target_date?: string | null
          color_hex?: string
        }
      }
    }
    Functions: {
      open_new_periods: {
        Args: { p_month?: number; p_year?: number }
        Returns: void
      }
      close_periods_and_accrue_stacks: {
        Args: { p_month?: number; p_year?: number }
        Returns: void
      }
      reallocate_stack: {
        Args: {
          p_user_id: string
          p_sources: Json
          p_dest_type: string
          p_dest_category_id?: string
          p_dest_period_month?: number
          p_dest_period_year?: number
          p_stock_purchase_id?: string
          p_comment?: string
        }
        Returns: void
      }
    }
  }
}
