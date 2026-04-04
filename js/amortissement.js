// ═══════════════════════════════════════════════════════════════
// AMORTISSEMENT.JS — Table d'amortissement éditable
// ═══════════════════════════════════════════════════════════════

const Amortissement = (() => {

  // ── Rendu ─────────────────────────────────────────────────
  function render() {
    const tbody = document.getElementById('amort-tbody');
    if (!tbody) return;

    if (!db.amort?.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-sm" style="text-align:center;padding:20px">Aucune règle chargée</td></tr>';
      return;
    }

    tbody.innerHTML = db.amort.map((r, i) => `
      <tr class="${i % 2 === 0 ? '' : ''}">
        <td style="font-weight:600;white-space:nowrap">${r.label}</td>
        <td><input type="number" value="${r.j}" min="1" step="1"
          onchange="db.amort[${i}].j = Math.max(1, parseFloat(this.value) || ${r.j})"></td>
        <td><input type="number" value="${r.c.weekend}" step="0.05" min="0"
          onchange="db.amort[${i}].c.weekend = parseFloat(this.value) || 0"></td>
        <td><input type="number" value="${r.c.semaine}" step="0.05" min="0"
          onchange="db.amort[${i}].c.semaine = parseFloat(this.value) || 0"></td>
        <td><input type="number" value="${r.c['2s']}" step="0.05" min="0"
          onchange="db.amort[${i}].c['2s'] = parseFloat(this.value) || 0"></td>
        <td><input type="number" value="${r.c['3s']}" step="0.05" min="0"
          onchange="db.amort[${i}].c['3s'] = parseFloat(this.value) || 0"></td>
        <td><input type="number" value="${r.c.mois}" step="0.05" min="0"
          onchange="db.amort[${i}].c.mois = parseFloat(this.value) || 0"></td>
        <td><input type="number" value="${Math.round(r.caut * 100)}" step="5" min="0" max="100"
          onchange="db.amort[${i}].caut = (parseFloat(this.value) || 0) / 100">
          <span style="font-size:.7rem;color:var(--grey)">%</span></td>
      </tr>`).join('');
  }

  // ── Sauvegarder ───────────────────────────────────────────
  async function save() {
    try {
      await sbSaveAmort(db.amort);
      App.toast('Amortissement sauvegardé ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  // ── Réinitialiser aux valeurs par défaut ──────────────────
  async function reset() {
    if (!confirm('Réinitialiser la table aux valeurs par défaut ?')) return;
    db.amort = JSON.parse(JSON.stringify(DA_DEFAULT));
    try {
      await sbSaveAmort(db.amort);
      render();
      App.toast('Table réinitialisée ✅', 'ok');
    } catch (err) {
      console.error(err);
      App.toast('Erreur de sauvegarde', 'err');
    }
  }

  return { render, save, reset };
})();
window.Amortissement = Amortissement;
