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

  document.getElementById('display-date').textContent = state.dateStr;
  document.getElementById('display-time').textContent = state.timeStr;

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
    badge.className = 'badge-gps badge-gps-err';
    badge.textContent = 'GPS non supporté';
    msgEl.textContent = state.gps.error;
    msgEl.style.display = 'block';
    return;
  }

  state.gps.status = 'acquiring';
  badge.className = 'badge-gps badge-gps-acquiring';
  badge.textContent = 'Recherche satellite...';
  msgEl.style.display = 'none';

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
        document.getElementById('gps-alt-val').textContent = Math.round(pos.coords.altitude);
        altBtn.style.display = 'inline-block';
      }

      // Géocodage inversé automatique dès que les coordonnées sont acquises
      reverseGeocode(state.gps.lat, state.gps.lng);
    },
    (err) => {
      state.gps.status = err.code === 1 ? 'denied' : 'error';
      state.gps.error = err.code === 1
        ? 'Autorisation GPS refusée dans le navigateur.'
        : 'Signal satellite trop faible ou indisponible.';

      badge.className = 'badge-gps badge-gps-err';
      badge.textContent = 'GPS indisponible';
      msgEl.textContent = state.gps.error + ' Utilisez le bouton « Coordonnées test » si nécessaire.';
      msgEl.style.display = 'block';

      // Afficher l'aide hors-ligne / réseau indisponible
      const lieuDitHint = document.getElementById('lieudit-hint');
      if (lieuDitHint && !document.getElementById('input-lieudit').value.trim()) {
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

  document.getElementById('gps-msg').style.display = 'none';
  renderGpsDisplay();

  const altBtn = document.getElementById('btn-use-gps-alt');
  document.getElementById('gps-alt-val').textContent = '255';
  altBtn.style.display = 'inline-block';

  // Si l'altitude est vide, la préremplir
  const altInput = document.getElementById('input-altitude');
  if (!altInput.value) {
    altInput.value = '255';
  }

  // Lancer le géocodage inversé automatique
  reverseGeocode(state.gps.lat, state.gps.lng);
}

function renderGpsDisplay() {
  const badge = document.getElementById('gps-status-badge');
  badge.className = 'badge-gps badge-gps-ok';
  badge.textContent = 'Signal GPS fixé ✓';

  document.getElementById('display-lat').textContent = state.gps.lat ? state.gps.lat.toFixed(6) + '° N' : '-';
  document.getElementById('display-lng').textContent = state.gps.lng ? state.gps.lng.toFixed(6) + '° E' : '-';
  document.getElementById('display-acc').textContent = state.gps.acc ? `± ${Math.round(state.gps.acc)} m` : 'N/A';
  document.getElementById('display-alt-gps').textContent = state.gps.alt ? `${Math.round(state.gps.alt)} m` : 'Non fourni';
}

/**
 * Géocodage Inversé automatique via l'API publique geo.api.gouv.fr
 * Si connecté : pré-remplit "Commune / Lieu-dit"
 * Si hors-ligne / erreur : attrape silencieusement, laisse le champ vide et modifiable,
 * et affiche le texte d'aide requis.
 */
async function reverseGeocode(lat, lng) {
  const lieuDitInput = document.getElementById('input-lieudit');
  const lieuDitHint = document.getElementById('lieudit-hint');

  if (!lat || !lng) return;

  // Détection hors-ligne immédiate
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
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout en zone réseau faible

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

      // Pré-remplir automatiquement le champ s'il est vide ou s'il a été préalablement auto-rempli
      if (!lieuDitInput.value.trim() || lieuDitInput.dataset.autoFilled === 'true') {
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
    // Si le téléphone est hors-ligne en forêt :
    // Attraper l'erreur silencieusement, laisser le champ modifiable et afficher le message d'aide exact
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

function onSpeciesChanged(speciesLabel) {
  const isCornus = speciesLabel.includes('Cornus sanguinea');

  const cardVl = document.getElementById('card-reg-vl');
  const cardMfr = document.getElementById('card-reg-mfr');
  const cardBoth = document.getElementById('card-reg-both');
  const lockedBadge = document.getElementById('badge-locked-vl');
  const noticeVl = document.getElementById('notice-vl-only');

  // Mise à jour des puces rapides
  document.querySelectorAll('.chip[data-species]').forEach(c => {
    c.classList.toggle('active', c.getAttribute('data-species') === speciesLabel);
  });

  if (isCornus) {
    // Verrouiller strictement sur Végétal Local
    setRegulatoryObjective('VL');
    cardMfr.classList.add('disabled');
    cardBoth.classList.add('disabled');
    lockedBadge.style.display = 'inline-block';
    noticeVl.style.display = 'block';
  } else {
    // Débloquer les options MFR et Les deux
    cardMfr.classList.remove('disabled');
    cardBoth.classList.remove('disabled');
    lockedBadge.style.display = 'none';
    noticeVl.style.display = 'none';
  }

  refreshConditionalSections();
}

function setRegulatoryObjective(objective) {
  state.currentObjective = objective;

  // Mettre à jour l'état visuel des cartes radio
  document.querySelectorAll('.radio-card').forEach(card => {
    const radio = card.querySelector('input[type="radio"]');
    const isChecked = radio.value === objective;
    radio.checked = isChecked;
    card.classList.toggle('active', isChecked);
  });

  refreshConditionalSections();
}

function refreshConditionalSections() {
  const species = document.getElementById('species-select').value;
  const isCornus = species.includes('Cornus sanguinea');

  // Si Cornus sanguinea, forcer VL
  const effectiveObjective = isCornus ? 'VL' : state.currentObjective;

  const showVL = effectiveObjective === 'VL' || effectiveObjective === 'BOTH';
  const showMFR = effectiveObjective === 'MFR' || effectiveObjective === 'BOTH';

  document.getElementById('section-vl').style.display = showVL ? 'block' : 'none';
  document.getElementById('section-mfr').style.display = showMFR ? 'block' : 'none';
}

// ==========================================================================
// 4. QUANTITÉ DYNAMIQUE ET COMPTEUR D'INDIVIDUS
// ==========================================================================

/**
 * Adapte automatiquement le libellé (label) ou le placeholder du champ "Quantité récoltée"
 * selon le type de matériel sélectionné (Graines, Boutures, Plantes entières).
 */
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
    // Graines par défaut
    if (labelQuantite) labelQuantite.textContent = 'Quantité récoltée';
    if (inputQuantite) inputQuantite.placeholder = 'Quantité de graines (Optionnel)';
  }
}

/**
 * Met à jour le compteur d'individus (démarrant à 1) et le badge de conformité
 */
function setIndividusCount(val) {
  const count = Math.max(1, parseInt(val, 10) || 1);
  document.getElementById('input-individus').value = count;
  document.getElementById('val-individus').textContent = count;

  const labelEl = document.getElementById('label-individus');
  if (labelEl) {
    labelEl.textContent = count > 1 ? 'individus' : 'individu';
  }

  const badge = document.getElementById('badge-seuil');
  if (count >= 30) {
    badge.className = 'badge-threshold valid';
    badge.textContent = '✓ Seuil validé (≥ 30)';
  } else {
    badge.className = 'badge-threshold invalid';
    badge.textContent = '⚠️ Seuil incomplet (< 30 requis au global)';
  }
}

// ==========================================================================
// 5. VALIDATION DU FORMULAIRE ET ENREGISTREMENT LOCALSTORAGE
// ==========================================================================

function validateAndSaveSession() {
  hideErrorBanner();
  hideSuccessBanner();

  const errors = [];

  const species = document.getElementById('species-select').value;
  const lieuDit = document.getElementById('input-lieudit').value.trim();
  const altitudeStr = document.getElementById('input-altitude').value.trim();
  const materielType = document.getElementById('input-materiel-type').value;

  const quantiteInput = document.getElementById('input-quantite');
  const quantiteStr = quantiteInput ? quantiteInput.value.trim() : '';
  const quantiteVal = quantiteStr !== '' ? Number(quantiteStr) : null;

  const poidsInput = document.getElementById('input-poids-g');
  const poidsStr = poidsInput ? poidsInput.value.trim() : '';
  const poidsVal = poidsStr !== '' ? Number(poidsStr) : null;

  // Tronc commun obligatoire
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

  // Validation Végétal Local
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

  // Validation MFR
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

  // En cas d'erreurs, affichage en haut
  if (errors.length > 0) {
    showErrorBanner(errors);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  // Construction de l'objet JSON complet et structuré
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
    // Donnée saisie enregistrée sous la clé "quantite"
    quantite: quantiteVal,
    // Poids récolté (en grammes) enregistré sous la clé "poids_g"
    poids_g: poidsVal,
    troncCommun: {
      communeLieuDit: lieuDit,
      lieuDit: lieuDit,
      communeDetectee: state.gps.commune || null,
      altitudeMeters: Number(altitudeStr),
      materielType: materielType,
      quantite: quantiteVal, // Clé "quantite" requise
      quantiteRecoltee: quantiteVal,
      quantiteLibelle: labelQuantiteEl ? labelQuantiteEl.textContent : 'Quantité récoltée',
      poids_g: poidsVal, // Clé "poids_g" requise dans troncCommun
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
    sync: {
      status: 'pending',
      savedLocallyAt: new Date().toISOString(),
    },
  };

  // Sauvegarde dans le localStorage du navigateur
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

function updateSessionWeight(sessionId, newWeight) {
  const sessions = getStoredSessions();
  const target = sessions.find(s => s.sessionId === sessionId);
  if (target) {
    const num = Number(newWeight);
    target.quantite = num;
    target.poids_g = num;
    if (target.troncCommun) {
      target.troncCommun.quantite = num;
      target.troncCommun.poids_g = num;
      target.troncCommun.quantiteRecoltee = num;
      target.troncCommun.isWeightDeferred = false;
      target.troncCommun.isQuantiteRenseignee = true;
    }
    target.sync.savedLocallyAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    renderSessionsList();
  }
}

function deleteSession(sessionId) {
  if (confirm('Supprimer cette session locale ?')) {
    const sessions = getStoredSessions().filter(s => s.sessionId !== sessionId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    renderSessionsList();
    updateSessionsCountBadge();
  }
}

// ==========================================================================
// 6. GESTION DU TIROIR / MODAL DE CONSULTATION
// ==========================================================================

function openSessionsDrawer() {
  renderSessionsList();
  document.getElementById('drawer-sessions').style.display = 'flex';
}

function closeSessionsDrawer() {
  document.getElementById('drawer-sessions').style.display = 'none';
  document.getElementById('json-viewer-box').style.display = 'none';
}

function renderSessionsList() {
  const sessions = getStoredSessions();
  const container = document.getElementById('sessions-list-container');
  document.getElementById('modal-sessions-count').textContent = sessions.length;

  if (sessions.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: #78716c;">
        <div style="font-size: 36px; margin-bottom: 8px;">📂</div>
        <strong>Aucune session enregistrée localement</strong>
        <p style="font-size: 12px; margin-top: 4px;">Remplissez le formulaire et cliquez sur « Enregistrer la session » pour archiver vos récoltes hors-ligne.</p>
      </div>
    `;
    return;
  }

  let html = '';
  sessions.forEach(item => {
    const isVL = !!item.vegetalLocal;
    const isMFR = !!item.mfr;
    const quantiteVal = item.quantite ?? item.troncCommun?.quantite ?? item.troncCommun?.quantiteRecoltee;
    const poidsGVal = item.poids_g ?? item.troncCommun?.poids_g;
    const isWeightDeferred = (quantiteVal === null || quantiteVal === undefined) && (poidsGVal === null || poidsGVal === undefined);
    const materielType = item.troncCommun?.materielType || 'Graines';
    const uniteLabel = materielType === 'Boutures' ? 'boutures' : materielType === 'Plantes entières' ? 'plants';

    html += `
      <div class="session-item">
        <div class="session-item-header">
          <div>
            <div class="session-item-title">${escapeHtml(item.species.label)}</div>
            <div class="session-item-sub">
              📅 ${escapeHtml(item.collectedAt.date)} à ${escapeHtml(item.collectedAt.time)} | 📍 ${escapeHtml(item.troncCommun.lieuDit)} (${item.troncCommun.altitudeMeters}m)
            </div>
          </div>
          <div>
            <button type="button" class="btn-small" onclick="viewSessionJson('${item.sessionId}')">JSON</button>
            <button type="button" class="btn-small" style="color: #dc2626;" onclick="deleteSession('${item.sessionId}')">🗑️</button>
          </div>
        </div>

        <div class="session-tags">
          ${isVL ? `<span class="tag tag-vl">VL: ${item.vegetalLocal.nbIndividusCollectes} ind. (${escapeHtml(item.vegetalLocal.eunisHabitat)})</span>` : ''}
          ${isMFR ? `<span class="tag tag-mfr">MFR: ${escapeHtml(item.mfr.categorieMFR)} (${escapeHtml(item.mfr.codePeuplementBase)})</span>` : ''}
          <span class="tag tag-neutral">${escapeHtml(materielType)}</span>
          ${poidsGVal !== null && poidsGVal !== undefined ? `<span class="tag tag-amber">⚖️ ${poidsGVal} g</span>` : ''}
        </div>

        <div class="session-weight-box">
          <div>
            ${poidsGVal !== null && poidsGVal !== undefined
              ? `<span style="color: #15803d; font-weight: 600;">⚖️ Poids récolté : ${poidsGVal} g</span>`
              : (quantiteVal !== null && quantiteVal !== undefined
                ? `<span style="color: #15803d; font-weight: 600;">⚖️ Quantité récoltée : ${quantiteVal} ${uniteLabel}</span>`
                : '<span style="color: #b45309; font-weight: 600;">⚠️ Poids/quantité en attente (pesée en pépinière)</span>'
              )
            }
          </div>
          <button type="button" class="btn-small" onclick="promptEditWeight('${item.sessionId}', '${poidsGVal ?? quantiteVal ?? ''}')">
            ${isWeightDeferred ? '+ Renseigner le poids (g)' : 'Modifier'}
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

window.viewSessionJson = function(sessionId) {
  const sessions = getStoredSessions();
  const target = sessions.find(s => s.sessionId === sessionId);
  if (!target) return;

  const box = document.getElementById('json-viewer-box');
  document.getElementById('json-title').textContent = `JSON Structuré - ${target.sessionId}`;
  document.getElementById('json-content').textContent = JSON.stringify(target, null, 2);
  box.style.display = 'block';

  // Défilement fluide vers le visualiseur JSON
  box.scrollIntoView({ behavior: 'smooth' });

  // Stocker la référence courante pour copier/télécharger
  state.viewingSession = target;
};

window.promptEditWeight = function(sessionId, currentVal) {
  const val = prompt('Saisir la quantité récoltée (ex: 12.5 kg, 200 boutures, 15 plants...) :', currentVal || '');
  if (val !== null && val.trim() !== '') {
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num >= 0) {
      updateSessionWeight(sessionId, num);
    } else {
      alert('Veuillez saisir un nombre valide.');
    }
  }
};

window.deleteSession = deleteSession;

function exportAllSessionsJson() {
  const sessions = getStoredSessions();
  const blob = new Blob([JSON.stringify(sessions, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `toutes_recoltes_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================================
// 7. GESTION DES ÉVÉNEMENTS DU DOM
// ==========================================================================

function bindEvents() {
  // Changement d'espèce
  document.getElementById('species-select').addEventListener('change', (e) => {
    onSpeciesChanged(e.target.value);
  });

  // Pastilles d'espèces rapides
  document.querySelectorAll('.chip[data-species]').forEach(btn => {
    btn.addEventListener('click', () => {
      const species = btn.getAttribute('data-species');
      document.getElementById('species-select').value = species;
      onSpeciesChanged(species);
    });
  });

  // Changement d'objectif réglementaire (Cartes radio)
  document.querySelectorAll('input[name="regulatoryObjective"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      setRegulatoryObjective(e.target.value);
    });
  });

  // Actualisation GPS
  document.getElementById('btn-refresh-gps').addEventListener('click', acquireGpsLocation);
  document.getElementById('btn-simulate-gps').addEventListener('click', simulateGpsLocation);

  // Utiliser l'altitude GPS
  document.getElementById('btn-use-gps-alt').addEventListener('click', () => {
    if (state.gps.alt !== null) {
      document.getElementById('input-altitude').value = Math.round(state.gps.alt);
    }
  });

  // Écouteur d'événement (change) UNIQUEMENT sur le menu déroulant existant "Type de matériel"
  const selectMateriel = document.getElementById('select-materiel-type');
  if (selectMateriel) {
    selectMateriel.addEventListener('change', (e) => {
      const val = e.target.value;
      const hiddenInput = document.getElementById('input-materiel-type');
      if (hiddenInput) hiddenInput.value = val;

      // Synchronisation visuelle des pastilles d'accès rapide
      document.querySelectorAll('.chip-materiel').forEach(c => {
        c.classList.toggle('active', c.getAttribute('data-value') === val);
      });

      // Mise à jour dynamique du label et placeholder du champ Quantité récoltée situé en dessous
      updateDynamicQuantite(val);
    });
  }

  // Puces rapides de type de matériel (déclenchent l'événement change sur le menu déroulant existant)
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

  // Détection de saisie manuelle du lieu-dit pour ne pas l'écraser automatiquement par le GPS
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
  document.getElementById('btn-minus-ind').addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 1;
    setIndividusCount(cur - 1);
  });
  document.getElementById('btn-plus-ind').addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 1;
    setIndividusCount(cur + 1);
  });
  document.getElementById('btn-add-5').addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 0;
    setIndividusCount(cur + 5);
  });
  document.getElementById('btn-add-10').addEventListener('click', () => {
    const cur = parseInt(document.getElementById('input-individus').value, 10) || 0;
    setIndividusCount(cur + 10);
  });
  document.getElementById('btn-set-30').addEventListener('click', () => {
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
  document.getElementById('btn-save-session').addEventListener('click', validateAndSaveSession);

  // Nouvelle session
  document.getElementById('btn-new-session').addEventListener('click', initNewSession);
  document.getElementById('btn-alert-new').addEventListener('click', initNewSession);

  // Fermeture alerte de succès
  const btnDismissAlert = document.getElementById('btn-dismiss-alert');
  if (btnDismissAlert) btnDismissAlert.addEventListener('click', hideSuccessBanner);

  // Tiroir de sessions
  document.getElementById('btn-open-history').addEventListener('click', openSessionsDrawer);
  document.getElementById('btn-close-drawer').addEventListener('click', closeSessionsDrawer);
  document.getElementById('btn-drawer-ok').addEventListener('click', closeSessionsDrawer);
  document.getElementById('btn-export-all').addEventListener('click', exportAllSessionsJson);

  // Actions de l'inspecteur JSON
  document.getElementById('btn-view-last-json').addEventListener('click', () => {
    if (state.lastSavedPayload) {
      openSessionsDrawer();
      setTimeout(() => {
        window.viewSessionJson(state.lastSavedPayload.sessionId);
      }, 150);
    }
  });

  document.getElementById('btn-copy-json').addEventListener('click', () => {
    const text = document.getElementById('json-content').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = document.getElementById('btn-copy-json');
      const original = btn.textContent;
      btn.textContent = 'Copié ✓';
      setTimeout(() => { btn.textContent = original; }, 2000);
    });
  });

  document.getElementById('btn-download-json').addEventListener('click', () => {
    if (!state.viewingSession) return;
    const blob = new Blob([JSON.stringify(state.viewingSession, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.viewingSession.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

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