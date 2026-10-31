-- Organização Orvel Partners (a única nesta fase). Os valores iniciais (tipos de documento,
-- modelos de cronologia e pedidos, aviso de privacidade provisório) são criados pelo trigger
-- install_defaults. Dados bancários e contacto de WhatsApp configuram-se no ecrã de definições.

insert into public.organizations (
  name, slug, hostnames, theme,
  email_from_name, email_from_address, email_reply_to, team_notification_email, contact_email,
  proposal_ref_prefix, timezone, default_locale
) values (
  'Orvel Partners',
  'orvel',
  array['portal.orvelpartners.com'],
  jsonb_build_object(
    'colors', jsonb_build_object(
      'primary', '#0b1628',
      'primary-deep', '#1e3a5f',
      'wordmark', '#546275',
      'action', '#2a57c4',
      'silver', '#c3c9d2',
      'background', '#f4f6f9',
      'line', '#d5dae2'
    ),
    'font', jsonb_build_object(
      'family', 'Source Sans 3',
      'url', 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&display=swap'
    ),
    'wordmark', jsonb_build_object('bold', 'ORVEL', 'light', 'PARTNERS')
  ),
  'Orvel Partners',
  'hello@orvelpartners.com',
  'hello@orvelpartners.com',
  'hello@orvelpartners.com',
  'hello@orvelpartners.com',
  'ORV',
  'Asia/Dubai',
  'pt-PT'
)
on conflict (slug) do nothing;
