// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT — LocationForEvent v2
// ═══════════════════════════════════════════════════════════════
//
// SCHÉMA SQL — coller dans l'éditeur SQL de Supabase (une fois) :
// ─────────────────────────────────────────────────────────────────
// create table materiel (
//   id bigint primary key,
//   name text not null,
//   pa numeric,
//   cat text default 'Autre',
//   owned boolean default false,
//   notes text default ''
// );
//
// create table devis (
//   id bigint primary key,
//   num text,
//   date text,
//   client text,
//   tel text,
//   email text,
//   type text,
//   lieu text,
//   recup text,
//   retour text,
//   km numeric default 0,
//   notes text,
//   lines jsonb default '[]',
//   total numeric default 0,
//   statut text default 'devis',
//   doctype text default 'devis'
// );
//
// create table clients (
//   id bigint primary key,
//   nom text not null,
//   tel text,
//   email text,
//   adr text,
//   notes text
// );
//
// create table amortissement (
//   id int primary key,
//   label text,
//   min numeric default 0,
//   max numeric,   -- NULL = Infinity (dernière tranche)
//   j int,
//   c jsonb,
//   caut numeric
// );
//
// create table categories (
//   id bigint generated always as identity primary key,
//   nom text unique not null
// );
//
// create table parametres (
//   id int primary key default 1,
//   nom text, tel text, email text, adr text,
//   site text, siret text,
//   km numeric default 1.5,
//   valid int default 30,
//   mentions text
// );
//
// create table meta (
//   id int primary key default 1,
//   ndv int default 1,
//   nid int default 100
// );
// ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://bslmkpvfmklsjxssjbyu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbG1rcHZmbWtsc2p4c3NqYnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDkxMjUsImV4cCI6MjA5MDYyNTEyNX0.uiMDf_L50xfoPSJ5DShHhOfEeQjfdaBrafhNEPM9z7Y';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;

// ─── CHARGEMENT INITIAL ──────────────────────────────────────────
async function sbLoad() {
  const [mRes, dvRes, cliRes, amRes, catRes, pRes, metaRes] = await Promise.all([
    sb.from('materiel').select('*').order('id'),
    sb.from('devis').select('*').order('id'),
    sb.from('clients').select('*').order('id'),
    sb.from('amortissement').select('*').order('id'),
    sb.from('categories').select('nom').order('nom'),
    sb.from('parametres').select('*').eq('id', 1).maybeSingle(),
    sb.from('meta').select('*').eq('id', 1).maybeSingle()
  ]);

  for (const r of [mRes, dvRes, cliRes, amRes, catRes]) {
    if (r.error) throw r.error;
  }

  // Restaurer Infinity pour la dernière tranche d'amortissement
  const amort = (amRes.data || []).map(r => ({
    ...r,
    max: r.max === null ? Infinity : r.max
  }));

  return {
    cat:        mRes.data   || [],
    devis:      dvRes.data  || [],
    clients:    cliRes.data || [],
    amort,
    categories: (catRes.data || []).map(r => r.nom),
    params:     pRes.data   || {},
    ndv:        metaRes.data?.ndv ?? 1,
    nid:        metaRes.data?.nid ?? 100
  };
}

// ─── MATERIEL ────────────────────────────────────────────────────
async function sbUpsertMat(item, isNew) {
  if (!isNew && item.id) {
    // UPDATE existant
    const { id, ...data } = item;
    const { error } = await sb.from('materiel').update(data).eq('id', id);
    if (error) throw error;
  } else {
    // INSERT — id généré côté client (Date.now())
    const { error } = await sb.from('materiel').insert(item);
    if (error) throw error;
  }
}

async function sbDeleteMat(id) {
  const { error } = await sb.from('materiel').delete().eq('id', id);
  if (error) throw error;
}

// ─── DEVIS ───────────────────────────────────────────────────────
async function sbUpsertDv(dv) {
  if (dv.id) {
    const { id, ...data } = dv;
    const { error } = await sb.from('devis').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = dv;
    const { data: row, error } = await sb.from('devis').insert(data).select('id').single();
    if (error) throw error;
    dv.id = row.id;
  }
}

async function sbDeleteDv(id) {
  const { error } = await sb.from('devis').delete().eq('id', id);
  if (error) throw error;
}

// ─── CLIENTS ─────────────────────────────────────────────────────
async function sbUpsertCli(cli) {
  if (cli.id) {
    const { id, ...data } = cli;
    const { error } = await sb.from('clients').update(data).eq('id', id);
    if (error) throw error;
  } else {
    const { id: _, ...data } = cli;
    const { data: row, error } = await sb.from('clients').insert(data).select('id').single();
    if (error) throw error;
    cli.id = row.id;
  }
}

async function sbDeleteCli(id) {
  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ─── AMORTISSEMENT ───────────────────────────────────────────────
async function sbSaveAmort(rows) {
  // Remplacer Infinity par null pour Supabase (numeric ne supporte pas Infinity)
  const payload = rows.map(r => ({ ...r, max: r.max === Infinity ? null : r.max }));
  const { error } = await sb.from('amortissement').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

// ─── CATÉGORIES ──────────────────────────────────────────────────
async function sbSaveCats(cats) {
  await sb.from('categories').delete().not('id', 'is', null);
  if (cats.length) {
    const { error } = await sb.from('categories').insert(cats.map(nom => ({ nom })));
    if (error) throw error;
  }
}

// ─── PARAMÈTRES ──────────────────────────────────────────────────
async function sbSaveParams(params) {
  const { error } = await sb.from('parametres').upsert({ id: 1, ...params }, { onConflict: 'id' });
  if (error) throw error;
}

// ─── META (compteurs ndv / nid) ───────────────────────────────────
async function sbSaveMeta(ndv, nid) {
  const { error } = await sb.from('meta').upsert({ id: 1, ndv, nid }, { onConflict: 'id' });
  if (error) throw error;
}

// ─── SYNC COMPLET (import JSON) ───────────────────────────────────
async function sbSyncAll(db) {
  const ops = [];
  if (db.cat?.length)     ops.push(sb.from('materiel').upsert(db.cat, { onConflict: 'id' }));
  if (db.devis?.length)   ops.push(sb.from('devis').upsert(db.devis, { onConflict: 'id' }));
  if (db.clients?.length) ops.push(sb.from('clients').upsert(db.clients, { onConflict: 'id' }));
  if (db.amort?.length) {
    const amortPayload = db.amort.map(r => ({ ...r, max: r.max === Infinity ? null : r.max }));
    ops.push(sb.from('amortissement').upsert(amortPayload, { onConflict: 'id' }));
  }
  if (db.categories) ops.push(sbSaveCats(db.categories));
  if (db.params)     ops.push(sbSaveParams(db.params));
  ops.push(sbSaveMeta(db.ndv ?? 1, db.nid ?? 100));

  const results = await Promise.all(ops);
  for (const r of results) {
    if (r?.error) throw r.error;
  }
}

// ─── RÉINITIALISATION COMPLÈTE ────────────────────────────────────
async function sbClearAll() {
  await Promise.all([
    sb.from('materiel').delete().not('id', 'is', null),
    sb.from('devis').delete().not('id', 'is', null),
    sb.from('clients').delete().not('id', 'is', null),
    sb.from('amortissement').delete().not('id', 'is', null),
    sb.from('categories').delete().not('id', 'is', null),
    sb.from('parametres').delete().eq('id', 1),
    sb.from('meta').delete().eq('id', 1)
  ]);
}

// ─── STATUT DEVIS ─────────────────────────────────────────────────
async function sbUpdateStatutDv(id, statut) {
  const { error } = await sb.from('devis').update({ statut }).eq('id', id);
  if (error) throw error;
}

// ─── RELANCES ─────────────────────────────────────────────────────
async function sbSaveRelance(relance) {
  const { data, error } = await sb.from('relances').insert(relance).select('id').single();
  if (error) throw error;
  return data.id;
}
