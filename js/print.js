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
  function dv(dv) {
    if (!dv) return;
    const p   = db.params || {};
    const ds  = _ds();
    const isF = dv.doctype === 'facture';
    const km  = dv.km || 0;
    const kmt = p.km || 1.5;
    const sousTotal = (dv.lines || []).reduce((s, l) => s + l.prix, 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot = Math.max(0, sousTotal - totalRemises);
    const caut = (dv.lines || []).reduce((s, l) => s + (l.caut || 0), 0);
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
    ${(dv.lines || []).map(l => {
      const pBadge = l.dur === 'epicerie' ? ' <span style="font-size:9px;background:#FEF3C7;color:#D97706;padding:1px 5px;border-radius:99px">Épicerie</span>'
                   : l.dur === 'service'  ? ' <span style="font-size:9px;background:#EFF6FF;color:#1D4ED8;padding:1px 5px;border-radius:99px">Service</span>'
                   : '';
      return `<tr>
      <td>${l.name}${pBadge}</td>
      <td>${DL[l.dur] || l.dur}</td>
      <td style="text-align:center">${l.qty || 1}</td>
      <td style="text-align:right">${(l.pu || l.prix).toFixed(2)} €</td>
      <td style="text-align:right;font-weight:600">${l.prix.toFixed(2)} €</td>
    </tr>`}).join('')}
  </tbody>
</table>

<div class="tot">
  ${km > 0 ? `<div>Livraison aller : ${(km * kmt).toFixed(2)} €</div>
              <div>Retour (si récup.) : ${(km * kmt).toFixed(2)} €</div>` : ''}
  ${dvRemises.length ? `
    <div style="margin-top:6px">Sous-total : ${sousTotal.toFixed(2)} €</div>
    ${dvRemises.map(r => {
      const label = r.type === 'pourcentage' ? '(-' + r.valeur + '%)' : '(-' + r.valeur.toFixed(2) + ' €)';
      return '<div style="color:#DC2626">Remise ' + r.nom + ' ' + label + ' : - ' + (r.montant_deduit || 0).toFixed(2) + ' €</div>';
    }).join('')}
  ` : ''}
  ${(db.params.tva || 0) > 0 ? `
    <div style="margin-top:6px">Total HT : ${tot.toFixed(2)} €</div>
    <div>TVA (${tvaLabel()}) : ${(tot * db.params.tva).toFixed(2)} €</div>
    <div class="tot-main">Total TTC : ${(tot * (1 + db.params.tva)).toFixed(2)} €</div>
  ` : `
    <div style="margin-top:6px" class="tot-main">Total : ${tot.toFixed(2)} €</div>
  `}
  ${ds.afficherCaution ? `<div style="color:#6B7280">Caution estimée : ${caut} €</div>` : ''}
</div>

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
    const tot  = (dv.lines || []).reduce((s, l) => s + l.prix, 0);
    const caut = (dv.lines || []).reduce((s, l) => s + (l.caut || 0), 0);

    let body = `${isF ? 'Facture' : 'Devis'} N° ${dv.num || ''}%0A`;
    body += `Émis le ${fmtDate(dv.date || today())}%0A%0A`;
    if (dv.client) body += `Client : ${dv.client}%0A`;
    if (dv.type)   body += `Événement : ${dv.type}%0A`;
    if (dv.lieu)   body += `Lieu : ${dv.lieu}%0A`;
    if (dv.recup)  body += `Récupération : ${fmtDt(dv.recup)}%0A`;
    if (dv.retour) body += `Retour : ${fmtDt(dv.retour)}%0A`;
    body += `%0ADÉTAIL :%0A`;
    (dv.lines || []).forEach(l => {
      body += `- ${l.name} (${DL[l.dur] || l.dur} ×${l.qty || 1}) : ${l.prix.toFixed(2)} €%0A`;
    });
    if (km > 0) body += `%0ALivraison aller : ${(km * kmt).toFixed(2)} €%0ARetour : ${(km * kmt).toFixed(2)} €`;
    body += `%0A%0ATOTAL : ${tot.toFixed(2)} €%0ACaution : ${caut} €`;
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
    const sousTotal = (dv.lines || []).reduce((s, l) => s + l.prix, 0);
    const dvRemises = dv.remises || [];
    const totalRemises = dvRemises.reduce((s, r) => s + (r.montant_deduit || 0), 0);
    const tot = Math.max(0, sousTotal - totalRemises);
    const caut = (dv.lines || []).reduce((s, l) => s + (l.caut || 0), 0);

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
    (dv.lines || []).forEach((l, i) => {
      if (y > 265) { doc.addPage(); y = M; }
      if (i % 2 === 1) {
        doc.setFillColor(249, 250, 251);
        doc.rect(M, y, W - 2 * M, 7, 'F');
      }
      doc.setTextColor(17, 17, 17);
      const durLabel = l.dur === 'epicerie' ? 'Épicerie' : l.dur === 'service' ? 'Service' : (DL[l.dur] || l.dur);
      doc.text(l.name.substring(0, 38), M + 3, y + 5);
      doc.text(durLabel, colX[1] + 2, y + 5);
      doc.text(String(l.qty || 1), colX[2] + 2, y + 5);
      doc.text((l.pu || l.prix).toFixed(2) + ' €', colX[3] + 2, y + 5);
      doc.setFont(undefined, 'bold');
      doc.text(l.prix.toFixed(2) + ' €', W - M - 3, y + 5, { align: 'right' });
      doc.setFont(undefined, 'normal');
      y += 7;
    });

    // ─ Totaux ─
    y += 4;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    if (km > 0) {
      doc.text(`Livraison aller : ${(km * kmt).toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      doc.text(`Retour (si récup.) : ${(km * kmt).toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
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
    const tvaRate = db.params.tva || 0;
    if (tvaRate > 0) {
      doc.setFontSize(10);
      doc.text(`Total HT : ${tot.toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      doc.text(`TVA (${tvaLabel()}) : ${(tot * tvaRate).toFixed(2)} €`, W - M, y, { align: 'right' }); y += 5;
      doc.setFontSize(13);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(...c1rgb);
      doc.text(`Total TTC : ${(tot * (1 + tvaRate)).toFixed(2)} €`, W - M, y + 1, { align: 'right' });
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

  return { dv, email, downloadPdf };
})();
window.Print = Print;
