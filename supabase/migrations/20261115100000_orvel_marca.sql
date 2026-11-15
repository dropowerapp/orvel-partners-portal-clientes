-- Identidade visual Orvel Partners (documentos da marca recebidos a 15/11/2026).
-- Botões e ligações no azul-marinho da marca (#1e3a5f), em vez do azul vivo provisório.
-- O logótipo e o símbolo vão para o bucket "branding" com scripts/remote/branding-upload.sh,
-- que também preenche logo_path e theme.symbol_path (só depois de os ficheiros existirem).
update public.organizations
set theme = jsonb_set(coalesce(theme, '{}'::jsonb), '{colors,action}', '"#1e3a5f"')
where slug = 'orvel';
