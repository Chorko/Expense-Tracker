// Budget templates offered during onboarding

export type PresetGroup = { key: string; name: string; color_hex: string }
export type PresetCategory = { name: string; icon: string; group_key: string; amount?: number; share?: number }
export type BudgetPreset = {
  id: string
  name: string
  description: string
  groups: PresetGroup[]
  categories: PresetCategory[]
}

/** Generic plan: amounts are a share of monthly income. */
const STARTER: BudgetPreset = {
  id: 'starter',
  name: 'Starter budget',
  description: '12 everyday categories, sized from your income. A good default.',
  groups: [
    { key: 'essentials', name: 'Essentials', color_hex: '#c9a84c' },
    { key: 'lifestyle', name: 'Lifestyle', color_hex: '#a78bfa' },
    { key: 'savings', name: 'Savings & investing', color_hex: '#2dd4bf' },
  ],
  categories: [
    { name: 'Rent / housing', icon: '🏠', group_key: 'essentials', share: 0.25 },
    { name: 'Groceries', icon: '🛒', group_key: 'essentials', share: 0.08 },
    { name: 'Bills & utilities', icon: '💡', group_key: 'essentials', share: 0.05 },
    { name: 'Transport', icon: '🚌', group_key: 'essentials', share: 0.05 },
    { name: 'Health', icon: '💊', group_key: 'essentials', share: 0.03 },
    { name: 'Eating out', icon: '🍽️', group_key: 'lifestyle', share: 0.06 },
    { name: 'Entertainment', icon: '🎬', group_key: 'lifestyle', share: 0.03 },
    { name: 'Shopping', icon: '🛍️', group_key: 'lifestyle', share: 0.04 },
    { name: 'Subscriptions', icon: '📱', group_key: 'lifestyle', share: 0.02 },
    { name: 'Emergency fund', icon: '🛟', group_key: 'savings', share: 0.1 },
    { name: 'Investments (SIP)', icon: '📈', group_key: 'savings', share: 0.15 },
    { name: 'Misc', icon: '📦', group_key: 'lifestyle', share: 0.02 },
  ],
}

/** The detailed 22-category plan this app was originally built around. */
const DETAILED: BudgetPreset = {
  id: 'detailed',
  name: 'Detailed plan (22 categories)',
  description: 'Fixed amounts covering rent, family, insurance, SIPs, RDs and sinking funds.',
  groups: [
    { key: 'home', name: 'Home & bills', color_hex: '#c9a84c' },
    { key: 'food', name: 'Food', color_hex: '#e07a5f' },
    { key: 'travel', name: 'Travel', color_hex: '#6c8ebf' },
    { key: 'family', name: 'Family & giving', color_hex: '#ec4899' },
    { key: 'health', name: 'Health & insurance', color_hex: '#22c55e' },
    { key: 'invest', name: 'Investments', color_hex: '#2dd4bf' },
    { key: 'sinking', name: 'Sinking funds', color_hex: '#f59e0b' },
    { key: 'lifestyle', name: 'Lifestyle', color_hex: '#a78bfa' },
  ],
  categories: [
    { name: 'Rent', icon: '🏠', group_key: 'home', amount: 9500 },
    { name: 'Subscriptions', icon: '📱', group_key: 'home', amount: 1500 },
    { name: 'Food', icon: '🍽️', group_key: 'food', amount: 5000 },
    { name: 'Grocery', icon: '🛒', group_key: 'food', amount: 500 },
    { name: 'Chennai travel', icon: '🚌', group_key: 'travel', amount: 2000 },
    { name: 'Domestic travel', icon: '✈️', group_key: 'travel', amount: 500 },
    { name: 'Family support', icon: '👨‍👩‍👧', group_key: 'family', amount: 4000 },
    { name: 'Church', icon: '⛪', group_key: 'family', amount: 1000 },
    { name: "Parents' health insurance", icon: '🏥', group_key: 'health', amount: 3000 },
    { name: 'Term insurance (yourself)', icon: '🛡️', group_key: 'health', amount: 300 },
    { name: 'OPD / routine medical buffer', icon: '💊', group_key: 'health', amount: 350 },
    { name: 'SIP — Nifty 50 (core)', icon: '📈', group_key: 'invest', amount: 3520 },
    { name: 'SIP — Nifty Next 50', icon: '📊', group_key: 'invest', amount: 1280 },
    { name: 'SIP — Nasdaq 100 FoF', icon: '🌐', group_key: 'invest', amount: 1600 },
    { name: 'Personal RD @ 7.25%', icon: '🏦', group_key: 'invest', amount: 3450 },
    { name: 'Growth — SIP/Bond (fund TBD)', icon: '🌱', group_key: 'invest', amount: 250 },
    { name: 'EF safety top-up (→ liquid fund)', icon: '🛟', group_key: 'invest', amount: 500 },
    { name: 'Annual one-off sinking fund (→ Oct RD)', icon: '🏺', group_key: 'sinking', amount: 1250 },
    { name: 'Gifts sinking fund', icon: '🎁', group_key: 'sinking', amount: 1000 },
    { name: 'Entertainment', icon: '🎬', group_key: 'lifestyle', amount: 2000 },
    { name: 'Shopping', icon: '🛍️', group_key: 'lifestyle', amount: 1500 },
    { name: 'Misc', icon: '📦', group_key: 'lifestyle', amount: 1000 },
  ],
}

export const BUDGET_PRESETS: BudgetPreset[] = [STARTER, DETAILED]

/** Default amount for a preset category given the user's income. */
export function presetAmount(category: PresetCategory, income: number): number {
  if (typeof category.amount === 'number') return category.amount
  if (!category.share || income <= 0) return 0
  return Math.round((income * category.share) / 100) * 100
}

export const GROUP_COLORS = ['#c9a84c', '#2dd4bf', '#e07a5f', '#6c8ebf', '#a78bfa', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4', '#b8a89a']

export const CATEGORY_ICONS = [
  '💰', '🏠', '🛒', '🍽️', '☕', '🚌', '🚗', '⛽', '✈️', '💡', '📱', '🌐', '💊', '🏥', '🛡️', '🎓',
  '👨‍👩‍👧', '🎁', '⛪', '🎬', '🎮', '🛍️', '👕', '💇', '🐾', '🏋️', '📈', '📊', '🏦', '🌱', '🛟', '🏺', '📦', '🔧',
]

export const GOAL_ICONS = ['🎯', '🏖️', '🏠', '🚗', '💍', '🎓', '💻', '📱', '🛟', '✈️', '👶', '🏍️', '🎸', '🧳']
