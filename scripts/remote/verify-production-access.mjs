// Controlled production verification. Fictional fixtures only; no deletes, no emails,
// no MFA changes, no RLS changes. Server key is used only for fixture setup/inspection.
// All access assertions use real Auth-issued client sessions and the public anon key.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const REF = 'ilwkiruybzxplnhwcwrs';
const URL = `https://${REF}.supabase.co`;
const SITE = 'https://portal.orvelpartners.com';
const ORG = '732cf50a-246b-4c3c-9beb-a590e9428af6';
const PROCESS_A = '56a29fdd-dc88-49ba-9edd-46fd541bea69';
const EMAIL_A = 'dropforcemanagement@gmail.com';
const EMAIL_B = 'isolamento-20261119@exemplo.test';
const DIR = '/private/tmp/orvel-final-validation';
const results = [];
let admin, a, b, memberB;
const assert = (ok, label) => { if (!ok) throw new Error(label); results.push({check:label,passed:true}); };
const checked = (r,label) => { if(r.error) throw new Error(label); return r.data; };
const client = key => createClient(URL,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function session(email, key) {
  const generated = checked(await admin.auth.admin.generateLink({type:'magiclink',email,options:{redirectTo:SITE+'/auth/confirmar'}}),'auth_generate_failed');
  const c=client(key);
  checked(await c.auth.verifyOtp({type:'magiclink',token_hash:generated.properties.hashed_token}),'auth_verify_failed');
  return c;
}

async function sign(c, kind, id, key) {
  const session = c ? (await c.auth.getSession()).data.session : null;
  const headers = {'Content-Type':'application/json',apikey:key,Origin:SITE};
  if(session) headers.Authorization='Bearer '+session.access_token;
  const r=await fetch(URL+'/functions/v1/sign-download',{method:'POST',headers,body:JSON.stringify({kind,id})});
  let data=null; try{data=await r.json();}catch{}
  return {status:r.status,data};
}

async function main() {
  const cfg=JSON.parse(await readFile(join(DIR,'public-config.json'),'utf8'));
  const credentialPath=join(homedir(),'Library/Application Support/OrvelBackup/credentials.json');
  const s=await stat(credentialPath);
  if((s.mode & 0o077)!==0) throw new Error('credential_permissions');
  const credentials=JSON.parse(await readFile(credentialPath,'utf8'));
  if(!credentials.database_url.includes(REF)) throw new Error('project_mismatch');
  admin=client(credentials.storage_key);
  let row=checked(await admin.from('clients').select('id,full_name').eq('organization_id',ORG).eq('email',EMAIL_B).maybeSingle(),'fixture_lookup_failed');
  if(!row) row=checked(await admin.from('clients').insert({organization_id:ORG,full_name:'TESTE ISOLAMENTO 19-11 — sem serviço',email:EMAIL_B}).select('id,full_name').single(),'fixture_client_failed');
  if(!row.full_name.startsWith('TESTE ISOLAMENTO')) throw new Error('fixture_guard_failed');
  const users=checked(await admin.auth.admin.listUsers({page:1,perPage:100}),'fixture_users_failed').users;
  let user=users.find(x=>x.email===EMAIL_B);
  if(!user) user=checked(await admin.auth.admin.createUser({email:EMAIL_B,email_confirm:true,user_metadata:{test_only:true}}),'fixture_auth_failed').user;
  memberB=checked(await admin.from('memberships').upsert({user_id:user.id,organization_id:ORG,client_id:row.id,role:'client',is_active:true},{onConflict:'user_id,organization_id'}).select('id').single(),'fixture_membership_failed').id;
  let proc=checked(await admin.from('processes').select('id').eq('client_id',row.id).limit(1).maybeSingle(),'fixture_process_lookup_failed');
  if(!proc) proc=checked(await admin.from('processes').insert({organization_id:ORG,client_id:row.id,plan_name:'TESTE ISOLAMENTO — sem proposta aceite'}).select('id').single(),'fixture_process_failed');
  a=await session(EMAIL_A,cfg.anon);
  b=await session(EMAIL_B,cfg.anon);
  const notice=checked(await admin.from('privacy_notices').select('id').eq('organization_id',ORG).not('published_at','is',null).order('published_at',{ascending:false}).limit(1).single(),'notice_missing');
  const existingConsent=checked(await admin.from('privacy_consents').select('notice_id').eq('user_id',user.id).eq('notice_id',notice.id),'fixture_consent_lookup_failed');
  if(existingConsent.length===0){
    const before=await b.from('processes').select('id');
    assert(!before.error && before.data.length===0,'client_b_has_no_process_access_before_notice');
  }
  checked(await b.rpc('accept_privacy_notice',{p_notice_id:notice.id,p_user_agent:'Orvel fictional isolation verification 2026-11-19'}),'fixture_notice_failed');
  const aOwn=checked(await a.from('processes').select('id').eq('id',PROCESS_A),'client_a_query_failed');
  assert(aOwn.length===1,'client_a_can_read_own_process');
  const bOwn=checked(await b.from('processes').select('id').eq('id',proc.id),'client_b_query_failed');
  assert(bOwn.length===1,'client_b_can_read_own_process_after_notice');
  assert(checked(await a.from('processes').select('id').eq('id',proc.id),'cross_a_query_failed').length===0,'client_a_cannot_read_client_b_process');
  assert(checked(await b.from('processes').select('id').eq('id',PROCESS_A),'cross_b_query_failed').length===0,'client_b_cannot_read_client_a_process');
  for(const table of ['documents','document_requests','proposals','people','payments','timeline_steps','deadlines','process_internal']){
    const r=await b.from(table).select('*').eq('process_id',PROCESS_A);
    assert(Boolean(r.error)||r.data.length===0,'client_b_cannot_read_client_a_'+table);
  }
  const privateA=await a.from('process_internal').select('*').eq('process_id',PROCESS_A);
  assert(Boolean(privateA.error)||privateA.data.length===0,'client_a_cannot_read_internal_process_details');
  const docs=checked(await admin.from('documents').select('id,request_id,storage_path,file_name,direction,visible_to_client').eq('process_id',PROCESS_A),'documents_inspection_failed');
  const visible=docs.filter(d=>d.direction==='upload'||d.visible_to_client);
  assert(visible.some(d=>d.file_name==='orvel-teste-v2.pdf'),'corrected_document_exists');
  const proposal=checked(await a.from('proposals').select('id,pdf_path,status').eq('process_id',PROCESS_A).eq('status','accepted').single(),'accepted_proposal_missing');
  const p=await sign(a,'proposal',proposal.id,cfg.anon);
  assert(p.status===200 && p.data.expires_in===60,'own_proposal_has_60_second_signed_download');
  assert(sha(Buffer.from(await (await fetch(p.data.url)).arrayBuffer()))===sha(await readFile(join(DIR,'orvel-proposta-ficticia.pdf'))),'proposal_download_matches_original_bytes');
  assert((await sign(b,'proposal',proposal.id,cfg.anon)).status===404,'other_client_cannot_download_proposal');
  for(const doc of docs){
    const own=await sign(a,'document',doc.id,cfg.anon);
    if(doc.direction==='issued'&&!doc.visible_to_client){
      assert(own.status===404,'internal_issued_document_cannot_be_downloaded_by_client');
      const listed=checked(await a.from('documents').select('id').eq('id',doc.id),'hidden_document_query_failed');
      assert(listed.length===0,'internal_issued_document_not_listed_to_client');
      continue;
    }
    assert(own.status===200&&own.data.expires_in===60,'own_document_signed_download_'+doc.file_name);
    const expected=await readFile(join('/private/tmp/orvel-document-validation',doc.file_name));
    const downloaded=await fetch(own.data.url);
    assert(downloaded.status===200&&sha(Buffer.from(await downloaded.arrayBuffer()))===sha(expected),'document_bytes_match_'+doc.file_name);
    assert((await sign(b,'document',doc.id,cfg.anon)).status===404,'cross_client_download_denied_'+doc.file_name);
    assert((await sign(null,'document',doc.id,cfg.anon)).status===401,'anonymous_download_denied_'+doc.file_name);
    const direct=await a.storage.from('documents').download(doc.storage_path);
    assert(Boolean(direct.error),'direct_storage_read_denied_'+doc.file_name);
  }
  const current=docs.find(x=>x.file_name==='orvel-teste-v2.pdf');
  const review=await a.rpc('review_document_request',{p_request_id:current.request_id,p_document_id:current.id,p_status:'approved',p_reason:null});
  assert(Boolean(review.error),'client_cannot_review_own_document');
  const c=checked(await a.rpc('register_upload',{p_request_id:current.request_id,p_storage_path:current.storage_path,p_file_name:current.file_name}),'idempotent_register_failed');
  assert(c===current.id,'repeat_upload_registration_returns_same_document');
  const insert=await b.storage.from('documents').upload(`${ORG}/${PROCESS_A}/uploads/${current.request_id}/${randomUUID()}-forbidden.pdf`,Buffer.from('%PDF-fictional forbidden cross-client probe'),{contentType:'application/pdf',upsert:false});
  assert(Boolean(insert.error),'other_client_storage_upload_denied');
  const update=await b.from('document_requests').update({status:'approved'}).eq('id',current.request_id).select('id');
  assert(Boolean(update.error)||update.data.length===0,'other_client_document_update_denied');
  const ctx=checked(await b.rpc('get_session_context',{p_org:ORG}),'context_lookup_failed');
  assert(ctx.role==='client'&&!ctx.mfa_required,'second_fixture_is_client_not_staff');
  return {fixture_client_id:row.id,fixture_process_id:proc.id,document_count:docs.length};
}

let details={},failure=null;
try { details=await main(); }
catch(e){failure=String(e.message).replace(/[^a-zA-Z0-9_ -]/g,'').slice(0,120);}
finally {
  if(admin&&memberB){
    const r=await admin.from('memberships').update({is_active:false}).eq('id',memberB).select('is_active').single();
    if(r.error||r.data?.is_active!==false) failure='fixture_deactivation_failed';
  }
  for(const c of [a,b]) if(c) await c.auth.signOut({scope:'local'}).catch(()=>{});
}
const report={checked_at:new Date().toISOString(),project_ref:REF,results,passed:!failure,failure,...details,
  fixture_membership_deactivated:Boolean(memberB)&&failure!=='fixture_deactivation_failed',automatic_deletion:false,
  note:'No credentials, signed URLs or document bodies stored. Browser sessions not used by this runner.'};
await writeFile(join(DIR,'access-report-'+Date.now()+'.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
await writeFile(join(DIR,'access-report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
if(failure) process.exitCode=1;
