/**
 * LES PETITES FORÊTS - PWA COLLECTE TERRAIN
 * Stockage LocalStorage 100% Hors-Ligne & Géocodage
 */

const STORAGE_KEY = 'semeur_harvest_sessions_v1';

const state = {
  sessionId: '',
  dateStr: '',
  displayDateStr: '', // Format de repli
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

  const inputDate = document.getElementById('input-date');
  const inputTime = document.getElementById('input-time');
  if (inputDate) inputDate.value = state.dateStr;
  if (inputTime) inputTime.value = state.timeStr;

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

      const altBtn = document.getElementById('btn-use-gps-alt');
      const gpsAltVal = document.getElementById('gps-alt-val');
      
      if (altBtn && gpsAltVal) {
        altBtn.style.display = 'inline-block';
        if (state.gps.alt !== null) {
          gpsAltVal.textContent = Math.round(state.gps.alt);
          altBtn.style.opacity = '1';
          altBtn.style.pointerEvents = 'auto';
        } else {
          gpsAltVal.textContent = 'non détectée';
          altBtn.style.opacity = '0.5';
          altBtn.style.pointerEvents = 'none';
        }
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
  if (altBtn && gpsAltVal) {
    gpsAltVal.textContent = '255';
    altBtn.style.display = 'inline-block';
    altBtn.style.opacity = '1';
    altBtn.style.pointerEvents = 'auto';
  }
  
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
    
    autoSelectMfrCategory(selectedOption);
  }
}

function autoSelectMfrCategory(selectedOption) {
  if (!selectedOption) return;
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
// 4. MODULE PHOTO GÉOLOCALISÉE (AVEC COMPRESSION)
// ==========================================================================

let currentPhotoData = null;
let currentPhotoCoords = null;

function handlePhotoCapture(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      }
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      currentPhotoData = canvas.toDataURL('image/jpeg', 0.7);

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
    img.src = e.target.result;
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
  
  // Lecture stricte des champs à l'écran (et nettoyage d'éventuelles secondes cachées par le navigateur)
  const finalDate = document.getElementById('input-date').value || state.dateStr;
  let finalTime = document.getElementById('input-time').value || state.timeStr;
  if (finalTime.length > 5) finalTime = finalTime.substring(0, 5); // Force le format HH:MM
  
  // Formatage propre JJ/MM/AAAA
  let customDisplayDateStr = state.displayDateStr;
  if (finalDate) {
    const parts = finalDate.split('-');
    if (parts.length === 3) {
      customDisplayDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  const payload = {
    schemaVersion: '1.2.0',
    sessionId: state.sessionId,
    timestamp: `${finalDate}T${finalTime}:00`,
    collectedAt: {
      date_fr: customDisplayDateStr,
      time_local: finalTime,
      iso_utc: new Date(`${finalDate}T${finalTime}`).toISOString()
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
        ...(isMFRActive ? ['Matériel Forestier Reproduction (MFR)'] : []),
      ],
    },
    quantite: quantiteVal,
    poids_g: poidsVal,
    troncCommun: {
      communeLieuDit: lieuDit,
      altitudeM
