-- Credit accounting transactional functions (optimistic concurrency / atomic updates)

-- Grant credits atomically with idempotency by stripe_event_id
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT,
  p_stripe_event_id TEXT DEFAULT NULL
)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance DECIMAL(10,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'grant amount must be > 0';
  END IF;

  -- Insert ledger entry; if duplicate stripe_event_id, treat as idempotent success
  IF p_stripe_event_id IS NOT NULL THEN
    BEGIN
      INSERT INTO credits_ledger (user_id, amount, type, description, stripe_event_id)
      VALUES (p_user_id, p_amount, 'credit', p_description, p_stripe_event_id);
    EXCEPTION WHEN unique_violation THEN
      SELECT balance INTO v_balance FROM credit_balances WHERE user_id = p_user_id;
      RETURN COALESCE(v_balance, 0);
    END;
  ELSE
    INSERT INTO credits_ledger (user_id, amount, type, description)
    VALUES (p_user_id, p_amount, 'credit', p_description);
  END IF;

  -- Upsert balance atomically
  INSERT INTO credit_balances (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = credit_balances.balance + EXCLUDED.balance
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

-- Deduct credits atomically with sufficient funds check
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current DECIMAL(10,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct amount must be > 0';
  END IF;

  SELECT balance INTO v_current FROM credit_balances WHERE user_id = p_user_id FOR UPDATE;
  IF v_current IS NULL OR v_current < p_amount THEN
    RETURN FALSE;
  END IF;

  UPDATE credit_balances
  SET balance = balance - p_amount
  WHERE user_id = p_user_id;

  INSERT INTO credits_ledger (user_id, amount, type, description)
  VALUES (p_user_id, p_amount, 'debit', p_description);

  RETURN TRUE;
END;
$$;


