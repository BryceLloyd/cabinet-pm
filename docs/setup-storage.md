# Supabase Storage Setup

## business-assets bucket

This bucket stores the business logo and workshop photo. It must be created
manually because Supabase Storage buckets can't be provisioned via SQL.

### Steps

1. Open the [Supabase dashboard](https://supabase.com/dashboard) → your project → **Storage**
2. Click **New bucket**
3. Name: `business-assets`
4. Toggle **Public bucket** ON (these images appear on the unauthenticated login screen)
5. Click **Create bucket**

### Policies

After creating the bucket, add these policies under **Policies** tab:

| Operation | Policy name | Target roles | Definition |
|-----------|-------------|-------------|------------|
| SELECT | Public read | `anon`, `authenticated` | `true` |
| INSERT | Admin upload | `authenticated` | `(exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))` |
| UPDATE | Admin update | `authenticated` | Same as INSERT |
| DELETE | Admin delete | `authenticated` | Same as INSERT |

### Usage

Files are uploaded to paths like:
- `logo.png` (or whatever extension)
- `workshop.jpg`

The public URL pattern is:
```
{SUPABASE_URL}/storage/v1/object/public/business-assets/{filename}
```
