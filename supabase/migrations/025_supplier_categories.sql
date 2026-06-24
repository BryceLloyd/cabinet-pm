-- Migration 025: supplier categories + default suppliers
-- Suppliers are split into 'cut_edge' and 'hardware' lists. Materials and
-- hardware catalog items can carry a default supplier that auto-fills when
-- adding orders.

alter table public.suppliers
  add column category text not null default 'cut_edge' check (category in ('cut_edge', 'hardware'));

alter table public.materials
  add column default_supplier_id uuid references public.suppliers(id) on delete set null;

alter table public.hardware_catalog
  add column default_supplier_id uuid references public.suppliers(id) on delete set null;
