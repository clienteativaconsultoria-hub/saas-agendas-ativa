-- Patch: allow NULL allocation_id in change_requests to support "Nova Agenda" requests
-- These requests don't have an existing allocation yet.

-- 1. Drop NOT NULL constraint on allocation_id
ALTER TABLE public.change_requests
  ALTER COLUMN allocation_id DROP NOT NULL;

-- 2. (Optional) Drop the FK constraint temporarily if needed and re-add as optional
-- If the FK already allows NULL after the above, no further action needed.

-- 3. Verify
-- SELECT column_name, is_nullable FROM information_schema.columns
-- WHERE table_name = 'change_requests' AND column_name = 'allocation_id';
