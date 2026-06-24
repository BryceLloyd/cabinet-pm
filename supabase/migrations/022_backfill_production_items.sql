-- Migration 022: backfill production items + steps for existing cutlists.
-- Migration 020 reseeded the Cut & edge steps (cascade-deleting old step
-- instances) and 021 fixed per-cutlist uniqueness. Re-run generation for every
-- existing cutlist so older cutlists pick up their correct steps, any missing
-- installation items, and drop painting items whose material no longer has a
-- paint type. No-op on a fresh database (no cutlists yet).
do $$
declare
  c record;
begin
  for c in select id from cutlists loop
    perform public.generate_production_items(c.id);
  end loop;
end $$;
