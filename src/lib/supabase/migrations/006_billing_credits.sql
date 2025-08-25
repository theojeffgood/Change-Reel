-- Change Reel Database Schema
-- Migration: 006_billing_credits
-- Description: Create billing and credit system tables for prepaid top-up model

-- NOTE: Reuses existing update_updated_at_column() trigger function from 001 migration

-- Billing customers mapping (user <-> Stripe customer)
CREATE TABLE IF NOT EXISTS billing_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE billing_customers IS 'Maps application users to Stripe customers (one-to-one)';

-- Current credit balance per user
CREATE TABLE IF NOT EXISTS credit_balances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT credit_balances_non_negative CHECK (balance >= 0)
);

COMMENT ON TABLE credit_balances IS 'Current credit balance per user (prepaid credits remaining)';

-- Automatically maintain updated_at on balance updates
CREATE TRIGGER update_credit_balances_updated_at
    BEFORE UPDATE ON credit_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Ledger of all credit transactions (credits granted, usage debits, refunds, disputes)
CREATE TABLE IF NOT EXISTS credits_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    stripe_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT credits_ledger_amount_positive CHECK (amount > 0),
    CONSTRAINT credits_ledger_type_check CHECK (type IN ('credit', 'debit'))
);

COMMENT ON TABLE credits_ledger IS 'Immutable ledger of credit transactions with optional Stripe event linkage for idempotency';

-- Indexes for ledger lookups and idempotency
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_id ON credits_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credits_ledger_created_at ON credits_ledger(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credits_ledger_stripe_event_id
    ON credits_ledger(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

-- Optional pricing configuration for per-model costs and markup
CREATE TABLE IF NOT EXISTS pricing_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model TEXT NOT NULL,
    input_cost_per_1k DECIMAL(10,6),
    output_cost_per_1k DECIMAL(10,6),
    markup_percentage DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE pricing_config IS 'Per-model pricing configuration for OpenAI token costs and markup percentage';

-- Enforce unique model entries and maintain updated_at
CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_config_model ON pricing_config(model);

CREATE TRIGGER update_pricing_config_updated_at
    BEFORE UPDATE ON pricing_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (service role bypasses RLS; user policies can be added later)
ALTER TABLE billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_config ENABLE ROW LEVEL SECURITY;

-- Future policies (placeholder comments):
-- Example (when auth is enabled):
-- CREATE POLICY select_own_balance ON credit_balances FOR SELECT USING (user_id = auth.uid());
-- CREATE POLICY select_own_ledger ON credits_ledger FOR SELECT USING (user_id = auth.uid());


