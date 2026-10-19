/**
 * LES PETITES FORÊTS - PWA COLLECTE TERRAIN (JAVASCRIPT VANILLA)
 * Traçabilité Végétal Local (VL) & Matériel Forestier de Reproduction (MFR)
 * Stockage LocalStorage 100% Hors-Ligne & Géocodage Inversé API Gouv
 */

const STORAGE_KEY = 'semeur_harvest_sessions_v1';

// État global de l'application
const state = {
  sessionId: '',
  dateStr: '',
  timeStr: '',
  gps: {
    lat: null,
    lng: null,
    acc: null,
    alt: null,
    status: 'idle',
    error: '',
    commune: null,
  },
  currentObjective: 'VL',
  lastSavedPayload: null,
  viewingSession: null,
};

// ==========================================================================
// 1. INITIALISATION & GESTION DE SESSION
// ==========================================================================

function initApp() {
  initNewSession();
  bindEvents();
  updateNetworkStatus();
  updateSessionsCountBadge();
}

function generateSessionId() {
  const d = new Date();
  const ymd = d.toISOString().split('T')[0].replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REC-${ymd}-${rand}`;
}

function initNewSession() {
  const now = new Date();
  state.sessionId = generateSessionId();
  state.dateStr = now.toISOString().split('T')[0];
  state.timeStr = now.toTimeString().substring(0, 5);

  const displayDate = document.getElementById('display-date');
  const displayTime = document.getElementById('display-time');
  if (displayDate) displayDate.textContent = state.dateStr;
  if (displayTime) displayTime.textContent = state.timeStr;

  const lieuDitInput = document.getElementById('input-lieudit');
  if (lieuDitInput) {
    lieuDitInput.value = '';
    delete lieuDitInput.dataset.autoFilled;
  }

  const lieuDitHint = document.getElementById('lieudit-hint');
  if (lieuDitHint) {
    lieuDitHint.style.display = 'none';
    lieuDitHint.textContent = '';
  }

  const altInput = document.getElementById('input-altitude');
  if (altInput) altInput.value = '';

  const quantiteInput = document.getElementById('input-quantite');
  if (quantiteInput) quantiteInput.value = '';

  const poidsInput = document.getElementById('input-poids-g');
  if (poidsInput) poidsInput.value = '';

  const selectEunis = document.getElementById('select-eunis');
  if (selectEunis) selectEunis.value = 'Forêts';

  const chk25 = document.getElementById('chk-25');
  if (chk25) chk25.checked = true;

  const inputPeuplement = document.getElementById('input-peuplement');
  if (inputPeuplement) inputPeuplement.value = 'FR-NOR-01';

  const selectMateriel = document.getElementById('select-materiel-type');
  if (selectMateriel) selectMateriel.value = 'Graines';

  const hiddenMateriel = document.getElementById('input-materiel-type');
  if (hiddenMateriel) hiddenMateriel.value = 'Graines';

  document.querySelectorAll('.chip-materiel').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-value') === 'Graines');
  });

  updateDynamicQuantite('Graines');
  setIndividusCount(1);
  hideSuccessBanner();
  hideErrorBanner();
  acquireGpsLocation();
}

// ==========================================================================
// 2. GÉOLOCALISATION GPS & GÉOCODAGE INVERSÉ API GOUV
// ==========================================================================

function acquireGpsLocation() {
  const badge = document.getElementById('gps-status-badge');
  const msgEl = document.getElementById('gps-msg');

  if (!navigator.geolocation) {
    state.gps.status = 'error';
    state.gps.error = 'Géolocalisation non supportée par ce terminal.';
    if (badge) {
      badge.className = 'badge-gps badge-gps-err';
      badge.textContent = 'GPS non supporté';
    }
    if (msgEl) {
      msgEl.textContent = state.gps.error;
      msgEl.style.display = 'block';
    }
    return;
  }

  state.gps.status = 'acquiring';
  if (badge) {
    badge.className = 'badge-gps badge-gps-acquiring';
    badge.textContent = 'Recherche satellite...';
  }
  if (msgEl) msgEl.style.display = 'none';

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      state.gps.lat = pos.coords.latitude;
      state.gps.lng = pos.coords.longitude;
      state.gps.acc = pos.coords.accuracy;
      state.gps.alt = pos.coords.altitude;
      state.gps.status = 'acquired';

      renderGpsDisplay();

      if (pos.coords.altitude !== null) {
        const altBtn = document.getElementById('btn-use-gps-alt');
        const gpsAltVal = document.getElementById('gps-alt-val');
        if (gpsAltVal) gpsAltVal.textContent = Math.round(pos.coords.altitude);
        if (altBtn) altBtn.style.display = 'inline-block';
      }

      reverseGeocode(state.gps.lat, state.gps.lng);
    },
    (err) => {
      state.gps.status = err.code === 1 ? 'denied' : 'error';
      state.gps.error = err.code === 1
        ? 'Autorisation GPS refusée dans le navigateur.'
        : 'Signal satellite trop faible ou indisponible.';

      if (badge) {
        badge.className = 'badge-gps badge-gps-err';
        badge.textContent = 'GPS indisponible';
      }
      if (msgEl) {
        msgEl.textContent = state.gps.error + ' Utilisez le bouton « Coordonnées test » si nécessaire.';
        msgEl.style.display = 'block';
      }

      const lieuDitHint = document.getElementById('lieudit-hint');
      const lieuDitInput = document
