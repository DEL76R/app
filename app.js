/**
 * LES PETITES FORÊTS - PWA COLLECTE TERRAIN
 * Stockage LocalStorage 100% Hors-Ligne & Géocodage
 */

const STORAGE_KEY = 'semeur_harvest_sessions_v1';

const state = {
  sessionId: '',
  dateStr: '',
  displayDateStr: '', // Format JJ/MM/AAAA
  timeStr: '',
  gps: { lat: null, lng: null, acc: null, alt: null, status: 'idle', error: '', commune: null },
  currentObjective: 'VL',
  lastSavedPayload: null,
  viewingSession: null,
};

// ==========================================================================
// 1. INITIALISATION & GESTION DE SESSION
// ==========================================================================

function initApp() {
  window.initNewSession();
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

window.initNewSession = function() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  state.sessionId = generateSessionId();
  state.dateStr = `${yyyy}-${mm}-${dd}`;
  state.displayDateStr = `${dd}/${mm}/${yyyy}`;
  state.timeStr = now.toTimeString().substring(0, 5);

  const displayDate = document.getElementById('display-date');
  const displayTime = document.getElementById('display-time');
  if (displayDate) displayDate.textContent = state.displayDateStr;
  if (displayTime) displayTime.textContent = state.timeStr;

  const lieuDitInput = document.getElementById('input-lieudit');
  if (lieuDitInput) { lieuDitInput.value = ''; delete lieuDitInput.dataset.autoFilled; }

  const lieuDitHint = document.getElementById('lieudit-hint');
  if (lieuDitHint) { lieuDitHint.style.display = 'none'; lieuDitHint.textContent = ''; }

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
  window.hideSuccessBanner();
  hideErrorBanner();
  
  currentPhotoData = null;
  currentPhotoCoords = null;
  const photoPreview = document.getElementById('photo-preview');
  const photoContainer = document.getElementById('photo-preview-container');
  const photoInput = document.getElementById('station-photo');
  if (photoPreview) photoPreview.src = '';
  if (photoContainer) photoContainer.style.display = 'none';
  if (photoInput) photoInput.value = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });

  acquireGpsLocation();
};

// ==========================================================================
// 2. GÉOLOCALISATION GPS
// ==========================================================================

function acquireGpsLocation() {
  const badge = document.getElementById('gps-status-badge');
  const msgEl = document.getElementById('gps-msg');

  if (!navigator.geolocation) {
    state.gps.status = 'error';
    state.gps.error = 'Géolocalisation non supportée.';
    if (badge) { badge.className = 'badge-gps badge-gps-err'; badge.textContent = 'GPS non supporté'; }
    if (msgEl) { msgEl.textContent = state.gps.error; msgEl.style.display = 'block'; }
    return;
  }

  state.gps.status = 'acquiring';
  if (badge) { badge.className = 'badge-gps badge-gps-acquiring'; badge.textContent = 'Recherche satellite...'; }
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
      state.gps.status = 'error';
      state.gps.error = 'Signal GPS trop faible. Utilisez "Coordonnées test".';
      if (badge) { badge.className = 'badge-gps badge-gps-err'; badge.textContent = 'GPS indisponible'; }
      if (msgEl) { msgEl.textContent = state.gps.error; msgEl.style.display = 'block'; }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

function simulateGpsLocation() {
  state.gps.lat = 46.652145 + (Math.random() - 0.5) * 0.005;
  state.gps.lng = 2.711832 + (Math.random() - 0.5) * 0.005;
  state.gps.acc = 4.5;
  state.gps.alt = 255;
  state.gps.status = 'acquired';
  
  const gpsMsg = document.getElementById('gps-msg');
  if (gpsMsg) gpsMsg.style.display = 'none';
  renderGpsDisplay();
  
  const altBtn = document.getElementById('btn-use-gps-alt');
  const gpsAltVal = document.getElementById('gps-alt-val');
  if (gpsAltVal) gpsAltVal.textContent = '255';
  if (altBtn) altBtn.style.display = 'inline-block';
  
  const altInput = document.getElementById('input-altitude');
  if (altInput && !altInput.value) altInput.value = '255';
  
  reverseGeocode(state.gps.lat, state.gps.lng);
}

function renderGpsDisplay() {
  const badge = document.getElementById('gps-status-badge');
  if (badge) { badge.className = 'badge-gps badge-gps-ok'; badge.textContent = 'Signal GPS fixé ✓'; }
  const latEl = document.getElementById('display-lat');
  const lngEl = document.getElementById('display-lng');
  const accEl = document.getElementById('display-acc');
  const altGpsEl = document.getElementById('display-alt-gps');
  if (latEl) latEl.textContent = state.gps.lat ? state.gps.lat.toFixed(6) + '° N' : '-';
  if (lngEl) lngEl.textContent = state.gps.lng ? state.gps.lng.toFixed(6) + '° E' : '-';
  if (accEl) accEl.textContent = state.gps.acc ? `± ${Math.round(state.gps.acc)} m` : 'N/A';
  if (altGpsEl) altGpsEl.textContent = state.gps.alt ? `${Math.round(state.gps.alt)} m` : 'Non fourni';
}

async function reverseGeocode(lat, lng) {
  const lieuDitInput = document.getElementById('input-lieudit');
  const lieuDitHint = document.getElementById('lieudit-hint');
  if (!lat || !lng || !navigator.onLine) return;

  try {
    const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lng}&fields=nom`;
    const response = await fetch(url);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].nom) {
      const communeNom = data[0].nom;
      state.gps.commune = communeNom;
      if (lieuDitInput && (!lieuDitInput.value.trim() || lieuDitInput.dataset.autoFilled === 'true')) {
        lieuDitInput.value = communeNom;
        lieuDitInput.dataset.autoFilled = 'true';
      }
      if (lieuDitHint) {
        lieuDitHint.className = 'field-hint text-green';
        lieuDitHint.textContent = `📍 Commune détectée via GPS : ${communeNom}`;
        lieuDitHint.style.display = 'block';
      }
    }
  } catch (err) {
    state.gps.commune = null;
  }
}

// ==========================================================================
// 3. LOGIQUE CONDITIONNELLE ESPÈCES & MFR INTELLIGENT
// ==========================================================================

function onSpeciesChanged(selectElement) {
  const selectedOption = selectElement.options[selectElement.selectedIndex];
  const regime = selectedOption ? selectedOption.getAttribute('data-regime') : 'both';

  const cardMfr = document.getElementById('card-reg-mfr');
  const cardBoth = document.getElementById('card-reg-both');
  const lockedBadge = document.getElementById('badge-locked-vl');
  const noticeVl = document.getElementById('notice-vl-only');

  if (regime === 'vl') {
    setRegulatoryObjective('VL');
    if (cardMfr) cardMfr.classList.add('disabled');
    if (cardBoth) cardBoth.classList.add('disabled');
    if (lockedBadge) lockedBadge.style.display = 'inline-block';
    if (noticeVl) noticeVl.style.display = 'block';
  } else {
    setRegulatoryObjective('BOTH');
    if (cardMfr) cardMfr.classList.remove('disabled');
    if (cardBoth) cardBoth.classList.remove('disabled');
    if (lockedBadge) lockedBadge.style.display = 'none';
    if (noticeVl) noticeVl.style.display = 'none';
    
    // On passe directement l'option sélectionnée pour lire sa catégorie MFR
    autoSelectMfrCategory(selectedOption);
  }
}

function autoSelectMfrCategory(selectedOption) {
  if (!selectedOption) return;
  
  // Lit l'attribut dans le HTML, ou met "Identifiée" par défaut si non trouvé
  const defaultCategory = selectedOption.getAttribute('data-mfr-cat') || 'Identifiée';
  
  document.querySelectorAll('#mfr-category-group .mfr-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-value') === defaultCategory);
  });
  
  const hiddenMfrCat = document.getElementById('input-mfr-cat');
  if (hiddenMfrCat) hiddenMfrCat.value = defaultCategory;
  
  const selectedMfrText = document.getElementById('selected-mfr-text');
  if (selectedMfrText) selectedMfrText.textContent = 'Sélectionné : ' + defaultCategory;
}

function setRegulatoryObjective(objective) {
  state.currentObjective = objective;
  document.querySelectorAll('.radio-card').forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      radio.checked = (radio.value === objective);
      card.classList.toggle('active', radio.checked);
    }
  });
  refreshConditionalSections();
}

function refreshConditionalSections() {
  const selectElement = document.getElementById('species-select');
  const selectedOption = selectElement ? selectElement.options[selectElement.selectedIndex] : null;
  const regime = selectedOption ? selectedOption.getAttribute('data-regime') : 'both';
  const effectiveObjective = (regime === 'vl') ? 'VL' : state.currentObjective;

  const showVL = effectiveObjective === 'VL' || effectiveObjective === 'BOTH';
  const showMFR = effectiveObjective === 'MFR' || effectiveObjective === 'BOTH';

  const sectionVl = document.getElementById('section-vl');
  const sectionMfr = document.getElementById('section-mfr');
  if (sectionVl) sectionVl.style.display = showVL ? 'block' : 'none';
  if (sectionMfr) sectionMfr.style.display = showMFR ? 'block' : 'none';
}

// ==========================================================================
// 4. MODULE PHOTO GÉOLOCALISÉE
// ==========================================================================

let currentPhotoData = null;
let currentPhotoCoords = null;

function handlePhotoCapture(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    currentPhotoData = e.target.result;
    const preview = document.getElementById('photo-preview');
    const container = document.getElementById('photo-preview-container');
    const gpsInfo = document.getElementById('photo-gps-info');
    
    if (preview) preview.src = currentPhotoData;
    if (container) container.style.display = 'block';

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude.toFixed(6);
          const lon = position.coords.longitude.toFixed(6);
          if (gpsInfo) gpsInfo.innerHTML = `📍 GPS attaché : Lat ${lat}, Lon ${lon}`;
          currentPhotoCoords = { latitude: lat, longitude: lon };
        },
        () => {
          if (gpsInfo) gpsInfo.innerHTML = `⚠️ Photo chargée sans GPS`;
          currentPhotoCoords = null;
        },
        { enableHighAccuracy: true }
      );
    }
  };
  reader.readAsDataURL(file);
}

// ==========================================================================
// 5. QUANTITÉ DYNAMIQUE ET INDIVIDUS
// ==========================================================================

function updateDynamicQuantite(materielType) {
  const inputQuantite = document.getElementById('input-quantite');
  const labelQuantite = document.getElementById('label-quantite');
  if (materielType === 'Boutures') {
    if (labelQuantite) labelQuantite.textContent = 'Nombre de boutures';
    if (inputQuantite) inputQuantite.placeholder = 'Nombre de boutures (Optionnel)';
  } else if (materielType === 'Plantes entières') {
    if (labelQuantite) labelQuantite.textContent = 'Nombre de plantes entières';
    if (inputQuantite) inputQuantite.placeholder = 'Nombre de plantes entières (Optionnel)';
  } else {
    if (labelQuantite) labelQuantite.textContent = 'Quantité récoltée';
    if (inputQuantite) inputQuantite.placeholder = 'Quantité de graines (Optionnel)';
  }
}

function setIndividusCount(val) {
  const count = Math.max(1, parseInt(val, 10) || 1);
  const inputInd = document.getElementById('input-individus');
  const valInd = document.getElementById('val-individus');
  if (inputInd) inputInd.value = count;
  if (valInd) valInd.textContent = count;
  
  const badge = document.getElementById('badge-seuil');
  if (badge) {
    if (count >= 30) {
      badge.className = 'badge-threshold valid';
      badge.textContent = '✓ Seuil validé (≥ 30)';
    } else {
      badge.className = 'badge-threshold invalid';
      badge.textContent = '⚠️ Seuil incomplet (< 30 requis)';
    }
  }
}

// ==========================================================================
// 6. SAUVEGARDE JSON EXHAUSTIVE & LOCAL STORAGE
// ==========================================================================

function validateAndSaveSession() {
  hideErrorBanner();
  window.hideSuccessBanner();

  const errors = [];
  const speciesSelect = document.getElementById('species-select');
  const species = speciesSelect ? speciesSelect.value : '';
  const lieuDit = document.getElementById('input-lieudit').value.trim();
  const altitudeStr = document.getElementById('input-altitude').value.trim();
  const materielType = document.getElementById('input-materiel-type').value;

  const quantiteInput = document.getElementById('input-quantite');
  const quantiteStr = quantiteInput ? quantiteInput.value.trim() : '';
  const quantiteVal = quantiteStr !== '' ? Number(quantiteStr) : null;

  const poidsInput = document.getElementById('input-poids-g');
  const poidsStr = poidsInput ? poidsInput.value.trim() : '';
  const poidsVal = poidsStr !== '' ? Number(poidsStr) : null;
  
  if (!species) errors.push("L'espèce ciblée est obligatoire.");
  if (!lieuDit) errors.push('Le champ Commune / Lieu-dit de récolte est obligatoire.');
  if (!altitudeStr || isNaN(Number(altitudeStr))) errors.push("L'altitude en mètres est obligatoire.");

  const isCornus = species.includes('Cornus sanguinea');
  const effectiveObjective = isCornus ? 'VL' : state.currentObjective;
  const isVLActive = effectiveObjective === 'VL' || effectiveObjective === 'BOTH';
  const isMFRActive = effectiveObjective === 'MFR' || effectiveObjective === 'BOTH';

  let eunisHabitat = '';
  let ph = '';
  let humidite = '';
  let nbIndividus = 0;
  let prelevement25 = false;

  if (isVLActive) {
    eunisHabitat = document.getElementById('select-eunis').value;
    ph = document.getElementById('input-ph').value;
    humidite = document.getElementById('input-humidity').value;
    nbIndividus = parseInt(document.getElementById('input-individus').value, 10) || 0;
    prelevement25 = document.getElementById('chk-25').checked;

    if (!eunisHabitat) errors.push("Le type d'habitat EUNIS (milieu de collecte) est obligatoire pour Végétal Local.");
    if (!ph) errors.push('Le pH du sol estimé est requis pour Végétal Local.');
    if (!humidite) errors.push("L'humidité du sol est requise pour Végétal Local.");
    if (nbIndividus < 1) errors.push("Le nombre d'individus collectés doit être au moins de 1.");
    if (!prelevement25) errors.push('Vous devez certifier ne pas avoir prélevé plus de 25% de la ressource (Charte Végétal Local).');
  }

  let categorieMFR = '';
  let codePeuplement = '';

  if (isMFRActive) {
    categorieMFR = document.getElementById('input-mfr-cat').value;
    codePeuplement = document.getElementById('input-peuplement').value.trim();

    if (!categorieMFR) errors.push('La catégorie MFR est obligatoire.');
    if (!codePeuplement) errors.push('Le code du peuplement de base est obligatoire (ex: FR-XX-YY).');
  }

  if (errors.length > 0) {
    showErrorBanner(errors);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const labelQuantiteEl = document.getElementById('label-quantite');

  const payload = {
    schemaVersion: '1.2.0',
    sessionId: state.sessionId,
    timestamp: `${state.dateStr}T${state.timeStr}:00`,
    collectedAt: {
      date: state.displayDateStr,
      time: state.timeStr,
      iso: new Date().toISOString()
    },
    geolocation: {
      latitude: state.gps.lat,
      longitude: state.gps.lng,
      accuracyMeters: state.gps.acc,
      altitudeGps: state.gps.alt,
      status: state.gps.status,
      commune: state.gps.commune || lieuDit,
    },
    species: {
      label: species,
      scientificName: species.split('(')[0].trim(),
    },
    regulation: {
      selectedObjective: effectiveObjective,
      appliedRegulations: [
        ...(isVLActive ? ['Végétal Local (VL)'] : []),
        ...(isMFRActive ? ['Matériel Forestier de Reproduction (MFR)'] : []),
      ],
    },
    quantite: quantiteVal,
    poids_g: poidsVal,
    troncCommun: {
      communeLieuDit: lieuDit,
      altitudeMeters: Number(altitudeStr),
      materielType: materielType,
      quantite: quantiteVal,
      quantiteLibelle: labelQuantiteEl ? labelQuantiteEl.textContent : 'Quantité récoltée',
      poids_g: poidsVal,
    },
    vegetalLocal: isVLActive ? {
      eunisHabitat: eunisHabitat,
      conditionsEcologiques: {
        ph: ph,
        humidite: humidite,
      },
      nbIndividusCollectes: nbIndividus,
      confirmation25PourcentMax: prelevement25,
    } : null,
    mfr: isMFRActive ? {
      categorieMFR: categorieMFR,
      codePeuplementBase: codePeuplement.toUpperCase(),
    } : null,
    photoStation: {
      image: currentPhotoData || null,
      coordonnees: currentPhotoCoords || null,
      dateCapture: new Date().toISOString()
    },
    sync: {
      status: 'pending',
      savedLocallyAt: new Date().toISOString(),
    }
  };

  saveSessionToLocalStorage(payload);
  state.lastSavedPayload = payload;
  showSuccessBanner(state.sessionId);
  updateSessionsCountBadge();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getStoredSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveSessionToLocalStorage(payload) {
  const sessions = getStoredSessions();
  sessions.unshift(payload);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ==========================================================================
// 7. ÉVÉNEMENTS DU DOM
// ==========================================================================

function bindEvents() {
  // Délégation globale pour les clics du bandeau de succès
  document.body.addEventListener('click', (e) => {
    if (e.target.id === 'btn-dismiss-alert') {
      window.hideSuccessBanner();
    }
    if (e.target.id === 'btn-alert-new' || e.target.id === 'btn-new-session') {
      window.initNewSession();
    }
  });

  const photoInput = document.getElementById('station-photo');
  if (photoInput) photoInput.addEventListener('change', handlePhotoCapture);

  const speciesSelect = document.getElementById('species-select');
  if (speciesSelect) {
    speciesSelect.addEventListener('change', (e) => onSpeciesChanged(e.target));
  }

  document.querySelectorAll('input[name="regulatoryObjective"]').forEach(radio => {
    radio.addEventListener('change', (e) => setRegulatoryObjective(e.target.value));
  });

  const btnRefreshGps = document.getElementById('btn-refresh-gps');
  if (btnRefreshGps) btnRefreshGps.addEventListener('click', acquireGpsLocation);

  const btnSimulateGps = document.getElementById('btn-simulate-gps');
  if (btnSimulateGps) btnSimulateGps.addEventListener('click', simulateGpsLocation);

  const selectMateriel = document.getElementById('select-materiel-type');
  if (selectMateriel) {
    selectMateriel.addEventListener('change', (e) => {
      document.getElementById('input-materiel-type').value = e.target.value;
      document.querySelectorAll('.chip-materiel').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-value') === e.target.value);
      });
      updateDynamicQuantite(e.target.value);
    });
  }

  document.querySelectorAll('.chip-materiel').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value');
      if (selectMateriel) { selectMateriel.value = val; selectMateriel.dispatchEvent(new Event('change')); }
    });
  });

  document.querySelectorAll('#ph-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ph-group .btn-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('input-ph').value = btn.getAttribute('data-value');
      document.getElementById('selected-ph-text').textContent = 'Sélectionné : ' + btn.getAttribute('data-value');
    });
  });

  document.querySelectorAll('#humidity-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#humidity-group .btn-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('input-humidity').value = btn.getAttribute('data-value');
      document.getElementById('selected-hum-text').textContent = 'Sélectionné : ' + btn.getAttribute('data-value');
    });
  });

  const btnMinus = document.getElementById('btn-minus-ind');
  if (btnMinus) btnMinus.addEventListener('click', () => setIndividusCount((parseInt(document.getElementById('input-individus').value) || 1) - 1));
  
  const btnPlus = document.getElementById('btn-plus-ind');
  if (btnPlus) btnPlus.addEventListener('click', () => setIndividusCount((parseInt(document.getElementById('input-individus').value) || 1) + 1));
  
  const btnAdd5 = document.getElementById('btn-add-5');
  if (btnAdd5) btnAdd5.addEventListener('click', () => setIndividusCount((parseInt(document.getElementById('input-individus').value) || 0) + 5));
  
  const btnAdd10 = document.getElementById('btn-add-10');
  if (btnAdd10) btnAdd10.addEventListener('click', () => setIndividusCount((parseInt(document.getElementById('input-individus').value) || 0) + 10));
  
  const btnSet30 = document.getElementById('btn-set-30');
  if (btnSet30) btnSet30.addEventListener('click', () => setIndividusCount(30));

  document.querySelectorAll('#mfr-category-group .mfr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mfr-category-group .mfr-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('input-mfr-cat').value = btn.getAttribute('data-value');
      document.getElementById('selected-mfr-text').textContent = 'Sélectionné : ' + btn.getAttribute('data-value');
    });
  });

  const btnSave = document.getElementById('btn-save-session');
  if (btnSave) btnSave.addEventListener('click', validateAndSaveSession);

  const btnOpenHistory = document.getElementById('btn-open-history');
  if (btnOpenHistory) btnOpenHistory.addEventListener('click', openSessionsDrawer);

  const btnCloseDrawer = document.getElementById('btn-close-drawer');
  if (btnCloseDrawer) btnCloseDrawer.addEventListener('click', closeSessionsDrawer);

  const btnDrawerOk = document.getElementById('btn-drawer-ok');
  if (btnDrawerOk) btnDrawerOk.addEventListener('click', closeSessionsDrawer);
  
  const btnExportAll = document.getElementById('btn-export-all');
  if (btnExportAll) btnExportAll.addEventListener('click', exportAllSessionsJson);

  const btnCloseJson = document.getElementById('btn-close-json');
  if (btnCloseJson) btnCloseJson.addEventListener('click', () => document.getElementById('json-viewer-box').style.display = 'none');

  const btnViewLastJson = document.getElementById('btn-view-last-json');
  if (btnViewLastJson) btnViewLastJson.addEventListener('click', () => {
    if (state.lastSavedPayload) {
      openSessionsDrawer();
      setTimeout(() => window.viewSessionJson(state.lastSavedPayload.sessionId), 150);
    }
  });
}

// ==========================================================================
// 8. TIROIR DE SESSIONS ET AFFICHAGE JSON
// ==========================================================================

function openSessionsDrawer() {
  renderSessionsList();
  const drawer = document.getElementById('drawer-sessions');
  if (drawer) drawer.style.display = 'flex';
}

function closeSessionsDrawer() {
  const drawer = document.getElementById('drawer-sessions');
  if (drawer) drawer.style.display = 'none';
  const jsonBox = document.getElementById('json-viewer-box');
  if (jsonBox) jsonBox.style.display = 'none';
}

function renderSessionsList() {
  const sessions = getStoredSessions();
  const container = document.getElementById('sessions-list-container');
  const countEl = document.getElementById('modal-sessions-count');
  if (countEl) countEl.textContent = sessions.length;

  if (!container) return;

  if (sessions.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:#666; padding: 20px;">Aucune session enregistrée.</p>`;
    return;
  }

  container.innerHTML = sessions.map(s => {
    const dateAffichee = s.collectedAt && s.collectedAt.date ? s.collectedAt.date : s.timestamp;
    return `
      <div style="background:#f9f9f9; border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <strong>${s.sessionId}</strong>
          <span style="font-size:0.85rem; color:#666;">${dateAffichee}</span>
        </div>
        <p style="margin: 5px 0; font-size: 0.9rem;">🌱 <strong>${s.species.label}</strong></p>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <button type="button" class="btn-small btn-primary-mini" onclick="window.viewSessionJson('${s.sessionId}')">📄 Voir JSON</button>
          <button type="button" class="btn-small" style="color:#d9534f;" onclick="window.deleteSessionRecord('${s.sessionId}')">🗑️ Supprimer</button>
        </div>
      </div>
    `;
  }).join('');
}

window.viewSessionJson = function(sessionId) {
  const session = getStoredSessions().find(s => s.sessionId === sessionId);
  if (!session) return;
  state.viewingSession = session;
  const jsonBox = document.getElementById('json-viewer-box');
  const jsonContent = document.getElementById('json-content');
  const jsonTitle = document.getElementById('json-title');

  if (jsonTitle) jsonTitle.textContent = `JSON : ${session.sessionId}`;
  if (jsonContent) jsonContent.textContent = JSON.stringify(session, null, 2);
  if (jsonBox) jsonBox.style.display = 'block';
  jsonBox.scrollIntoView({ behavior: 'smooth' });
};

window.deleteSessionRecord = function(sessionId) {
  if (confirm('Voulez-vous supprimer cette session ?')) {
    const sessions = getStoredSessions().filter(s => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    renderSessionsList();
    updateSessionsCountBadge();
  }
};

function exportAllSessionsJson() {
  const sessions = getStoredSessions();
  if (sessions.length === 0) return alert('Aucune session à exporter.');
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  
  a.download = `sessions-recolte-${dd}-${mm}-${yyyy}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================================
// 9. UTILITAIRES ET DÉMARRAGE
// ==========================================================================

function updateNetworkStatus() {
  const dot = document.getElementById('network-dot');
  const label = document.getElementById('network-text');
  if (navigator.onLine) {
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = 'Connecté';
  } else {
    if (dot) dot.className = 'status-dot offline';
    if (label) label.textContent = 'Hors-ligne';
  }
}

function updateSessionsCountBadge() {
  const sessions = getStoredSessions();
  const badge = document.getElementById('sessions-counter');
  if (badge) {
    badge.textContent = sessions.length;
    badge.style.display = sessions.length > 0 ? 'inline-flex' : 'none';
  }
}

function showSuccessBanner(id) {
  const banner = document.getElementById('success-banner');
  if (document.getElementById('alert-session-id')) document.getElementById('alert-session-id').textContent = `REF: ${id}`;
  if (banner) banner.style.display = 'block';
}

window.hideSuccessBanner = function() { 
  const banner = document.getElementById('success-banner');
  if (banner) banner.style.display = 'none'; 
};

function showErrorBanner(errors) {
  const banner = document.getElementById('error-banner');
  const list = document.getElementById('error-list');
  if (list) list.innerHTML = errors.map(e => `<li>${e}</li>`).join('');
  if (banner) banner.style.display = 'block';
}

function hideErrorBanner() { if (document.getElementById('error-banner')) document.getElementById('error-banner').style.display = 'none'; }

document.addEventListener('DOMContentLoaded', initApp);
