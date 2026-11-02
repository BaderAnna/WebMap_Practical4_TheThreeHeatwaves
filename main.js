// =====================================================================
// Flood impacts on mobility: climate scenarios + Donkey Republic stations
// =====================================================================

// ---------- Map ----------
const map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }) ],
  view: new ol.View({
    center: ol.proj.fromLonLat([22.27, 60.45]), // Turku
    zoom: 11.5
  })
});

// =====================================================================
// 1. Climate layers (WMS, Lounaistieto GeoServer)
// =====================================================================
const GS    = 'https://geoserver.lounaistieto.fi/geoserver/';
const TULVA = GS + 'tulvamallinnus/ows';
const VESI  = GS + 'vesiensuojelu/ows';

const SCENARIO_SHORT  = { rcp45: 'RCP 4.5', rcp85: 'RCP 8.5' };

const THEMES = {
  flood: {
    title: 'Flood depth',
    opacity: 0.7,
    rcp45: { url: TULVA, layer: 'tulvaveden_syvyys_kohtalaiset_paastot' },
    rcp85: { url: VESI,  layer: 'Veden_syvyys_huletulva_RCP8_5' },
    // Legende fuer BEIDE Szenarien: die des RCP-8.5-Layers
    legend: { url: VESI, layer: 'Veden_syvyys_huletulva_RCP8_5' }
  }
  // Public transport und Road network (WMS) wurden entfernt:
  // Straßen kommen jetzt als GeoJSON von GitHub (siehe Abschnitt 2).
};

let currentScenario = 'none'; // 'none' | 'rcp45' | 'rcp85'
const olLayers = {};

function makeSource(cfg) {
  return new ol.source.TileWMS({
    url: cfg.url,
    params: { 'LAYERS': cfg.layer, 'TILED': true, 'VERSION': '1.3.0' },
    serverType: 'geoserver',
    crossOrigin: 'anonymous'
  });
}

Object.keys(THEMES).forEach(function (key) {
  const t = THEMES[key];
  olLayers[key] = new ol.layer.Tile({
    opacity: t.opacity,
    visible: false,
    source: makeSource(t.rcp45)
  });
  map.addLayer(olLayers[key]);
});

function legendUrl(cfg) {
  return cfg.url +
    '?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=' +
    encodeURIComponent(cfg.layer);
}

// =====================================================================
// 2. Donkey Republic stations (GeoJSON from GitHub)
// =====================================================================
const DONKEY_ORANGE    = '#f7711e';
const AFFECTED_RED     = '#4b474764';
const ZOOM_ICON        = 14;   // ab diesem Zoom: Fahrradsymbole, darunter: Cluster
const CLUSTER_DISTANCE = 50;   // Pixelabstand zum Zusammenfassen
const MATCH_TOLERANCE  = 5;    // Toleranz (Kartenmeter) beim Abgleich der Stationen

const DATA_BASE = 'https://raw.githubusercontent.com/BaderAnna/WebMap_Practical4_TheThreeHeatwaves/main/data/';
const GEOJSON_URL = DATA_BASE + 'donkey_bike_stations_WGS84.geojson';
const AFFECTED_URLS = {
  rcp45: DATA_BASE + 'RCP45_DonkeyBikes_inside100mBuffer.geojson',
  rcp85: DATA_BASE + 'RCP85_DonkeyBikes_inside100mBuffer.geojson'
};

const NAME_KEYS = ['name'];
const CAP_KEYS  = ['capacity'];

// ---------- Fahrradsymbol (einfaches, selbst gezeichnetes SVG) ----------
function makeBikeIcon(color) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="15" fill="' + color + '" stroke="white" stroke-width="2"/>' +
    '<g fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="10" cy="21" r="4.2"/><circle cx="22" cy="21" r="4.2"/>' +
    '<polyline points="10,21 16,21 13,13 20,14 16,21"/>' +
    '<polyline points="20,14 22,21"/>' +
    '<polyline points="19,11 20,14"/><polyline points="19,11 22,11"/>' +
    '<polyline points="11.5,12.5 14.5,12.5"/>' +
    '</g></svg>';
  return new ol.style.Style({
    image: new ol.style.Icon({ src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) })
  });
}
const iconStyleNormal   = makeBikeIcon(DONKEY_ORANGE);
const iconStyleAffected = makeBikeIcon(AFFECTED_RED);

// ---------- Straßen-Risiko-Layer (GeoJSON von GitHub, je ein Layer pro Szenario) ----------
const ROAD_COLOR = '#6a1b9a';
const ROAD_URLS = {
  rcp45: DATA_BASE + 'RCP4_5roadsrisk.geojson',
  rcp85: DATA_BASE + 'RCP8_5roadsrisk.geojson'
};

const roadStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: ROAD_COLOR, width: 3 }),
  fill:   new ol.style.Fill({ color: 'rgba(106, 27, 154, 0.25)' }),
  image:  new ol.style.Circle({
    radius: 5,
    fill: new ol.style.Fill({ color: ROAD_COLOR }),
    stroke: new ol.style.Stroke({ color: 'white', width: 1.5 })
  })
});

const roadLayers = {};
['rcp45', 'rcp85'].forEach(function (scn) {
  const src = new ol.source.Vector({
    url: ROAD_URLS[scn],
    format: new ol.format.GeoJSON()
  });
  src.on('featuresloadend', function (e) {
    console.log('Roads ' + SCENARIO_SHORT[scn] + ': ' + e.features.length + ' features loaded');
    if (e.features.length) console.log('Example road properties:', e.features[0].getProperties());
  });
  src.on('featuresloaderror', function () {
    console.error('Could not load ' + ROAD_URLS[scn]);
  });
  roadLayers[scn] = new ol.layer.Vector({ source: src, style: roadStyle, visible: false });
  map.addLayer(roadLayers[scn]); // vor dem Bike-Layer hinzugefuegt, Stationen liegen oben
});

// ---------- Quellen ----------
const vectorSource = new ol.source.Vector({
  url: GEOJSON_URL,
  format: new ol.format.GeoJSON()
});

vectorSource.on('featuresloadend', function (e) {
  if (e.features.length) console.log('Example station properties:', e.features[0].getProperties());
  updateLegend();
});

const clusterSource = new ol.source.Cluster({
  distance: CLUSTER_DISTANCE,
  source: vectorSource
});

// ---------- Betroffene Stationen (Buffer-Dateien) ----------
const affectedSources = { rcp45: new ol.source.Vector(), rcp85: new ol.source.Vector() };
const affectedCache   = { rcp45: new WeakMap(),          rcp85: new WeakMap() };
const geojsonFormat   = new ol.format.GeoJSON();

['rcp45', 'rcp85'].forEach(function (scn) {
  fetch(AFFECTED_URLS[scn])
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (json) {
      const feats = geojsonFormat.readFeatures(json, {
        featureProjection: map.getView().getProjection()
      });
      affectedSources[scn].addFeatures(feats);
      affectedCache[scn] = new WeakMap();
      console.log(SCENARIO_SHORT[scn] + ': ' + feats.length + ' affected features loaded');
      refreshBikes();
    })
    .catch(function (err) {
      console.error('Could not load ' + AFFECTED_URLS[scn], err);
    });
});

// Liegt die Station in der Datei der betroffenen Stationen? (mit kleiner Toleranz)
function isAffectedIn(scn, station) {
  const cache = affectedCache[scn];
  if (cache.has(station)) return cache.get(station);
  const c = station.getGeometry().getCoordinates();
  const near = affectedSources[scn].getFeaturesInExtent(
    ol.extent.buffer([c[0], c[1], c[0], c[1]], MATCH_TOLERANCE)
  );
  const hit = near.some(function (a) {
    const g = a.getGeometry();
    return g.getType() === 'Point' ? true : g.intersectsCoordinate(c);
  });
  cache.set(station, hit);
  return hit;
}

function affectedStats() {
  if (currentScenario === 'none') return null;
  const all = vectorSource.getFeatures();
  let n = 0;
  all.forEach(function (f) { if (isAffectedIn(currentScenario, f)) n++; });
  return { n: n, total: all.length, loaded: affectedSources[currentScenario].getFeatures().length };
}

// ---------- Styles (gecacht) ----------
let iconMode = false;
const styleCache = {};

function clusterStyle(size, state) { // state: 'none' | 'mixed' | 'all'
  const key = size + '|' + state;
  if (!styleCache[key]) {
    const radius = Math.min(12 + Math.sqrt(size) * 4, 40); // Groesse nach Anzahl
    styleCache[key] = new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        fill: new ol.style.Fill({ color: state === 'all' ? AFFECTED_RED : DONKEY_ORANGE }),
        stroke: new ol.style.Stroke({
          color: state === 'mixed' ? AFFECTED_RED : 'white',
          width: state === 'mixed' ? 4 : 2
        })
      }),
      text: new ol.style.Text({
        text: String(size),
        font: 'bold 14px Arial, sans-serif',
        fill: new ol.style.Fill({ color: '#ffffff' })
      })
    });
  }
  return styleCache[key];
}

function bikeStyle(feature) {
  const members = feature.get('features');
  const size = members.length;
  let affected = 0;
  if (currentScenario !== 'none') {
    members.forEach(function (m) { if (isAffectedIn(currentScenario, m)) affected++; });
  }
  const state = affected === 0 ? 'none' : (affected === size ? 'all' : 'mixed');
  if (iconMode && size === 1) return state === 'all' ? iconStyleAffected : iconStyleNormal;
  return clusterStyle(size, state);
}

const bikeLayer = new ol.layer.Vector({
  source: clusterSource,
  style: bikeStyle
});
map.addLayer(bikeLayer);

function refreshBikes() {
  bikeLayer.changed();
  updateLegend();
}

// Zwischen Cluster- und Symbolmodus wechseln
map.getView().on('change:resolution', function () {
  const nowIcon = map.getView().getZoom() >= ZOOM_ICON;
  if (nowIcon !== iconMode) {
    iconMode = nowIcon;
    clusterSource.setDistance(iconMode ? 0 : CLUSTER_DISTANCE);
  }
});

// =====================================================================
// 3. Popup
// =====================================================================
const popupEl = document.getElementById('popup');
const popupContent = document.getElementById('popup-content');
const popup = new ol.Overlay({
  element: popupEl,
  positioning: 'bottom-center',
  offset: [0, -20],
  autoPan: { animation: { duration: 250 } }
});
map.addOverlay(popup);

document.getElementById('popup-closer').addEventListener('click', function (e) {
  e.preventDefault();
  popup.setPosition(undefined);
});

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function pick(props, keys) {
  for (const k of keys) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') return props[k];
  }
  return null;
}

function describe(station) {
  const props = station.getProperties();
  const name = pick(props, NAME_KEYS);
  const cap  = pick(props, CAP_KEYS);
  let html;
  if (name === null && cap === null) {
    html = Object.keys(props).filter(function (k) { return k !== 'geometry'; })
      .map(function (k) { return esc(k) + ': ' + esc(props[k]); }).join('<br>');
  } else {
    html = '<b>' + esc(name !== null ? name : '(no name)') + '</b><br>' +
           'Capacity: ' + (cap !== null ? esc(cap) + ' bikes' : '–');
  }
  if (currentScenario !== 'none') {
    html += isAffectedIn(currentScenario, station)
      ? '<br><span style="color:' + AFFECTED_RED + '"><b>Inside 100 m flood buffer (' +
        SCENARIO_SHORT[currentScenario] + ')</b></span>'
      : '<br>Outside flood buffer (' + SCENARIO_SHORT[currentScenario] + ')';
  }
  return html;
}

function onBikeLayer(layer) { return layer === bikeLayer; }

map.on('singleclick', function (evt) {
  const hit = map.forEachFeatureAtPixel(evt.pixel, function (f) { return f; },
    { layerFilter: onBikeLayer, hitTolerance: 4 });

  if (!hit) { popup.setPosition(undefined); return; }

  const members = hit.get('features');

  // Cluster in der Uebersicht: hineinzoomen statt Popup
  if (members.length > 1 && !iconMode) {
    const extent = ol.extent.createEmpty();
    members.forEach(function (m) { ol.extent.extend(extent, m.getGeometry().getExtent()); });
    map.getView().fit(extent, { duration: 300, padding: [80, 80, 80, 80], maxZoom: ZOOM_ICON + 1 });
    return;
  }

  popupContent.innerHTML = members.map(describe).join('<hr>');
  popup.setPosition(hit.getGeometry().getCoordinates());
});

map.on('pointermove', function (e) {
  map.getTargetElement().style.cursor =
    map.hasFeatureAtPixel(e.pixel, { layerFilter: onBikeLayer }) ? 'pointer' : '';
});

// =====================================================================
// 4. Legende und Szenario-Steuerung
// =====================================================================
const legendEl = document.getElementById('legend');

function updateLegend() {
  const scn = currentScenario;
  let html = '<b>Donkey Republic stations</b><br>' +
    '<span class="dot" style="background:' + DONKEY_ORANGE + '"></span> Station<br>';

  if (scn !== 'none') {
    html += '<span class="dot" style="background:' + AFFECTED_RED + '"></span> Inside 100 m flood buffer<br>' +
      '<span class="dot dot-ring" style="background:' + DONKEY_ORANGE + ';border-color:' + AFFECTED_RED +
      '"></span> Group incl. affected stations<br>';

    const s = affectedStats();
    if (s) {
      if (s.loaded > 0 && s.n === 0 && s.total > 0) {
        html += '<small>No station matched the buffer file (check data / coordinates)</small><br>';
      } else {
        html += '<small>' + s.n + ' of ' + s.total + ' stations affected (' + SCENARIO_SHORT[scn] + ')</small><br>';
      }
    }

    Object.keys(THEMES).forEach(function (key) {
      if (olLayers[key].getVisible()) {
        const t = THEMES[key];
        const cfg = t.legend || t[scn];
        html += '<br><b>' + t.title + '</b> <small>(' + SCENARIO_SHORT[scn] + ')</small><br>' +
                '<img src="' + legendUrl(cfg) + '" alt="Legend"><br>';
      }
    });

    if (roadLayers[scn] && roadLayers[scn].getVisible()) {
      html += '<br><b>Road network risk</b> <small>(' + SCENARIO_SHORT[scn] + ')</small><br>' +
        '<span class="line-swatch" style="background:' + ROAD_COLOR + '"></span> Roads at flood risk<br>';
    }
  }
  legendEl.innerHTML = html;
}

function layerChecked(key) {
  const box = document.querySelector('input[data-layer="' + key + '"]');
  return currentScenario !== 'none' && !!box && box.checked;
}

function refreshWmsVisibility() {
  // WMS-Layer (Flood depth)
  Object.keys(THEMES).forEach(function (key) {
    olLayers[key].setVisible(layerChecked(key));
  });
  // Straßen: nur der Layer des gewaehlten Szenarios
  const showRoads = layerChecked('roads');
  Object.keys(roadLayers).forEach(function (scn) {
    roadLayers[scn].setVisible(showRoads && scn === currentScenario);
  });
}

function setScenario(scn) {
  currentScenario = scn;
  if (scn !== 'none') {
    Object.keys(THEMES).forEach(function (key) {
      olLayers[key].setSource(makeSource(THEMES[key][scn]));
    });
  }
  document.querySelectorAll('input[data-layer]').forEach(function (el) {
    el.disabled = (scn === 'none');
  });
  refreshWmsVisibility();
  popup.setPosition(undefined);
  refreshBikes();
}

document.querySelectorAll('input[name="rcp"]').forEach(function (el) {
  el.addEventListener('change', function (e) { setScenario(e.target.value); });
});

document.querySelectorAll('input[data-layer]').forEach(function (el) {
  el.addEventListener('change', function () {
    refreshWmsVisibility();
    updateLegend();
  });
});

// Startzustand aus dem HTML uebernehmen
const startRadio = document.querySelector('input[name="rcp"]:checked');
setScenario(startRadio ? startRadio.value : 'none');

// =====================================================================
// 5. Infokasten (runder "i"-Button)
// =====================================================================
const infoBtn = document.getElementById('info-btn');
const infoBox = document.getElementById('info-box');

function toggleInfo(open) {
  infoBox.hidden = !open;
  infoBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

infoBtn.addEventListener('click', function () { toggleInfo(infoBox.hidden); });
document.getElementById('info-close').addEventListener('click', function () { toggleInfo(false); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleInfo(false); });

// =====================================================================
// 6. Stationssuche
// =====================================================================
const searchInput = document.getElementById('station-search');
const searchList  = document.getElementById('station-list');
const searchMsg   = document.getElementById('search-msg');

function stationName(f) {
  const n = pick(f.getProperties(), NAME_KEYS);
  return n === null ? '' : String(n);
}

// Vorschlagsliste fuellen, sobald die Stationen geladen sind
function fillStationList() {
  const names = vectorSource.getFeatures().map(stationName).filter(Boolean)
    .filter(function (n, i, a) { return a.indexOf(n) === i; })
    .sort(function (a, b) { return a.localeCompare(b); });
  searchList.innerHTML = names.map(function (n) {
    return '<option value="' + esc(n) + '"></option>';
  }).join('');
}
vectorSource.on('featuresloadend', fillStationList);
fillStationList();

// Exakter Treffer zuerst, sonst erster Teiltreffer (Gross-/Kleinschreibung egal)
function findStation(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const all = vectorSource.getFeatures();
  return all.find(function (f) { return stationName(f).toLowerCase() === q; }) ||
         all.find(function (f) { return stationName(f).toLowerCase().indexOf(q) !== -1; }) ||
         null;
}

function showStation(station) {
  const coord = station.getGeometry().getCoordinates();
  const view = map.getView();
  view.animate(
    { center: coord, zoom: Math.max(view.getZoom(), ZOOM_ICON + 1), duration: 600 },
    function () {
      popupContent.innerHTML = describe(station);
      popup.setPosition(coord);
    }
  );
}

document.getElementById('search-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const station = findStation(searchInput.value);
  if (!station) {
    searchMsg.textContent = 'No station found';
    return;
  }
  searchMsg.textContent = '';
  showStation(station);
});

searchInput.addEventListener('input', function () { searchMsg.textContent = ''; });