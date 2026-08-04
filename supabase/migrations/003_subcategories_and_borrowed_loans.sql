-- ============================================================
-- Migration 003: Sub-categories & Bidirectional Loans
-- ============================================================

-- Add parent_id to categories for parent-child subcategory hierarchy
ALTER TABLE categories
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES categories(id) ON DELETE CASCADE;

-- Add direction to loans ('lent_out' = money I lent, 'borrowed_in' = money I borrowed)
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'lent_out'
CHECK (direction IN ('lent_out', 'borrowed_in'));

-- Index for parent_id lookups
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);

-- Index for loan direction filtering
CREATE INDEX IF NOT EXISTS idx_loans_direction ON loans(user_id, direction);
