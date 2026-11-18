-- Apenas o aviso em vigor integra a informação pública do portal. Não publica textos,
-- não concede leitura de tabelas e não altera confirmação de leitura, RLS ou conservação.
-- Esta RPC já é deliberadamente anónima para resolver a marca por domínio/slug.
-- SECURITY DEFINER permite a projeção explícita de campos públicos sem abrir as tabelas.
create or replace function public.get_org_public(p_host text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'name', o.name,
    'slug', o.slug,
    'logo_path', o.logo_path,
    'theme', o.theme,
    'contact_email', o.contact_email,
    'contact_whatsapp', o.contact_whatsapp,
    'default_locale', o.default_locale,
    'privacy_notice', (
      select jsonb_build_object(
        'id', n.id, 'version', n.version, 'body', n.body,
        'published_at', n.published_at, 'retention_days', o.sensitive_retention_days
      )
      from public.privacy_notices n
      where n.organization_id = o.id and n.id = private.current_notice_id(o.id)
    )
  )
  from public.organizations o
  where lower(p_host) = any (o.hostnames) or o.slug = lower(p_host)
  order by (lower(p_host) = any (o.hostnames)) desc
  limit 1
$$;

revoke all on function public.get_org_public(text) from public;
grant execute on function public.get_org_public(text) to anon, authenticated, service_role;
