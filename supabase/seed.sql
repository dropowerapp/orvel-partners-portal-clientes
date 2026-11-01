-- Dados FICTÍCIOS para desenvolvimento local. Nunca usar dados de clientes reais.
-- Corre depois das migrações em `supabase db reset` (ou scripts/local/db-reset.sh).
-- Emails em @exemplo.test (domínio reservado, nunca entrega).
--
-- Acessos locais:
--   Equipa Orvel ........ equipa@exemplo.test / Orvel-Local-2026!  (pede MFA no 1.º login)
--   Equipa Exemplo ...... equipa.exemplo@exemplo.test / Orvel-Local-2026!
--   Clientes ............ link mágico (ver emails no Inbucket/Mailpit local)
--                         O Rui ainda não aceitou o aviso de privacidade; os outros já.

do $$
declare
  v_orvel uuid := (select id from public.organizations where slug = 'orvel');
  v_ex uuid := md5('seed:org-exemplo')::uuid;
  v_password text := extensions.crypt('Orvel-Local-2026!', extensions.gen_salt('bf'));
  v_user record;
  v_proc1 uuid := md5('seed:proc-rui')::uuid;
  v_proc2 uuid := md5('seed:proc-marta')::uuid;
  v_proc3 uuid := md5('seed:proc-joao')::uuid;
  v_proc4 uuid := md5('seed:proc-carla')::uuid;
  v_bank uuid := md5('seed:bank-orvel')::uuid;
  v_type record;
begin
  -- Organização Orvel servida também em localhost
  update public.organizations set
    hostnames = array(select distinct unnest(hostnames || array['localhost', '127.0.0.1'])),
    contact_whatsapp = '+971500000000'
  where id = v_orvel;
  update public.privacy_notices set published_at = now() where organization_id = v_orvel and version = 1;

  -- Segunda organização fictícia (para testar o isolamento white label à mão)
  insert into public.organizations (id, name, slug, hostnames, email_from_name, email_from_address,
    email_reply_to, team_notification_email, contact_email, proposal_ref_prefix, theme)
  values (v_ex, 'Consultora Exemplo', 'exemplo', array['exemplo.localhost'], 'Consultora Exemplo',
    'hello@exemplo.test', 'hello@exemplo.test', 'hello@exemplo.test', 'hello@exemplo.test', 'CEX',
    '{"colors": {"primary": "#2d2a26", "primary-deep": "#4a4540", "wordmark": "#6b645c", "action": "#b5542d",
      "silver": "#d8d2ca", "background": "#f7f5f2", "line": "#e2ddd6"},
      "font": {"family": "Source Sans 3"}, "wordmark": {"bold": "CONSULTORA", "light": "EXEMPLO"}}');
  update public.privacy_notices set published_at = now() where organization_id = v_ex and version = 1;

  -- Utilizadores (auth)
  for v_user in
    select * from (values
      ('equipa@exemplo.test', true),
      ('equipa.exemplo@exemplo.test', true),
      ('rui.ficticio@exemplo.test', false),
      ('marta.exemplo@exemplo.test', false),
      ('joao.teste@exemplo.test', false),
      ('carla.exemplo@exemplo.test', false),
      ('parceiro@exemplo.test', true)
    ) as u (email, has_password)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', md5('seed:' || v_user.email)::uuid, 'authenticated', 'authenticated',
      v_user.email, case when v_user.has_password then v_password end, now(),
      '{"provider": "email", "providers": ["email"]}', '{}', '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at)
    values (md5('seed:' || v_user.email)::uuid::text, md5('seed:' || v_user.email)::uuid,
      jsonb_build_object('sub', md5('seed:' || v_user.email)::uuid::text, 'email', v_user.email), 'email', now());
  end loop;

  insert into public.memberships (user_id, organization_id, role, display_name) values
    (md5('seed:equipa@exemplo.test')::uuid, v_orvel, 'admin', 'Equipa (teste)'),
    (md5('seed:equipa.exemplo@exemplo.test')::uuid, v_ex, 'admin', 'Equipa Exemplo (teste)');

  insert into public.bank_accounts (id, organization_id, label, beneficiary, bank_name, iban, swift)
  values (v_bank, v_orvel, 'Conta AED (fictícia)', 'Beneficiário Fictício FZ-LLC', 'Banco Exemplo',
          'AE070000000000000000001', 'EXMPAEADXXX');

  insert into public.partners (id, organization_id, name)
  values (md5('seed:partner')::uuid, v_orvel, 'Parceiro Exemplo');
  insert into public.memberships (user_id, organization_id, role, partner_id)
  values (md5('seed:parceiro@exemplo.test')::uuid, v_orvel, 'partner', md5('seed:partner')::uuid);

  -- Clientes
  insert into public.clients (id, organization_id, full_name, email, phone, country, city, invited_at) values
    (md5('seed:client-rui')::uuid, v_orvel, 'Rui Fictício', 'rui.ficticio@exemplo.test', '+351 910 000 001', 'Portugal', 'Lisboa', now() - interval '3 days'),
    (md5('seed:client-marta')::uuid, v_orvel, 'Marta Exemplo', 'marta.exemplo@exemplo.test', '+244 920 000 002', 'Angola', 'Luanda', now() - interval '60 days'),
    (md5('seed:client-joao')::uuid, v_orvel, 'João Teste', 'joao.teste@exemplo.test', '+351 930 000 003', 'Portugal', 'Porto', now() - interval '150 days'),
    (md5('seed:client-carla')::uuid, v_ex, 'Carla Exemplo', 'carla.exemplo@exemplo.test', '+351 940 000 004', 'Portugal', 'Braga', now() - interval '5 days');

  insert into public.memberships (user_id, organization_id, role, client_id) values
    (md5('seed:rui.ficticio@exemplo.test')::uuid, v_orvel, 'client', md5('seed:client-rui')::uuid),
    (md5('seed:marta.exemplo@exemplo.test')::uuid, v_orvel, 'client', md5('seed:client-marta')::uuid),
    (md5('seed:joao.teste@exemplo.test')::uuid, v_orvel, 'client', md5('seed:client-joao')::uuid),
    (md5('seed:carla.exemplo@exemplo.test')::uuid, v_ex, 'client', md5('seed:client-carla')::uuid);

  -- Aviso de privacidade já aceite por todos menos o Rui (para ver o ecrã de consentimento).
  insert into public.privacy_consents (organization_id, user_id, notice_id, accepted_at)
  select n.organization_id, md5('seed:' || u.email)::uuid, n.id, now() - interval '30 days'
  from (values ('marta.exemplo@exemplo.test', v_orvel), ('joao.teste@exemplo.test', v_orvel),
               ('carla.exemplo@exemplo.test', v_ex)) as u(email, org)
  join public.privacy_notices n on n.organization_id = u.org and n.version = 1;

  -- Processo 1 — Rui: proposta enviada com dois planos
  insert into public.processes (id, organization_id, client_id, free_zone, visa_count, bank_account_id)
  values (v_proc1, v_orvel, md5('seed:client-rui')::uuid, 'Free zone exemplo', 3, v_bank);
  insert into public.people (organization_id, process_id, relationship, full_name, nationality, date_of_birth) values
    (v_orvel, v_proc1, 'holder', 'Rui Fictício', 'Portuguesa', '1984-03-12'),
    (v_orvel, v_proc1, 'spouse', 'Inês Fictícia', 'Portuguesa', '1986-07-02'),
    (v_orvel, v_proc1, 'child', 'Tomás Fictício', 'Portuguesa', '2016-11-20');
  insert into public.proposals (organization_id, process_id, reference, pdf_path, plans, valid_until, status)
  values (v_orvel, v_proc1, 'ORV-2026-901', v_orvel || '/' || v_proc1 || '/proposals/ORV-2026-901.pdf',
    '[{"name": "Essencial", "price_aed": 25000, "includes_bank_account": false},
      {"name": "Completo", "price_aed": 32000, "includes_bank_account": true}]',
    current_date + 14, 'sent');
  update public.process_internal set partner_id = md5('seed:partner')::uuid, partner_cost_aed = 17000,
    sale_price_aed = 32000, other_costs = '[{"label": "Taxas de free zone (fictício)", "amount_aed": 1200}]',
    manager_user_id = md5('seed:equipa@exemplo.test')::uuid
  where process_id = v_proc1;

  -- Processo 2 — Marta: aceite, pago, documentos aprovados, documentos emitidos com prazos
  insert into public.processes (id, organization_id, client_id, free_zone, visa_count, bank_account_id, company_name_options)
  values (v_proc2, v_orvel, md5('seed:client-marta')::uuid, 'Free zone exemplo', 1, v_bank,
          array['Atlântico Trading', 'Kwanza Consulting', 'Sul Serviços']);
  insert into public.people (id, organization_id, process_id, relationship, full_name, nationality, date_of_birth)
  values (md5('seed:person-marta')::uuid, v_orvel, v_proc2, 'holder', 'Marta Exemplo', 'Angolana', '1979-01-25');
  insert into public.proposals (organization_id, process_id, reference, pdf_path, plans, valid_until, status)
  values (v_orvel, v_proc2, 'ORV-2026-902', v_orvel || '/' || v_proc2 || '/proposals/ORV-2026-902.pdf',
    '[{"name": "Completo", "price_aed": 32000, "includes_bank_account": true}]', current_date + 20, 'sent');
  perform set_config('app.accepting_proposal', 'on', true);
  update public.proposals set status = 'accepted', chosen_plan = 'Completo', accepted_at = now() - interval '50 days',
    accepted_by = md5('seed:marta.exemplo@exemplo.test')::uuid, accepted_ip = '192.0.2.10',
    accepted_text = 'Declaro que li e aceito a proposta ORV-2026-902, no plano Completo, pelo valor total de 32,000.00 AED, nas condições descritas no documento.'
  where reference = 'ORV-2026-902';
  perform set_config('app.accepting_proposal', 'off', true);
  update public.processes set plan_name = 'Completo', includes_bank_account = true,
    bank_details_released_at = now() - interval '49 days'
  where id = v_proc2;
  insert into public.payments (organization_id, process_id, description, amount_aed, status, due_on, paid_on)
  values (v_orvel, v_proc2, 'Pagamento único', 32000, 'paid', current_date - 45, current_date - 44);
  update public.document_requests set status = 'approved' where process_id = v_proc2;
  update public.timeline_steps set status = 'done', done_on = current_date - 20
  where process_id = v_proc2 and position between 40 and 80;
  update public.timeline_steps set status = 'in_progress', planned_on = current_date + 5,
    client_note = 'Exame médico marcado. Enviaremos a hora e o local por email.'
  where process_id = v_proc2 and position = 100;

  for v_type in
    select * from (values
      ('trade_licence', 'licenca-comercial.pdf', current_date - 30, current_date + 335),
      ('establishment_card', 'establishment-card.pdf', current_date - 25, current_date + 25),
      ('incorporation_certificate', 'certificado-constituicao.pdf', current_date - 30, null::date)
    ) as d (key, file_name, issued_on, expires_on)
  loop
    insert into public.documents (organization_id, process_id, document_type_id, direction, storage_path,
      file_name, mime_type, size_bytes, issued_on, expires_on)
    select v_orvel, v_proc2, t.id, 'issued', v_orvel || '/' || v_proc2 || '/issued/' || v_type.file_name,
      v_type.file_name, 'application/pdf', 120000, v_type.issued_on, v_type.expires_on
    from public.document_types t
    where t.organization_id = v_orvel and t.key = v_type.key and t.direction = 'issued';
  end loop;

  insert into public.partner_assignments (organization_id, partner_id, process_id)
  values (v_orvel, md5('seed:partner')::uuid, v_proc2);
  insert into public.internal_notes (organization_id, process_id, author_id, body)
  values (v_orvel, v_proc2, md5('seed:equipa@exemplo.test')::uuid, 'Cliente prefere contacto por WhatsApp (nota fictícia).');

  -- Processo 3 — João: concluído há 35 dias (limpeza dos ficheiros sensíveis em atraso)
  insert into public.processes (id, organization_id, client_id, free_zone, visa_count)
  values (v_proc3, v_orvel, md5('seed:client-joao')::uuid, 'Free zone exemplo', 1);
  insert into public.people (organization_id, process_id, relationship, full_name, nationality)
  values (v_orvel, v_proc3, 'holder', 'João Teste', 'Portuguesa');
  insert into public.documents (organization_id, process_id, person_id, request_id, document_type_id, direction,
    storage_path, file_name, mime_type, size_bytes)
  select v_orvel, v_proc3, r.person_id, r.id, r.document_type_id, 'upload',
    v_orvel || '/' || v_proc3 || '/uploads/' || r.id || '/ficheiro.pdf', t.key || '.pdf', 'application/pdf', 90000
  from public.document_requests r join public.document_types t on t.id = r.document_type_id
  where r.process_id = v_proc3;
  update public.document_requests set status = 'approved' where process_id = v_proc3;
  update public.processes set completed_at = now() - interval '35 days' where id = v_proc3;

  -- Processo 4 — Carla (Consultora Exemplo)
  insert into public.processes (id, organization_id, client_id) values (v_proc4, v_ex, md5('seed:client-carla')::uuid);
  insert into public.people (organization_id, process_id, relationship, full_name, nationality)
  values (v_ex, v_proc4, 'holder', 'Carla Exemplo', 'Portuguesa');
end $$;
