-- Migration 024: per-item hardware supplier + status
-- Hardware items each carry a supplier and their own To order → Ordered →
-- Received status (a single order can span multiple suppliers). The order-level
-- status is removed; status now lives on the item.

alter table public.hardware_order_items
  add column supplier_id  uuid references public.suppliers(id) on delete set null,
  add column status       text not null default 'to_order' check (status in ('to_order', 'ordered', 'received')),
  add column ordered_at   timestamptz,
  add column received_at  timestamptz,
  add column completed_by uuid references public.profiles(id) on delete set null;

alter table public.hardware_orders
  drop column status,
  drop column ordered_at,
  drop column completed_at,
  drop column completed_by;
