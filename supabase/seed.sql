-- Seed: run AFTER you've signed up at least once via the app.
-- Edit the email below to match your account, then run in SQL Editor.

-- 1. Default phases (edit names/colors/order to taste).
insert into public.phases (name, sort_order, color, is_default) values
  ('Quote',        1, '#94a3b8', true),    -- slate-400 (default starting phase)
  ('Design',       2, '#60a5fa', false),   -- blue-400
  ('Production',   3, '#f59e0b', false),   -- amber-500
  ('Installation', 4, '#a855f7', false),   -- purple-500
  ('Sign-off',     5, '#22c55e', false)    -- green-500
on conflict do nothing;

-- 2. Make yourself an admin. Replace with your email.
update public.profiles
set role = 'admin', full_name = 'Bryce'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE@example.com');

-- 3. Your other team members need to sign up first, then you can update their profiles:
-- update public.profiles set full_name = 'Team Member 2', role = 'member'
-- where id = (select id from auth.users where email = 'teammate2@example.com');
