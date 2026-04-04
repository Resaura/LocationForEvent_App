# CLAUDE.md — Contexte permanent du projet LocationForEvent

## Langue

**Toujours répondre en français**, quels que soient les fichiers ou la langue du code.

---

## Description du projet

**LocationForEvent** est une PWA (Progressive Web App) de gestion pour une société de location de matériel événementiel.  
Elle permet de gérer : le catalogue matériel, les devis et factures, les clients, les relances, les paramètres société et le calcul automatique des prix par amortissement.

Pas de framework front-end — JavaScript vanilla pur, sans bundler, sans TypeScript.  
L'application fonctionne entièrement dans le navigateur. Supabase est la seule dépendance externe (chargée via CDN).

---

## Stack technique

| Élément | Choix |
|---|---|
| Front-end | HTML5 + CSS3 + JavaScript vanilla (ES2020+) |
| Base de données | Supabase (PostgreSQL hébergé) |
| Auth | Aucune — clé anon publique, RLS désactivé |
| Fonts | Syne (titres) + Instrument Sans (corps) via Google Fonts |
| PWA | Service Worker (`sw.js`) + `manifest.json` |
| Icônes | Emojis natifs (pas de lib d'icônes) |
| PDF | `window.open()` + `window.print()` |
| Email | `mailto:` avec corps pré-rempli |
| Déploiement | Fichiers statiques (aucun serveur requis) |

---

## Credentials Supabase

```
URL  : https://bslmkpvfmklsjxssjbyu.supabase.co
KEY  : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzbG1rcHZmbWtsc2p4c3NqYnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDkxMjUsImV4cCI6MjA5MDYyNTEyNX0.uiMDf_L50xfoPSJ5DShHhOfEeQjfdaBrafhNEPM9z7Y
```

Le client est initialisé dans `js/supabase.js` :
```js
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
```

---

## Tables Supabase — schéma complet

### `materiel`
```sql
id       bigint primary key   -- généré par l'app (Date.now())
name     text not null
pa       numeric              -- prix d'achat (€)
cat      text default 'Autre' -- catégorie libre
owned    boolean default false -- true = possédé, false = à acquérir
notes    text default ''
```

### `devis`
```sql
id      bigint primary key   -- généré par l'app (Date.now())
num     text                 -- ex: D-0001, F-0002
date    text                 -- ISO YYYY-MM-DD
client  text
tel     text
email   text
type    text                 -- type d'événement (Mariage, etc.)
lieu    text
recup   text                 -- datetime-local ISO
retour  text                 -- datetime-local ISO
km      numeric default 0
notes   text
lines   jsonb default '[]'   -- tableau de lignes (voir structure ci-dessous)
total   numeric default 0
statut  text default 'brouillon'
        -- valeurs : brouillon | envoyé | à relancer | accepté | refusé | expiré
doctype text default 'devis' -- 'devis' | 'facture'
```

Structure d'une ligne `lines[]` :
```json
{ "id": 1234567890, "name": "Crêpière", "dur": "weekend", "qty": 2, "pu": 15.50, "prix": 31.00, "caut": 120 }
```
Clés `dur` : `jour` | `weekend` | `semaine` | `2s` | `3s` | `mois`

### `clients`
```sql
id    bigint primary key
nom   text not null
tel   text
email text
adr   text
notes text
```

### `amortissement`
```sql
id    int primary key
label text              -- ex: "< 200 €"
min   numeric default 0
max   numeric           -- NULL = Infinity (dernière tranche)
j     int               -- jours d'amortissement
c     jsonb             -- coefficients par durée {weekend, semaine, 2s, 3s, mois}
caut  numeric           -- taux caution (ex: 0.80 = 80%)
```
**Important** : `max = NULL` en base = `Infinity` en JS. Toujours convertir à l'aller et au retour.

### `categories`
```sql
id  bigint generated always as identity primary key
nom text unique not null
```

### `parametres`
```sql
id       int primary key default 1   -- toujours 1 (ligne unique)
nom      text    -- nom société
tel      text
email    text
adr      text
site     text
siret    text
km       numeric default 1.5   -- coût km (€/km)
valid    int default 30         -- validité devis en jours
mentions text                  -- CGV / mentions légales
```

### `meta`
```sql
id   int primary key default 1  -- toujours 1 (ligne unique)
ndv  int default 1              -- prochain numéro de devis
nid  int default 100            -- prochain id interne (inutilisé actuellement)
```

### `relances`
```sql
id           bigint (généré par Supabase)
devis_id     int    -- FK vers devis.id
date_relance text   -- ISO YYYY-MM-DD
notes        text
created_at   text   -- ISO YYYY-MM-DD
```

### Tables présentes mais non encore intégrées dans le code JS
`paiements`, `epicerie`, `services`, `types_evenement` — existent en base, pas de code front associé.

---

## Structure des fichiers JS et leur rôle

Ordre de chargement dans `index.html` (impératif) :

```
js/supabase.js      → Client Supabase + toutes les fonctions sb* (CRUD bas niveau)
js/app.js           → État global (db), navigation, init, dashboard, utilitaires globaux
js/catalogue.js     → Module Catalogue (IIFE) — gestion du matériel
js/categories.js    → Module Categories (IIFE) — gestion des catégories
js/simulateur.js    → Module Simulateur (IIFE) — calculateur de prix
js/devis.js         → Module Devis (IIFE) + Module Historique (IIFE)
js/clients.js       → Module Clients (IIFE) — fichier clients
js/amortissement.js → Module Amortissement (IIFE) — table d'amortissement
js/print.js         → Module Print (IIFE) — génération PDF + email mailto
js/pwa.js           → Module Pwa (IIFE) — enregistrement Service Worker
```

### État global `db` (défini dans `app.js`)
```js
let db = {
  cat:        [],   // matériel (table materiel)
  devis:      [],   // devis + factures (table devis)
  clients:    [],   // clients (table clients)
  amort:      [],   // tranches amortissement
  categories: [],   // noms de catégories (strings)
  params:     {},   // paramètres société
  ndv:        1,    // prochain numéro de devis (auto-incrémenté localement)
  nid:        100   // prochain id interne
};
```

Toutes les données sont chargées en mémoire au démarrage via `sbLoad()`.  
Les modules lisent/écrivent `db` directement (pas de store réactif).

---

## Conventions de code

### Pattern IIFE module
Chaque fonctionnalité est encapsulée dans un IIFE qui retourne uniquement les méthodes publiques :
```js
const MonModule = (() => {
  let _privateVar = [];

  function _privateHelper() { ... }
  function publicMethod() { ... }

  return { publicMethod };
})();
```

### Pattern insert / update séparé (jamais d'upsert sur les devis)
```js
async function sbUpsertDv(dv) {
  if (dv.id) {
    // UPDATE : on retire l'id du payload
    const { id, ...data } = dv;
    const { error } = await sb.from('devis').update(data).eq('id', id);
  } else {
    // INSERT : on ne passe jamais l'id (Supabase/l'app le génère)
    const { id: _, ...data } = dv;
    const { data: row, error } = await sb.from('devis').insert(data).select('id').single();
    dv.id = row.id;  // on récupère l'id généré
  }
}
```
L'`upsert` Supabase n'est utilisé que pour le bulk sync (`sbSyncAll`) et les tables à ligne unique (`parametres`, `meta`).

### IDs
- Générés côté client avec `Date.now()` pour `materiel` et `devis` (bigint)
- **Ne jamais passer l'id dans un payload INSERT**
- `amortissement` : ids fixes 1–7 (tranches prédéfinies)
- `parametres` et `meta` : id toujours = 1 (lignes uniques)

### Mise à jour de l'état local
Toujours mettre à jour `db` en mémoire EN MÊME TEMPS que la sauvegarde Supabase.  
Pas de rechargement complet depuis la base après chaque action.

### Gestion des erreurs
```js
try {
  await sbXxx(...);
  App.toast('Message succès ✅', 'ok');
} catch (err) {
  console.error(err);
  App.toast('Message erreur', 'err');
}
```

### Async / Await
Toutes les fonctions Supabase sont async. Toujours `await` les appels Supabase.

### Fonctions utilitaires globales (définies dans `app.js`)
```js
today()          // → '2025-01-15' (ISO date)
fmtDate(s)       // → '15/01/2025' (affichage FR)
fmtDt(s)         // → '15/01/2025 14:30' (datetime affichage FR)
calc(pa, dur, qty) // → { jour, unit, disp, caut } | null (calcul amortissement)
fillCatSelect(id) // remplit un <select> avec les catégories
```

### Constante `DL` (labels des durées)
```js
const DL = { jour:'1 Jour', weekend:'Week-end', semaine:'1 Semaine', '2s':'2 Semaines', '3s':'3 Semaines', mois:'1 Mois' };
```

---

## Design system

### Palette CSS (variables dans `css/style.css`)
```css
--navy     #0F2744   /* couleur principale sidebar, headers */
--navy2    #1A3C5E
--blue     #2563EB   /* bouton primaire, badge devis */
--blue2    #1D4ED8
--blue-l   #EFF6FF
--gold     #D97706   /* bouton secondaire, alertes */
--gold-l   #FFFBEB
--green    #059669   /* badge facture, succès */
--green-l  #ECFDF5
--red      #DC2626   /* danger, suppression */
--red-l    #FEF2F2
--purple   #7C3AED   /* email, actions spéciales */
--purple-l #F5F3FF
--grey     #6B7280   /* texte secondaire */
--border   #E5E7EB
--bg       #F1F5F9   /* fond général */
```

### Typographie
- **Syne** : titres, logo, éléments de marque (font-weight 700/800)
- **Instrument Sans** : corps de texte, interface (font-weight 400/500/600)
- Base : 14px

### Classes utilitaires fréquentes
```
.btn .btn-primary   → bleu, action principale
.btn .btn-gold      → or, action secondaire
.btn .btn-ghost     → transparent, action tertiaire
.btn .btn-danger    → rouge, suppression
.btn .btn-purple    → violet, email
.btn .btn-sm        → taille réduite
.btn .fw            → full width
.card               → carte blanche avec ombre
.card-hd / .card-bd → header / body de carte
.badge .bg-blue/green/grey → badges inline
.chip / .chip.on    → chips de filtre (actif = .on)
.g2 / .g4           → grille 2 ou 4 colonnes
.r2 / .r3           → rangée 2 ou 3 colonnes (form)
.flex .jb .items-c  → flexbox justify-between / align-center
.dvc                → carte d'un devis dans la liste
.dvc-num / .dvc-client / .dvc-total → sous-éléments de .dvc
.fg / .fl           → form group / form label
.empty / .ei        → état vide (placeholder)
.sep                → séparateur horizontal
.toast              → notification (ajoutée via App.toast())
.overlay / .modal   → système de modales
```

### Modales
Ouverture : `App.openModal('m-xxx')` — ajoute la classe `.open` à `.overlay#m-xxx`  
Fermeture : `App.closeModal('m-xxx')`  
Fermeture au clic sur l'overlay : géré automatiquement dans `App.init()`

### Toasts
```js
App.toast('Message', 'ok')    // vert
App.toast('Message', 'warn')  // orange
App.toast('Message', 'err')   // rouge
```

---

## Statuts des devis

```js
const STATUTS = {
  brouillon:    { label: 'Brouillon',  col: '#6B7280', bg: '#F3F4F6' },
  'envoyé':     { label: 'Envoyé',     col: '#1D4ED8', bg: '#DBEAFE' },
  'à relancer': { label: 'À relancer', col: '#D97706', bg: '#FEF3C7' },
  'accepté':    { label: 'Accepté',    col: '#059669', bg: '#D1FAE5' },
  'refusé':     { label: 'Refusé',     col: '#DC2626', bg: '#FEE2E2' },
  'expiré':     { label: 'Expiré',     col: '#7F1D1D', bg: '#FCA5A5' },
};
```

- Nouveau devis → toujours `brouillon`
- Clic "Email" depuis le détail → passe automatiquement à `envoyé`
- Bouton 🔔 Relancer visible si : statut `à relancer` OU statut `envoyé` depuis > 5 jours
- Relancer → passe à `à relancer` et sauvegarde dans la table `relances`

---

## Règles importantes

1. **Ne jamais envoyer l'`id` dans un payload INSERT** — le destructurer avant l'appel.
2. **`max = null` en base = `Infinity` en JS** — toujours convertir pour `amortissement`.
3. **Ordre de chargement des scripts est impératif** — `supabase.js` → `app.js` → modules.
4. **`db` est l'unique source de vérité en mémoire** — ne jamais recharger depuis Supabase après une action (mettre à jour `db` localement).
5. **Pas de framework, pas de build** — tout doit fonctionner avec des `<script src="...">` classiques.
6. **Pas de rechargement de page** — l'app est une SPA (Single Page App) avec navigation par classes CSS `.active`.
7. **Les IDs matériel et devis sont générés côté client** avec `Date.now()` — ce sont des `bigint` en base.
8. **`parametres` et `meta` ont toujours `id = 1`** — utiliser `.upsert({ id: 1, ... })` pour ces tables.
9. **Les catégories sont des chaînes simples** dans `db.categories[]`, pas des objets.
10. **Supabase retourne `null` pour `max`** (amortissement) — toujours mapper `null ↔ Infinity`.
11. **Les lignes de devis (`lines`) sont du JSONB** — les stocker comme objets JS, pas comme JSON stringifié.
12. **`statut` par défaut en base = `'devis'`** (legacy) — le code JS traite l'absence de statut comme `'brouillon'`.
13. **Incrémenter `CACHE_VERSION` dans `sw.js` à chaque modification de fichier JS ou CSS.** Version actuelle : `lfe-v4`. Format : `lfe-v5`, `lfe-v6`, etc. Sans ça, les utilisateurs continuent de voir l'ancienne version de l'app.
