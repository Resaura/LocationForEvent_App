// ═══════════════════════════════════════════════════════════════
// PWA.JS — Service Worker + Install prompt
// ═══════════════════════════════════════════════════════════════

const Pwa = (() => {
  let _installPrompt = null;

  // ── Enregistrement SW ─────────────────────────────────────
  function register() {
    if (!('serviceWorker' in navigator)) {
      _setStatus('Service Worker non supporté par ce navigateur.');
      return;
    }
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        _setStatus('✅ PWA installable — Service Worker actif.');
        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              App.toast('Mise à jour disponible — rechargez la page', 'warn');
            }
          });
        });
      })
      .catch(err => {
        console.error('SW registration failed:', err);
        _setStatus('⚠️ Service Worker non enregistré.');
      });
  }

  // ── Bouton d'installation ─────────────────────────────────
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _installPrompt = e;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = '';
    _setStatus('📲 Cette app peut être installée sur votre appareil.');
  });

  window.addEventListener('appinstalled', () => {
    _installPrompt = null;
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.style.display = 'none';
    _setStatus('✅ Application installée avec succès !');
    App.toast('Application installée ✅', 'ok');
  });

  async function install() {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === 'accepted') _installPrompt = null;
  }

  function _setStatus(msg) {
    const el = document.getElementById('pwa-status');
    if (el) el.textContent = msg;
  }

  return { register, install };
})();
