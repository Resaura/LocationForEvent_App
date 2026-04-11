// ═══════════════════════════════════════════════════════════════
// PRINT.JS — Génération PDF + Email
// ═══════════════════════════════════════════════════════════════

const Print = (() => {

  // ── Helpers design ──────────────────────────────────────────
  function _ds() {
    const def = { couleurPrimaire:'#0F2744', couleurSecondaire:'#2563EB', logo:null, disposition:'A', police:'classique', afficherCaution:true, afficherMentions:true, afficherSiret:true, filigrane:false };
    return Object.assign(def, (db.params || {}).design || {});
  }
  function _fontCss(police) {
    if (police === 'moderne') return "'Instrument Sans','Segoe UI',sans-serif";
    if (police === 'elegante') return "Georgia,'Times New Roman',serif";
    return "Helvetica,Arial,sans-serif";
  }
  function _filigraneHtml(dv, ds) {
    if (!ds.filigrane) return '';
    const labels = { brouillon:'BROUILLON', 'envoyé':'ENVOYÉ', 'à relancer':'À RELANCER', 'accepté':'ACCEPTÉ', 'refusé':'REFUSÉ', 'expiré':'EXPIRÉ' };
    const txt = labels[dv.statut] || 'BROUILLON';
    return `<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(0,0,0,0.04);pointer-events:none;z-index:0;white-space:nowrap">${txt}</div>`;
  }

  // ── PDF (window.open) ─────────────────────────────────────
  // Helper : recalcule prixNet de chaque ligne
  function _calcLines(rawLines) {
    return (rawLines || []).map(l => {
      const ll = { ...l, remises: l.remises || [] };
      let base = ll.prix;
      for (const r of ll.remises) {
        if (r.type === 'pourcentage') r.montant_deduit = arrondi(base * r.valeur / 100);
        else r.montant_deduit = Math.min(r.valeur, base);
        base -= r.montant_deduit;
      }
      ll.prixNet = Math.max(0, base);
      return ll;
    });
  }

  // Helper : enrichir lignes avec images/descriptions depuis le catalogue
  function _enrichLines(lines) {
    return lines.map(l => {
      const ll = { ...l };
      // Préserver explicitement les champs remises depuis la ligne originale
      if (l.remises) ll.remises = l.remises;
      if (l.prixNet != null) ll.prixNet = l.prixNet;
      if (l.prixHT_apres_remises != null) ll.prixHT_apres_remises = l.prixHT_apres_remises;
      if (l.prixTTC_apres_remises != null) ll.prixTTC_apres_remises = l.prixTTC_apres_remises;
      if (!ll._image && ll.dur !== 'epicerie' && ll.dur !== 'service' && ll.dur !== 'protection') {
        const item = db.cat.find(i => i.name === ll.name);
        if (item) {
          if (item.image) ll._image = item.image;
          if (item.notes && !ll._desc) ll._desc = item.notes;
        }
      }
      return ll;
    });
  }

  function dv(dv) {
    if (!dv) return;
    const p   = db.params || {};
    const ds  = _ds();
    const isF = dv.doctype === 'facture';
    const km  = dv.km || 0;
    const kmt = p.km || 1.5;
    const allLines = _enrichLines(_calcLines(dv.lines));
    const lines    = allLines.filter(l => !l.optional);
    const optLines = allLines.filter(l => l.optional);
    const sousTotal = lines.reduce((s, l) => s + l.prixNet, 0);
    const sousTotalBrut = lines.reduce((s, l) => s + l.prix, 0);
    const hasLineRemises = lines.some(l => l.remises && l.remises.length > 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot = Math.max(0, sousTotal - totalRemises);
    const caut = lines.reduce((s, l) => s + (l.caut || 0), 0);
    const c1 = ds.couleurPrimaire;
    const c2 = isF ? '#059669' : ds.couleurSecondaire;
    const fontFam = _fontCss(ds.police);

    // Build header based on disposition
    let headerHtml = '';
    const infoLines = [
      p.adr  ? `<div class="logo-sub">${p.adr}</div>` : '',
      p.tel  ? `<div class="logo-sub">${p.tel}${p.email ? ' · ' + p.email : ''}</div>` : '',
      p.site ? `<div class="logo-sub">${p.site}</div>` : '',
      ds.afficherSiret && p.siret ? `<div class="logo-sub">SIRET : ${p.siret}</div>` : ''
    ].filter(Boolean).join('');
    const logoImg = ds.logo ? `<img src="${ds.logo}" style="max-height:50px;max-width:160px">` : '';
    const docMeta = `<div class="doc-type">${isF ? 'FACTURE' : 'DEVIS'}</div>
      <div class="doc-meta">N° ${dv.num || '—'}</div>
      <div class="doc-meta">Émis le ${fmtDate(dv.date || today())}</div>
      ${!isF && p.valid ? `<div class="doc-meta">Valable ${p.valid} jours</div>` : ''}`;

    if (ds.disposition === 'A') {
      headerHtml = `<div class="hd">
        <div style="display:flex;align-items:center;gap:14px">
          ${logoImg}
          <div><div class="logo">${p.nom || 'LocationForEvent'}</div>${infoLines}</div>
        </div>
        <div>${docMeta}</div>
      </div>`;
    } else if (ds.disposition === 'C') {
      headerHtml = `<div class="hd" style="flex-direction:column;align-items:center;text-align:center">
        ${logoImg ? `<div style="margin-bottom:6px">${logoImg}</div>` : ''}
        <div class="logo">${p.nom || 'LocationForEvent'}</div>
        ${infoLines}
        <div style="margin-top:8px">${docMeta.replace(/text-align:right/g, 'text-align:center')}</div>
      </div>`;
    } else {
      headerHtml = `<div class="hd">
        <div><div class="logo">${p.nom || 'LocationForEvent'}</div>${infoLines}</div>
        <div>${logoImg ? `<div style="text-align:right;margin-bottom:6px">${logoImg}</div>` : ''}${docMeta}</div>
      </div>`;
    }

    const w = window.open('', '_blank');
    if (!w) { App.toast('Autorisez les popups pour imprimer', 'warn'); return; }

    w.document.write(`<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<title>${isF ? 'Facture' : 'Devis'} ${dv.num || ''} — ${p.nom || 'LocationForEvent'}</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}
body{font-family:${fontFam};font-size:13px;color:#111;margin:0;padding:36px;line-height:1.5;position:relative}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid ${c1}}
.logo{font-size:20px;font-weight:800;color:${c1}}
.logo-sub{font-size:11px;color:#6B7280;margin-top:2px}
.doc-type{font-size:17px;font-weight:800;color:${c2};text-align:right}
.doc-meta{font-size:12px;color:#374151;text-align:right;margin-top:3px}
.client-box{background:#F9FAFB;border-radius:8px;padding:12px 14px;margin-bottom:22px;display:grid;grid-template-columns:1fr 1fr;gap:5px;font-size:12px}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
th{background:${c1};color:#fff;padding:8px 11px;text-align:left;font-size:11px;font-weight:600;letter-spacing:.4px}
td{padding:8px 11px;border-bottom:1px solid #F3F4F6;font-size:12px}
tr:nth-child(even) td{background:#F9FAFB}
.tot{text-align:right;font-size:13px;line-height:1.8}
.tot-main{font-size:15px;font-weight:800;color:${c1}}
.foot{margin-top:36px;padding-top:14px;border-top:1px solid #E5E7EB;font-size:10px;color:#9CA3AF;text-align:center}
@media print{body{padding:18px}}
</style></head><body>

${_filigraneHtml(dv, ds)}

${headerHtml}

${(dv.client || dv.recup) ? `<div class="client-box">
  ${dv.client ? `<div><strong>Client :</strong> ${dv.client}</div>` : ''}
  ${dv.tel    ? `<div><strong>Tél :</strong> ${dv.tel}</div>` : ''}
  ${dv.email  ? `<div><strong>Email :</strong> ${dv.email}</div>` : ''}
  ${dv.type   ? `<div><strong>Événement :</strong> ${dv.type}</div>` : ''}
  ${dv.lieu   ? `<div style="grid-column:span 2"><strong>Lieu :</strong> ${dv.lieu}</div>` : ''}
  ${dv.recup  ? `<div><strong>Récupération :</strong> ${fmtDt(dv.recup)}</div>` : ''}
  ${dv.retour ? `<div><strong>Retour :</strong> ${fmtDt(dv.retour)}</div>` : ''}
</div>` : ''}

<table>
  <thead><tr>
    <th>Désignation</th>
    <th>Durée</th>
    <th style="text-align:center">Qté</th>
    <th style="text-align:right">P.U.</th>
    <th style="text-align:right">Total</th>
  </tr></thead>
  <tbody>
    ${lines.map(l => {
      const pBadge = l.dur === 'epicerie'   ? ' <span style="font-size:9px;background:#FEF3C7;color:#D97706;padding:1px 5px;border-radius:99px">Épicerie</span>'
                   : l.dur === 'service'    ? ' <span style="font-size:9px;background:#EFF6FF;color:#1D4ED8;padding:1px 5px;border-radius:99px">Service</span>'
                   : l.dur === 'protection' ? ' <span style="font-size:9px;background:#F5F3FF;color:#7C3AED;padding:1px 5px;border-radius:99px">Protection</span>'
                   : '';
      const imgTag = l._image ? `<img src="${l._image}" style="width:50px;height:35px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">` : '';
      const descTag = (l._protDesc || l._desc) ? `<br><span style="font-size:9px;color:#6B7280">${l._protDesc || l._desc}</span>` : '';
      const hasRem = l.remises && l.remises.length > 0;
      let remDiv = '';
      if (hasRem) {
        remDiv = '<div style="font-size:11px;color:#D97706;margin-top:2px">' +
          l.remises.map(r => {
            const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
            return `${r.nom} ${lab} : -${r.montant_deduit.toFixed(2)} €`;
          }).join('<br>') +
          `<br><span style="font-weight:600;color:#0F2744">Net HT : ${l.prixNet.toFixed(2)} €</span></div>`;
      }
      return `<tr>
      <td>${imgTag}${l.name}${pBadge}${descTag}${remDiv}</td>
      <td>${DL[l.dur] || l.dur}</td>
      <td style="text-align:center">${l.qty || 1}</td>
      <td style="text-align:right">${(l.pu || l.prix).toFixed(2)} €</td>
      <td style="text-align:right;font-weight:600">${l.prixNet.toFixed(2)} €</td>
    </tr>`}).join('')}
  </tbody>
</table>

<div class="tot">
  ${hasLineRemises ? `<div>Sous-total avant remises : ${sousTotalBrut.toFixed(2)} €</div>` : ''}
  ${dvRemises.length ? `
    <div style="margin-top:6px">Sous-total : ${sousTotal.toFixed(2)} €</div>
    ${dvRemises.map(r => {
      const label = r.type === 'pourcentage' ? '(-' + r.valeur + '%)' : '(-' + r.valeur.toFixed(2) + ' €)';
      return '<div style="color:#DC2626">Remise ' + r.nom + ' ' + label + ' : - ' + (r.montant_deduit || 0).toFixed(2) + ' €</div>';
    }).join('')}
  ` : ''}
  ${(() => {
    const tvaMap = calcTvaMap(lines.map(l => ({ ...l, prix: l.prixNet })), totalRemises, sousTotal);
    const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);
    if (totalTVA > 0) {
      const rows = Object.entries(tvaMap)
        .filter(([, v]) => v.montantTva > 0)
        .map(([taux, v]) => `<div>TVA ${(taux * 100).toFixed(1).replace('.0', '')}% : ${v.montantTva.toFixed(2)} €</div>`)
        .join('');
      return `<div style="margin-top:6px">Total HT : ${tot.toFixed(2)} €</div>${rows}<div class="tot-main">Total TTC : ${(tot + totalTVA).toFixed(2)} €</div>`;
    }
    return `<div style="margin-top:6px" class="tot-main">Total : ${tot.toFixed(2)} €</div>`;
  })()}
  ${ds.afficherCaution ? `<div style="color:#6B7280">Caution estimée : ${caut} €</div>` : ''}
</div>

${optLines.length ? `
<div style="margin-top:20px">
  <div style="font-size:12px;font-weight:700;color:${c1};border-bottom:2px dashed #D97706;padding-bottom:4px;margin-bottom:8px">OPTIONS PROPOSÉES <span style="font-weight:400;font-size:10px;color:#6B7280">(non incluses dans le total)</span></div>
  <table>
    <thead><tr>
      <th style="background:#D97706">Désignation</th>
      <th style="background:#D97706">Durée</th>
      <th style="background:#D97706;text-align:center">Qté</th>
      <th style="background:#D97706;text-align:right">P.U.</th>
      <th style="background:#D97706;text-align:right">Total</th>
    </tr></thead>
    <tbody>
      ${optLines.map(l => {
        const durL = DL[l.dur] || l.dur;
        const oImg = l._image ? `<img src="${l._image}" style="width:50px;height:35px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">` : '';
        const oDesc = (l._protDesc || l._desc) ? `<br><span style="font-size:9px;color:#6B7280">${l._protDesc || l._desc}</span>` : '';
        return `<tr>
          <td>${oImg}${l.name}${oDesc}</td>
          <td>${durL}</td>
          <td style="text-align:center">${l.qty || 1}</td>
          <td style="text-align:right">${(l.pu || l.prix).toFixed(2)} €</td>
          <td style="text-align:right;font-weight:600">${(l.prixNet != null ? l.prixNet : (l.prixTTC || l.prix)).toFixed(2)} €</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>
  <div style="font-size:10px;color:#6B7280;font-style:italic;margin-top:4px">Ces options peuvent être ajoutées sur simple demande.</div>
</div>
` : ''}

${dv.notes ? `<div style="margin-top:18px;background:#F9FAFB;padding:12px;border-radius:8px;font-size:12px"><strong>Notes :</strong> ${dv.notes}</div>` : ''}

${ds.afficherMentions && p.mentions ? `<div class="foot">${p.mentions}</div>` : ''}

<script>window.onload=()=>window.print();<\/script>
</body></html>`);
    w.document.close();
  }

  // ── Email (mailto) ────────────────────────────────────────
  function email(dv) {
    if (!dv) return;
    const p    = db.params || {};
    const isF  = dv.doctype === 'facture';
    const km   = dv.km || 0;
    const kmt  = p.km || 1.5;
    const allEmailLines = _enrichLines(_calcLines(dv.lines));
    const emailLines   = allEmailLines.filter(l => !l.optional);
    const emailOptLines = allEmailLines.filter(l => l.optional);
    const sousTotal = emailLines.reduce((s, l) => s + l.prixNet, 0);
    const dvRemises = dv.remises || [];
    const totalRemGlob = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot  = Math.max(0, sousTotal - totalRemGlob);
    const caut = emailLines.reduce((s, l) => s + (l.caut || 0), 0);

    let body = `${isF ? 'Facture' : 'Devis'} N° ${dv.num || ''}%0A`;
    body += `Émis le ${fmtDate(dv.date || today())}%0A%0A`;
    if (dv.client) body += `Client : ${dv.client}%0A`;
    if (dv.type)   body += `Événement : ${dv.type}%0A`;
    if (dv.lieu)   body += `Lieu : ${dv.lieu}%0A`;
    if (dv.recup)  body += `Récupération : ${fmtDt(dv.recup)}%0A`;
    if (dv.retour) body += `Retour : ${fmtDt(dv.retour)}%0A`;
    body += `%0ADÉTAIL :%0A`;
    emailLines.forEach(l => {
      body += `- ${l.name} (${DL[l.dur] || l.dur} ×${l.qty || 1}) : ${l.prix.toFixed(2)} €%0A`;
      if (l.remises?.length) {
        l.remises.forEach(r => {
          const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
          body += `  ${r.nom} ${lab} : -${r.montant_deduit.toFixed(2)} €%0A`;
        });
        body += `  Net HT : ${l.prixNet.toFixed(2)} €%0A`;
      }
    });
    if (dvRemises.length) {
      body += `%0A%0ASous-total : ${sousTotal.toFixed(2)} €`;
      dvRemises.forEach(r => {
        const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
        body += `%0ARemise ${r.nom} ${lab} : -${(r.montant_deduit || 0).toFixed(2)} €`;
      });
    }
    const emailTvaMap = calcTvaMap(emailLines.map(l => ({ ...l, prix: l.prixNet })), totalRemGlob, sousTotal);
    const emailTotalTVA = Object.values(emailTvaMap).reduce((s, v) => s + v.montantTva, 0);
    if (emailTotalTVA > 0) {
      body += `%0A%0ATotal HT : ${tot.toFixed(2)} €`;
      Object.entries(emailTvaMap).filter(([, v]) => v.montantTva > 0).forEach(([taux, v]) => {
        body += `%0ATVA ${(taux * 100).toFixed(1).replace('.0', '')}% : ${v.montantTva.toFixed(2)} €`;
      });
      body += `%0ATotal TTC : ${(tot + emailTotalTVA).toFixed(2)} €`;
    } else {
      body += `%0A%0ATOTAL : ${tot.toFixed(2)} €`;
    }
    body += `%0ACaution : ${caut} €`;
    if (emailOptLines.length) {
      body += `%0A%0AOPTIONS PROPOSÉES (non incluses dans le total) :%0A`;
      emailOptLines.forEach(l => {
        body += `- ${l.name} (${DL[l.dur] || l.dur} ×${l.qty || 1}) : ${l.prix.toFixed(2)} €%0A`;
      });
      body += `Ces options peuvent être ajoutées sur simple demande.`;
    }
    if (dv.notes) body += `%0A%0ANotes : ${dv.notes}`;
    if (p.mentions) body += `%0A%0A${p.mentions}`;
    body += `%0A%0A${p.nom || 'LocationForEvent'} · ${p.tel || ''} · ${p.site || ''}`;

    const subj = encodeURIComponent(`${isF ? 'Facture' : 'Devis'} ${dv.num || ''} — ${p.nom || 'LocationForEvent'}`);
    window.location.href = `mailto:${dv.email || ''}?subject=${subj}&body=${body}`;
  }

  // ── Téléchargement PDF (jsPDF) ─────────────────────────────
  function downloadPdf(dv) {
    if (!dv) return;
    if (typeof jspdf === 'undefined') { App.toast('Librairie jsPDF non chargée', 'err'); return; }

    const { jsPDF } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const p   = db.params || {};
    const ds  = _ds();
    const isF = dv.doctype === 'facture';
    const km  = dv.km || 0;
    const kmt = p.km || 1.5;
    const allPdfLines = _enrichLines(_calcLines(dv.lines));
    const pdfLines   = allPdfLines.filter(l => !l.optional);
    const pdfOptLines = allPdfLines.filter(l => l.optional);
    const sousTotal = pdfLines.reduce((s, l) => s + l.prixNet, 0);
    const sousTotalBrut = pdfLines.reduce((s, l) => s + l.prix, 0);
    const hasLineRemises = pdfLines.some(l => l.remises && l.remises.length > 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot = Math.max(0, sousTotal - totalRemises);
    const caut = pdfLines.reduce((s, l) => s + (l.caut || 0), 0);

    // Parse design colors to RGB
    function hexToRgb(hex) {
      const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
      return [r, g, b];
    }
    const c1rgb = hexToRgb(ds.couleurPrimaire);
    const c2rgb = isF ? [5, 150, 105] : hexToRgb(ds.couleurSecondaire);

    const W = 210, M = 18;
    let y = M;

    // ─ Filigrane ─
    if (ds.filigrane) {
      const labels = { brouillon:'BROUILLON', 'envoyé':'ENVOYÉ', 'à relancer':'À RELANCER', 'accepté':'ACCEPTÉ', 'refusé':'REFUSÉ', 'expiré':'EXPIRÉ' };
      const txt = labels[dv.statut] || 'BROUILLON';
      doc.saveGraphicsState();
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(50);
      doc.setFont(undefined, 'bold');
      const matrix = doc.Matrix(0.87, -0.5, 0.5, 0.87, 0, 0);
      doc.text(txt, 105, 160, { align: 'center', angle: 35 });
      doc.restoreGraphicsState();
    }

    // ─ Logo (if set) ─
    let logoW = 0, logoH = 0;
    if (ds.logo) {
      try {
        logoW = 30; logoH = 14;
        if (ds.disposition === 'A') {
          doc.addImage(ds.logo, 'AUTO', M, y - 4, logoW, logoH);
        } else if (ds.disposition === 'C') {
          doc.addImage(ds.logo, 'AUTO', (W - logoW) / 2, y - 4, logoW, logoH);
        } else {
          doc.addImage(ds.logo, 'AUTO', W - M - logoW, y - 4, logoW, logoH);
        }
      } catch (e) { console.warn('Logo error', e); logoW = 0; }
    }

    // ─ En-tête société ─
    const nameX = ds.disposition === 'C' ? W / 2 : (ds.disposition === 'A' && logoW ? M + logoW + 4 : M);
    const nameAlign = ds.disposition === 'C' ? { align: 'center' } : {};
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...c1rgb);
    doc.text(p.nom || 'LocationForEvent', nameX, y, nameAlign);
    y += 6;
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(107, 114, 128);
    if (p.adr)   { doc.text(p.adr, nameX, y, nameAlign); y += 4; }
    if (p.tel)   { doc.text(`${p.tel}${p.email ? ' · ' + p.email : ''}`, nameX, y, nameAlign); y += 4; }
    if (p.site)  { doc.text(p.site, nameX, y, nameAlign); y += 4; }
    if (ds.afficherSiret && p.siret) { doc.text('SIRET : ' + p.siret, nameX, y, nameAlign); y += 4; }

    // ─ Type de document ─
    const docTypeX = ds.disposition === 'C' ? W / 2 : W - M;
    const docTypeAlign = ds.disposition === 'C' ? { align: 'center' } : { align: 'right' };
    const docTypeY = ds.disposition === 'C' ? y + 2 : M;
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(...c2rgb);
    doc.text(isF ? 'FACTURE' : 'DEVIS', docTypeX, docTypeY, docTypeAlign);
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    doc.setFont(undefined, 'normal');
    doc.text(`N° ${dv.num || '—'}`, docTypeX, docTypeY + 6, docTypeAlign);
    doc.text(`Émis le ${fmtDate(dv.date || today())}`, docTypeX, docTypeY + 10, docTypeAlign);
    if (!isF && p.valid) doc.text(`Valable ${p.valid} jours`, docTypeX, docTypeY + 14, docTypeAlign);

    // ─ Ligne séparatrice ─
    if (ds.disposition === 'C') y = docTypeY + 18;
    else y = Math.max(y, M + 18) + 4;
    doc.setDrawColor(...c1rgb);
    doc.setLineWidth(0.6);
    doc.line(M, y, W - M, y);
    y += 8;

    // ─ Infos client ─
    doc.setFontSize(10);
    doc.setTextColor(17, 17, 17);
    const clientLines = [];
    if (dv.client) clientLines.push(`Client : ${dv.client}`);
    if (dv.tel)    clientLines.push(`Tél : ${dv.tel}`);
    if (dv.email)  clientLines.push(`Email : ${dv.email}`);
    if (dv.type)   clientLines.push(`Événement : ${dv.type}`);
    if (dv.lieu)   clientLines.push(`Lieu : ${dv.lieu}`);
    if (dv.recup)  clientLines.push(`Récupération : ${fmtDt(dv.recup)}`);
    if (dv.retour) clientLines.push(`Retour : ${fmtDt(dv.retour)}`);

    if (clientLines.length) {
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(M, y - 3, W - 2 * M, clientLines.length * 5 + 6, 2, 2, 'F');
      doc.setFontSize(9);
      clientLines.forEach(line => {
        doc.text(line, M + 4, y + 2);
        y += 5;
      });
      y += 6;
    }

    // ─ Tableau des lignes ─
    const colX   = [M, M + 80, M + 110, M + 135, W - M];

    // En-tête tableau
    doc.setFillColor(...c1rgb);
    doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('Désignation', M + 3, y + 5.5);
    doc.text('Durée', colX[1] + 2, y + 5.5);
    doc.text('Qté', colX[2] + 2, y + 5.5, { align: 'left' });
    doc.text('P.U.', colX[3] + 2, y + 5.5, { align: 'left' });
    doc.text('Total', W - M - 3, y + 5.5, { align: 'right' });
    y += 8;

    // Lignes
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    pdfLines.forEach((l, i) => {
      const descText = l._protDesc || l._desc || '';
      const descLines = descText ? doc.splitTextToSize(descText, colX[1] - M - 6) : [];
      const imgH = l._image ? 15 : 0;
      const descH = descLines.length * 3.5;
      const extraH = Math.max(imgH, descH);
      const baseH = 7 + (l.remises?.length ? (l.remises.length + 1) * 4 : 0) + (extraH > 0 ? extraH : 0);
      if (y + baseH > 270) { doc.addPage(); y = M; }
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(M, y, W - 2 * M, baseH, 'F');
      }
      doc.setTextColor(17, 17, 17);
      doc.setFontSize(9);
      const durLabel = l.dur === 'epicerie' ? 'Épicerie' : l.dur === 'service' ? 'Service' : l.dur === 'protection' ? 'Protection' : (DL[l.dur] || l.dur);
      const nameX = l._image ? M + 18 : M + 3;
      if (l._image) {
        try { doc.addImage(l._image, 'AUTO', M + 2, y + 1, 15, 15); } catch (e) { /* ignore */ }
      }
      const nameLines = doc.splitTextToSize(l.name, colX[1] - nameX - 2);
      doc.text(nameLines[0] || l.name, nameX, y + 5);
      doc.text(durLabel, colX[1] + 2, y + 5);
      doc.text(String(l.qty || 1), colX[2] + 2, y + 5);
      doc.text((l.pu || l.prix).toFixed(2) + ' €', colX[3] + 2, y + 5);
      const totalAff = (l.prixNet != null ? l.prixNet : (l.prixTTC || l.prix));
      doc.setFont(undefined, 'bold');
      doc.text(l.prixNet.toFixed(2) + ' €', W - M - 3, y + 5, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 7;
      if (descLines.length) {
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        doc.text(descLines, nameX, y + 2);
        y += descH;
        doc.setFontSize(9);
      }
      // Remises par ligne (orange sous le nom)
      if (l.remises?.length) {
        doc.setFontSize(8);
        l.remises.forEach(r => {
          if (y > 275) { doc.addPage(); y = M; }
          const lab = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
          doc.setTextColor(217, 119, 6);
          doc.text(`${r.nom} ${lab} : -${r.montant_deduit.toFixed(2)} €`, M + 8, y + 3);
          y += 4;
        });
        doc.setTextColor(15, 39, 68);
        doc.setFont(undefined, 'bold');
        doc.text('Net HT : ' + l.prixNet.toFixed(2) + ' €', M + 8, y + 3);
        doc.setFont(undefined, 'normal');
        y += 4;
        doc.setFontSize(9);
      }
    });

    // ─ Totaux ─
    y += 4;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    // Sous-total avant remises lignes
    if (hasLineRemises) {
      doc.text(`Sous-total avant remises : ${sousTotalBrut.toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
    }
    // Remises
    if (dvRemises.length) {
      doc.text(`Sous-total : ${sousTotal.toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      doc.setTextColor(220, 38, 38);
      dvRemises.forEach(r => {
        const label = r.type === 'pourcentage' ? `(-${r.valeur}%)` : `(-${r.valeur.toFixed(2)} €)`;
        doc.text(`${r.nom} ${label} : - ${(r.montant_deduit || 0).toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      });
      doc.setTextColor(107, 114, 128);
    }
    const tvaMap = calcTvaMap(pdfLines.map(l => ({ ...l, prix: l.prixNet })), totalRemises, sousTotal);
    const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);
    if (totalTVA > 0) {
      doc.setFontSize(10);
      doc.text(`Total HT : ${tot.toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      Object.entries(tvaMap).filter(([, v]) => v.montantTva > 0).forEach(([taux, v]) => {
        doc.text(`TVA ${(taux * 100).toFixed(1).replace('.0', '')}% : ${v.montantTva.toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      });
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...c1rgb);
      doc.text(`Total TTC : ${(tot + totalTVA).toFixed(2)} €`, W - M, y + 1, { align: 'right' });
    } else {
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...c1rgb);
      doc.text(`Total : ${tot.toFixed(2)} €`, W - M, y + 1, { align: 'right' });
    }
    y += 7;
    if (ds.afficherCaution) {
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`Caution estimée : ${caut} €`, W - M, y, { align: 'right' });
      y += 8;
    } else {
      y += 4;
    }

    // ─ Options proposées ─
    if (pdfOptLines.length) {
      if (y > 240) { doc.addPage(); y = M; }
      y += 4;
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(15, 39, 68);
      doc.text('OPTIONS PROPOSÉES', M, y + 5);
      doc.setFontSize(8);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text('(non incluses dans le total)', M + 52, y + 5);
      y += 10;

      // En-tête orange
      doc.setFillColor(217, 119, 6);
      doc.rect(M, y, W - 2 * M, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('Désignation', M + 3, y + 5.5);
      doc.text('Durée', colX[1] + 2, y + 5.5);
      doc.text('Qté', colX[2] + 2, y + 5.5);
      doc.text('P.U.', colX[3] + 2, y + 5.5);
      doc.text('Total', W - M - 3, y + 5.5, { align: 'right' });
      y += 8;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(9);
      pdfOptLines.forEach((l, i) => {
        if (y > 260) { doc.addPage(); y = M; }
        if (i % 2 === 1) {
          doc.setFillColor(255, 251, 235);
          doc.rect(M, y, W - 2 * M, 7, 'F');
        }
        doc.setTextColor(17, 17, 17);
        const durLabel = l.dur === 'epicerie' ? 'Épicerie' : l.dur === 'service' ? 'Service' : l.dur === 'protection' ? 'Protection' : (DL[l.dur] || l.dur);
        doc.text(l.name.substring(0, 38), M + 3, y + 5);
        doc.text(durLabel, colX[1] + 2, y + 5);
        doc.text(String(l.qty || 1), colX[2] + 2, y + 5);
        doc.text((l.pu || l.prix).toFixed(2) + ' €', colX[3] + 2, y + 5);
        doc.setFont(undefined, 'bold');
        doc.text((l.prixNet != null ? l.prixNet : (l.prixTTC || l.prix)).toFixed(2) + ' €', W - M - 3, y + 5, { align: 'right' });
        doc.setFont(undefined, 'normal');
        y += 7;
      });
      doc.setFontSize(7.5);
      doc.setTextColor(107, 114, 128);
      doc.text('Ces options peuvent être ajoutées sur simple demande.', M, y + 4);
      y += 10;
    }

    // ─ Notes ─
    if (dv.notes) {
      if (y > 255) { doc.addPage(); y = M; }
      doc.setFillColor(249, 250, 251);
      const noteLines = doc.splitTextToSize(`Notes : ${dv.notes}`, W - 2 * M - 8);
      doc.roundedRect(M, y, W - 2 * M, noteLines.length * 4.5 + 6, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
      doc.text(noteLines, M + 4, y + 5);
      y += noteLines.length * 4.5 + 10;
    }

    // ─ Mentions légales ─
    if (ds.afficherMentions && p.mentions) {
      if (y > 250) { doc.addPage(); y = M; }
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.3);
      doc.line(M, y, W - M, y);
      y += 5;
      doc.setFontSize(7);
      doc.setTextColor(156, 163, 175);
      const mentionLines = doc.splitTextToSize(p.mentions, W - 2 * M);
      doc.text(mentionLines, W / 2, y, { align: 'center' });
    }

    // ─ Sauvegarde ─
    const docType = isF ? 'Facture' : 'Devis';
    const cliName = (dv.client || 'Sans_client').replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ_ -]/g, '').replace(/\s+/g, '_');
    doc.save(`${docType}_${dv.num || 'X'}_${cliName}.pdf`);
    App.toast('PDF téléchargé ✅', 'ok');
  }

  // ── Contrat de location ───────────────────────────────────
  function printContrat(dv) {
    if (!dv) return;
    const p   = db.params || {};
    const ds  = _ds();
    const allContratLines = _enrichLines(_calcLines(dv.lines));
    const lines    = allContratLines.filter(l => !l.optional);
    const contratOptLines = allContratLines.filter(l => l.optional);
    const sousTotal = lines.reduce((s, l) => s + l.prixNet, 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot  = Math.max(0, sousTotal - totalRemises);
    const caut = lines.reduce((s, l) => s + (l.caut || 0), 0);
    const tvaMap = calcTvaMap(lines.map(l => ({ ...l, prix: l.prixNet })), totalRemises, sousTotal);
    const totalTVA = Object.values(tvaMap).reduce((s, v) => s + v.montantTva, 0);
    const totalTTC = tot + totalTVA;
    const c1 = ds.couleurPrimaire;
    const fontFam = _fontCss(ds.police);
    const ville = (p.adr || '').split(',').pop()?.trim() || '________';

    // Tableau matériel HTML
    const tableauHtml = `<table>
      <thead><tr>
        <th>Désignation</th>
        <th style="text-align:center">Durée</th>
        <th style="text-align:center">Qté</th>
        <th style="text-align:right">P.U. HT</th>
        <th style="text-align:right">Total HT</th>
      </tr></thead>
      <tbody>${lines.map(l => {
        const durLabel = l.dur === 'epicerie' ? 'Épicerie' : l.dur === 'service' ? 'Service' : l.dur === 'protection' ? 'Protection' : (DL[l.dur] || l.dur);
        const descText = l._protDesc || l._desc || '';
        const descSpan = descText ? `<br><span style="font-size:9px;color:#6B7280">${descText}</span>` : '';
        const imgTag = l._image ? `<img src="${l._image}" style="width:40px;height:30px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-right:6px">` : '';
        return `<tr>
          <td style="padding:6px 10px;border:1px solid #D1D5DB">${imgTag}${l.name}${descSpan}</td>
          <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:center">${durLabel}</td>
          <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:center">${l.qty || 1}</td>
          <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:right">${(l.pu || l.prix).toFixed(2)} €</td>
          <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:right;font-weight:600">${l.prixNet.toFixed(2)} €</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;

    // Tableau options HTML
    const optTableauHtml = contratOptLines.length ? `
    <div style="margin-top:14px">
      <div style="font-size:12px;font-weight:700;color:${c1};border-bottom:2px dashed #D97706;padding-bottom:4px;margin-bottom:8px">OPTIONS PROPOSÉES <span style="font-weight:400;font-size:10px;color:#6B7280">(non incluses dans le total)</span></div>
      <table>
        <thead><tr>
          <th style="background:#D97706">Désignation</th>
          <th style="background:#D97706;text-align:center">Durée</th>
          <th style="background:#D97706;text-align:center">Qté</th>
          <th style="background:#D97706;text-align:right">P.U. HT</th>
          <th style="background:#D97706;text-align:right">Total HT</th>
        </tr></thead>
        <tbody>${contratOptLines.map(l => {
          const durLabel = l.dur === 'epicerie' ? 'Épicerie' : l.dur === 'service' ? 'Service' : l.dur === 'protection' ? 'Protection' : (DL[l.dur] || l.dur);
          return `<tr>
            <td style="padding:6px 10px;border:1px solid #D1D5DB">${l.name}</td>
            <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:center">${durLabel}</td>
            <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:center">${l.qty || 1}</td>
            <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:right">${(l.pu || l.prix).toFixed(2)} €</td>
            <td style="padding:6px 10px;border:1px solid #D1D5DB;text-align:right;font-weight:600">${l.prixNet.toFixed(2)} €</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      <div style="font-size:10px;color:#6B7280;font-style:italic;margin-top:4px">Ces options peuvent être ajoutées sur simple demande.</div>
    </div>` : '';

    // TVA détail
    let tvaDetailStr = '';
    if (totalTVA > 0) {
      tvaDetailStr = Object.entries(tvaMap)
        .filter(([, v]) => v.montantTva > 0)
        .map(([taux, v]) => `TVA ${(taux * 100).toFixed(1).replace('.0', '')}% : ${v.montantTva.toFixed(2)} €`)
        .join('\n');
    }

    // Extraire date/heure depuis datetime-local
    const recupDate = dv.recup ? fmtDate(dv.recup.split('T')[0]) : '________';
    const recupHeure = dv.recup && dv.recup.includes('T') ? dv.recup.split('T')[1].substring(0,5) : '__:__';
    const retourDate = dv.retour ? fmtDate(dv.retour.split('T')[0]) : '________';
    const retourHeure = dv.retour && dv.retour.includes('T') ? dv.retour.split('T')[1].substring(0,5) : '__:__';

    // Charger le modèle
    const template = (typeof Contrats !== 'undefined') ? Contrats.getTemplate() : db.contrat_template || '';

    // Map des variables
    const vars = {
      '{LOUEUR_NOM}':      p.nom || '—',
      '{LOUEUR_ADRESSE}':  p.adr || '—',
      '{LOUEUR_TEL}':      p.tel || '—',
      '{LOUEUR_EMAIL}':    p.email || '—',
      '{LOUEUR_SIRET}':    p.siret ? 'SIRET : ' + p.siret : '',
      '{CLIENT_NOM}':      dv.client || '—',
      '{CLIENT_TEL}':      dv.tel || '—',
      '{CLIENT_EMAIL}':    dv.email || '—',
      '{NUM_CONTRAT}':     dv.num || '—',
      '{DATE_EMISSION}':   fmtDate(dv.date || today()),
      '{DATE_RECUP}':      recupDate,
      '{HEURE_RECUP}':     recupHeure,
      '{DATE_RETOUR}':     retourDate,
      '{HEURE_RETOUR}':    retourHeure,
      '{LIEU_EVENEMENT}':  dv.lieu || '—',
      '{TYPE_EVENEMENT}':  dv.type || '—',
      '{TABLEAU_MATERIEL}': '__TABLE__',
      '{SOUS_TOTAL_HT}':   'Sous-total HT : ' + sousTotal.toFixed(2) + ' €',
      '{TVA_DETAIL}':      tvaDetailStr || 'Pas de TVA applicable',
      '{TOTAL_TTC}':       'Total TTC : ' + totalTTC.toFixed(2) + ' €',
      '{CAUTION}':         caut + ' €',
      '{VILLE_LOUEUR}':    ville,
      '{DATE_SIGNATURE}':  fmtDate(today()),
    };

    let body = template;
    for (const [k, v] of Object.entries(vars)) {
      body = body.split(k).join(v);
    }

    // Convertir en HTML : remplacer le placeholder table, convertir bullets et sauts de ligne
    body = body.replace(/__TABLE__/g, tableauHtml + optTableauHtml);
    body = body.replace(/^• (.+)$/gm, '<li>$1</li>');
    body = body.replace(/(<li>.*<\/li>\n?)+/gs, m => '<ul>' + m + '</ul>');
    body = body.replace(/\n/g, '<br>');

    // Mentions légales contrat
    const mentions = db.contrat_mentions || '';

    const w = window.open('', '_blank');
    if (!w) { App.toast('Autorisez les popups', 'warn'); return; }

    w.document.write(`<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<title>Contrat ${dv.num || ''} — ${p.nom || 'LocationForEvent'}</title>
<style>
*{box-sizing:border-box}
body{font-family:${fontFam};font-size:12px;color:#111;margin:0;padding:30px 40px;line-height:1.6}
h1{font-size:18px;font-weight:800;text-align:center;color:${c1};margin:0;letter-spacing:.5px}
h2{font-size:11px;text-align:center;color:#6B7280;margin:2px 0 16px;font-weight:500;letter-spacing:.3px}
.sep{border-top:2px solid ${c1};margin:14px 0}
.contrat-body{font-size:12px;line-height:1.7}
table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}
th{background:${c1};color:#fff;padding:6px 10px;text-align:left;font-size:10px;font-weight:600;letter-spacing:.3px}
ul{margin:4px 0;padding-left:20px}
ul li{margin-bottom:2px}
.sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:10px}
.sig-box{text-align:center}
.sig-line{border-bottom:1px solid #111;height:50px;margin-top:8px}
.sig-note{font-size:10px;color:#6B7280;margin-top:6px}
.foot{text-align:center;font-size:10px;color:#9CA3AF;margin-top:20px;border-top:1px solid #E5E7EB;padding-top:10px}
@media print{body{padding:18px 30px}}
</style></head><body>

<div class="sep"></div>
<h1>CONTRAT DE LOCATION DE MATÉRIEL ÉVÉNEMENTIEL</h1>
<h2>N° ${dv.num || '—'} — ${fmtDate(dv.date || today())}</h2>
<div class="sep"></div>

<div class="contrat-body">
${body}
</div>

<div class="sep"></div>
<div style="text-align:center;font-size:11px;font-weight:600;color:${c1};margin-bottom:8px">SIGNATURES</div>
<div class="sep"></div>

<div style="text-align:center;font-size:11px;margin-bottom:14px">
  Fait en deux exemplaires originaux à ${ville}, le ${fmtDate(today())}
</div>

<div class="sig-grid">
  <div class="sig-box">
    <strong>LE LOUEUR</strong><br>
    ${p.nom || '—'}
    <div class="sig-line"></div>
    <div class="sig-note">Signature</div>
  </div>
  <div class="sig-box">
    <strong>LE LOCATAIRE</strong><br>
    ${dv.client || '—'}
    <div class="sig-line"></div>
    <div class="sig-note">Signature</div>
  </div>
</div>
<div style="text-align:center;font-size:10px;color:#6B7280;margin-top:10px">
  Précédée de la mention manuscrite "Lu et approuvé"
</div>

${mentions ? `<div class="foot">${mentions}</div>` : ''}
<div class="foot">${p.nom || 'LocationForEvent'}${p.tel ? ' · ' + p.tel : ''}${p.site ? ' · ' + p.site : ''}</div>

<script>window.onload=()=>window.print();<\/script>
</body></html>`);
    w.document.close();
  }

  return { dv, email, downloadPdf, printContrat };
})();
window.Print = Print;
