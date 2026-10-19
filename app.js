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
    status: 'idle', // 'idle' | 'acquiring' | 'acquired' | 'error' | 'denied'
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

  // Réinitialisation du champ Commune / Lieu-dit et de son aide
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

  // Réinitialisation des autres champs
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

  // Réinitialisation Type de matériel & Quantité dynamique
  const selectMateriel = document.getElementById('select-materiel-type');
  if (selectMateriel) selectMateriel.value = 'Graines';

  const hiddenMateriel = document.getElementById('input-materiel-type');
  if (hiddenMateriel) hiddenMateriel.value = 'Graines';

  document.querySelectorAll('.chip-materiel').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-value') === 'Graines');
  });

  updateDynamicQuantite('Graines');

  // Réinitialisation compteur individus : démarre à 1
  setIndividusCount(1);

  // Masquer les alertes
  hideSuccessBanner();
  hideErrorBanner();

  // Déclencher la géolocalisation
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

      // Proposer d'utiliser l'altitude GPS si disponible
      if (pos.coords.altitude !== null) {
        const altBtn = document.getElementById('btn-use-gps-alt');
        const gpsAltVal = document.getElementById('gps-alt-val');
        if (gpsAltVal) gpsAltVal.textContent = Math.round(pos.coords.altitude);
        if (altBtn) altBtn.style.display = 'inline-block';
      }

      // Géocodage inversé automatique dès que les coordonnées sont acquises
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

      // Afficher l'aide hors-ligne / réseau indisponible
      const lieuDitHint = document.getElementById('lieudit-hint');
      const lieuDitInput = document.getElementById('input-lieudit');
      if (lieuDitHint && lieuDitInput && !lieuDitInput.value.trim()) {
        lieuDitHint.className = 'field-hint text-amber';
        lieuDitHint.textContent = 'Réseau indisponible : Saisie manuelle ou géocodage ultérieur en pépinière';
        lieuDitHint.style.display = 'block';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
  );
}

function simulateGpsLocation() {
  // Coordonnées en forêt de Tronçais (Allier, France)
  state.gps.lat = 46.652145 + (Math.random() - 0.5) * 0.005;
  state.gps.lng = 2.711832 + (Math.random() - 0.5) * 0.005;
  state.gps.acc = 4.5;
  state.gps.alt = 255;
  state.gps.status = 'acquired';
  state.gps.error = '';

  const gpsMsg = document.getElementById('gps-msg');
  if (gpsMsg) gpsMsg.style.display = 'none';
  renderGpsDisplay();

  const altBtn = document.getElementById('btn-use-gps-alt');
  const gpsAltVal = document.getElementById('gps-alt-val');
  if (gpsAltVal) gpsAltVal.textContent = '255';
  if (altBtn) altBtn.style.display = 'inline-block';

  // Si l'altitude est vide, la préremplir
  const altInput = document.getElementById('input-altitude');
  if (altInput && !altInput.value) {
    altInput.value = '255';
  }

  // Lancer le géocodage inversé automatique
  reverseGeocode(state.gps.lat, state.gps.lng);
}

function renderGpsDisplay() {
  const badge = document.getElementById('gps-status-badge');
  if (badge) {
    badge.className = 'badge-gps badge-gps-ok';
    badge.textContent = 'Signal GPS fixé ✓';
  }

  const latEl = document.getElementById('display-lat');
  const lngEl = document.getElementById('display-lng');
  const accEl = document.getElementById('display-acc');
  const altGpsEl = document.getElementById('display-alt-gps');

  if (latEl) latEl.textContent = state.gps.lat ? state.gps.lat.toFixed(6) + '° N' : '-';
  if (lngEl) lngEl.textContent = state.gps.lng ? state.gps.lng.toFixed(6) + '° E' : '-';
  if (accEl) accEl.textContent = state.gps.acc ? `± ${Math.round(state.gps.acc)} m` : 'N/A';
  if (altGpsEl) altGpsEl.textContent = state.gps.alt ? `${Math.round(state.gps.alt)} m` : 'Non fourni';
}

/**
 * Géocodage Inversé automatique via l'API publique geo.api.gouv.fr
 */
async function reverseGeocode(lat, lng) {
  const lieuDitInput = document.getElementById('input-lieudit');
  const lieuDitHint = document.getElementById('lieudit-hint');

  if (!lat || !lng) return;

  if (!navigator.onLine) {
    if (lieuDitHint) {
      lieuDitHint.className = 'field-hint text-amber';
      lieuDitHint.textContent = 'Réseau indisponible : Saisie manuelle ou géocodage ultérieur en pépinière';
      lieuDitHint.style.display = 'block';
    }
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://geo.api.gouv.fr/communes?lat=${lat}&lon=${lng}&fields=nom`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erreur API Gouv ${response.status}`);
    }

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
        lieuDitHint.textContent = `📍 Commune détectée via GPS : ${communeNom} (précisez au besoin le lieu-dit ou la parcelle)`;
        lieuDitHint.style.display = 'block';
      }
    } else {
      if (lieuDitHint) {
        lieuDitHint.className = 'field-hint';
        lieuDitHint.textContent = 'Commune non identifiée automatiquement : Saisie manuelle.';
        lieuDitHint.style.display = 'block';
      }
    }
  } catch (err) {
    state.gps.commune = null;
    if (lieuDitHint) {
      lieuDitHint.className = 'field-hint text-amber';
      lieuDitHint.textContent = 'Réseau indisponible : Saisie manuelle ou géocodage ultérieur en pépinière';
      lieuDitHint.style.display = 'block';
    }
  }
}

// ==========================================================================
// 3. LOGIQUE CONDITIONNELLE : ESPÈCES & OBJECTIF RÉGLEMENTAIRE
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
    if (cardMfr) cardMfr.classList.remove('disabled');
    if (cardBoth) cardBoth.classList.remove('disabled');
    if (lockedBadge) lockedBadge.style.display = 'none';
    if (noticeVl) noticeVl.style.display = 'none';
  }

  refreshConditionalSections();
}

function setRegulatoryObjective(objective) {
  state.currentObjective = objective;

  document.querySelectorAll('.radio-card').forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    if (radio) {
      const isChecked = radio.value === objective;
      radio.checked = isChecked;
      card.classList.toggle('active', isChecked);
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
          const acc = position.coords.accuracy.toFixed(1);
          
          if (gpsInfo) {
            gpsInfo.innerHTML = `📍 GPS attaché : Lat ${lat}, Lon ${lon} (Précision : ${acc}m)`;
          }
          currentPhotoCoords = { latitude: lat, longitude: lon, precision: acc };
        },
        (error) => {
          if (gpsInfo) {
            gpsInfo.innerHTML = `⚠️ Photo chargée, mais GPS non disponible (${error.message})`;
          }
          currentPhotoCoords = null;
        },
        { enableHighAccuracy: true }
      );
    } else {
      if (gpsInfo) {
        gpsInfo.innerHTML = `⚠️ Géolocalisation non supportée par ce navigateur.`;
      }
    }
  };
  reader.readAsDataURL(file);
}

// ==========================================================================
// 5. QUANTITÉ DYNAMIQUE ET COMPTEUR D'INDIVIDUS
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

  const labelEl = document.getElementById('label-individus');
  if (labelEl) {
    labelEl.textContent = count > 1 ? 'individus' : 'individu';
  }

  const badge = document.getElementById('badge-seuil');
  if (badge) {
    if (count >= 30) {
      badge.className = 'badge-threshold valid';
      badge.textContent = '✓ Seuil validé (≥ 30)';
    } else {
      badge.className = 'badge-threshold invalid';
      badge.textContent = '⚠️ Seuil incomplet (< 30 requis au global)';
    }
  }
}

// ==========================================================================
// 6. VALIDATION DU FORMULAIRE ET ENREGISTREMENT LOCALSTORAGE
// ==========================================================================

function validateAndSaveSession() {
  hideErrorBanner();
  hideSuccessBanner();

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

  if (!species) {
    errors.push("L'espèce ciblée est obligatoire.");
  }
  if (!lieuDit) {
    errors.push('Le champ Commune / Lieu-dit de récolte est obligatoire.');
  }
  if (!altitudeStr || isNaN(Number(altitudeStr))) {
    errors.push("L'altitude en mètres est obligatoire.");
  }

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

    if (!eunisHabitat) {
      errors.push("Le type d'habitat EUNIS (milieu de collecte) est obligatoire pour Végétal Local.");
    }
    if (!ph) {
      errors.push('Le pH du sol estimé est requis pour Végétal Local.');
    }
    if (!humidite) {
      errors.push("L'humidité du sol est requise pour Végétal Local.");
    }
    if (nbIndividus < 1) {
      errors.push("Le nombre d'individus collectés doit être au moins de 1.");
    }
    if (!prelevement25) {
      errors.push('Vous devez certifier ne pas avoir prélevé plus de 25% de la ressource (Charte Végétal Local).');
    }
  }

  let categorieMFR = '';
  let codePeuplement = '';

  if (isMFRActive) {
    categorieMFR = document.getElementById('input-mfr-cat').value;
    codePeuplement = document.getElementById('input-peuplement').value.trim();

    if (!categorieMFR) {
      errors.push('La catégorie MFR est obligatoire.');
    }
    if (!codePeuplement) {
      errors.push('Le code du peuplement de base est obligatoire (ex: FR-XX-YY).');
    }
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
      date: state.dateStr,
      time: state.timeStr,
      iso: new Date(`${state.dateStr}T${state.timeStr}`).toISOString(),
    },
    geolocation: {
      latitude: state.gps.lat,
      longitude: state.gps.lng,
      accuracyMeters: state.gps.acc,
      altitudeGps: state.gps.alt,
      status: state.gps.status,
      commune: state.gps.commune || null,
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
      lieuDit: lieuDit,
      communeDetectee: state.gps.commune || null,
      altitudeMeters: Number(altitudeStr),
      materielType: materielType,
      quantite: quantiteVal,
      quantiteRecoltee: quantiteVal,
      quantiteLibelle: labelQuantiteEl ? labelQuantiteEl.textContent : 'Quantité récoltée',
      poids_g: poidsVal,
      isQuantiteRenseignee: quantiteVal !== null,
      isWeightDeferred: quantiteVal === null && poidsVal === null,
    },
    vegetalLocal: isVLActive ? {
      eunisHabitat: eunisHabitat,
      conditionsEcologiques: {
        ph: ph,
        humidite: humidite,
      },
      nbIndividusCollectes: nbIndividus,
      respecteSeuilMin30Individus: nbIndividus >= 30,
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
    },
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
  } catch (e) {
    console.error('Erreur lecture localStorage', e);
    return [];
  }
}

function saveSessionToLocalStorage(payload) {
  const sessions = getStoredSessions();
  const existingIndex = sessions.findIndex(s => s.sessionId === payload.sessionId);
  if (existingIndex >= 0) {
    sessions[existingIndex] = payload;
  } else {
    sessions.unshift(payload);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ==========================================================================
// 7. GESTION DES ÉVÉNEMENTS DU DOM
// ==========================================================================

function bindEvents() {
  // Changement d'espèce
  const speciesSelect = document.getElementById('species-select');
  if (speciesSelect) {
    speciesSelect.addEventListener('change', (e) => {
      onSpeciesChanged(e.target);
    });
  }

  // Changement d'objectif réglementaire (Cartes radio)
  document.querySelectorAll('input[name="regulatoryObjective"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setRegulatoryObjective(e.target.value);
    });
  });

  // Actualisation GPS
  const btnRefreshGps = document.getElementById('btn-refresh-gps');
  if (btnRefreshGps) btnRefreshGps.addEventListener('click', acquireGpsLocation);

  const btnSimulateGps = document.getElementById('btn-simulate-gps');
  if (btnSimulateGps) btnSimulateGps.addEventListener('click', simulateGpsLocation);

  // Utiliser l'altitude GPS
  const btnUseGpsAlt = document.getElementById('btn-use-gps-alt');
  if (btnUseGpsAlt) {
    btnUseGpsAlt.addEventListener('click', () => {
      if (state.gps.alt !== null) {
        document.getElementById('input-altitude').value = Math.round(state.gps.alt);
      }
    });
  }

  // Écouteur sur le menu déroulant "Type de matériel"
  const selectMateriel = document.getElementById('select-materiel-type');
  if (selectMateriel) {
    selectMateriel.addEventListener('change', (e) => {
      const val = e.target.value;
      const hiddenInput = document.getElementById('input-materiel-type');
      if (hiddenInput) hiddenInput.value = val;

      document.querySelectorAll('.chip-materiel').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-value') === val);
      });

      updateDynamicQuantite(val);
    });
  }

  // Puces rapides de type de matériel
  document.querySelectorAll('.chip-materiel').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value');
      const select = document.getElementById('select-materiel-type');
      if (select) {
        select.value = val;
        select.dispatchEvent(new Event('change'));
      }
    });
  });

  // Détection saisie manuelle lieu-dit
  const lieuDitInput = document.getElementById('input-lieudit');
  if (lieuDitInput) {
    lieuDitInput.addEventListener('input', () => {
      lieuDitInput.dataset.autoFilled = 'false';
    });
  }

  // Boutons de pH
  document.querySelectorAll('#ph-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ph-group .btn-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-value');
      document.getElementById('input-ph').value = val;
      document.getElementById('selected-ph-text').textContent = 'Sélectionné : ' + val;
    });
  });

  // Boutons d'Humidité
  document.querySelectorAll('#humidity-group .btn-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#humidity-group .btn-toggle').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-value');
      document.getElementById('input-humidity').value = val;
      document.getElementById('selected-hum-text').textContent = 'Sélectionné : ' + val;
    });
  });

  // Compteur d'individus
  const btnMinus = document.getElementById('btn-minus-ind');
  if (btnMinus) btnMinus.addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 1;
    setIndividusCount(cur - 1);
  });
  const btnPlus = document.getElementById('btn-plus-ind');
  if (btnPlus) btnPlus.addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 1;
    setIndividusCount(cur + 1);
  });
  const btnAdd5 = document.getElementById('btn-add-5');
  if (btnAdd5) btnAdd5.addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 0;
    setIndividusCount(cur + 5);
  });
  const btnAdd10 = document.getElementById('btn-add-10');
  if (btnAdd10) btnAdd10.addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 0;
    setIndividusCount(cur + 10);
  });
  const btnSet30 = document.getElementById('btn-set-30');
  if (btnSet30) btnSet30.addEventListener('click', () => {
    setIndividusCount(30);
  });

  // Cartes MFR
  document.querySelectorAll('#mfr-category-group .mfr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#mfr-category-group .mfr-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const val = btn.getAttribute('data-value');
      document.getElementById('input-mfr-cat').value = val;
      document.getElementById('selected-mfr-text').textContent = 'Sélectionné : ' + val;
    });
  });

  // Suggestions de code MFR
  document.querySelectorAll('.chip-code').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('input-peuplement').value = btn.getAttribute('data-code');
    });
  });

  // Enregistrer la session
  const btnSave = document.getElementById('btn-save-session');
  if (btnSave) btnSave.addEventListener('click', validateAndSaveSession);

  // Nouvelle session
  const btnNew = document.getElementById('btn-new-session');
  if (btnNew) btnNew.addEventListener('click', initNewSession);
  const btnAlertNew = document.getElementById('btn-alert-new');
  if (btnAlertNew) btnAlertNew.addEventListener('click', initNewSession);

  // Fermeture alerte de succès
  const btnDismissAlert = document.getElementById('btn-dismiss-alert');
  if (btnDismissAlert) btnDismissAlert.addEventListener('click', hideSuccessBanner);

  // Détection en ligne / hors ligne
  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
}

// ==========================================================================
// 8. NOTIFICATIONS ET UTILITAIRES D'INTERFACE
// ==========================================================================

function updateNetworkStatus() {
  const isOnline = navigator.onLine;
  const dot = document.getElementById('network-dot') || document.querySelector('.status-dot');
  const label = document.getElementById('network-label') || document.getElementById('network-text');

  if (isOnline) {
    if (dot) dot.className = 'status-dot online';
    if (label) label.textContent = 'Connecté (API active)';
  } else {
    if (dot) dot.className = 'status-dot offline';
    if (label) label.textContent = 'Hors-ligne (Forêt)';
  }
}

function updateSessionsCountBadge() {
  const sessions = getStoredSessions();
  const badge = document.getElementById('sessions-counter') || document.getElementById('sessions-count-badge');
  if (badge) {
    badge.textContent = sessions.length;
    badge.style.display = sessions.length > 0 ? 'inline-flex' : 'none';
  }
}

function showSuccessBanner(sessionId) {
  const banner = document.getElementById('success-banner') || document.getElementById('alert-success');
  const idEl = document.getElementById('alert-session-id');
  if (idEl) idEl.textContent = `REF: ${sessionId}`;
  if (banner) banner.style.display = 'block';
}

function hideSuccessBanner() {
  const banner = document.getElementById('success-banner') || document.getElementById('alert-success');
  if (banner) banner.style.display = 'none';
}

function showErrorBanner(errors) {
  const banner = document.getElementById('error-banner') || document.getElementById('alert-error');
  const list = document.getElementById('error-list') || document.getElementById('alert-error-list');
  if (list) {
    list.innerHTML = errors.map(e => `<li>${escapeHtml(e)}</li>`).join('');
  }
  if (banner) banner.style.display = 'block';
}

function hideErrorBanner() {
  const banner = document.getElementById('error-banner') || document.getElementById('alert-error');
  if (banner) banner.style.display = 'none';
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Démarrage de l'application dès le chargement du DOM
document.addEventListener('DOMContentLoaded', initApp);
