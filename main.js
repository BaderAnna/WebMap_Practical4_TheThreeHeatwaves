// =====================================================================
// Flood impacts on mobility: climate scenarios + Donkey bikes + Foeli bus stops
// =====================================================================

// ---------- Map ----------
const map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ className: 'bw-basemap', source: new ol.source.OSM() }) ],
  view: new ol.View({
    center: ol.proj.fromLonLat([22.27, 60.438]), // Turku
    zoom: 11.2
  })
});

let currentScenario = 'none'; // 'none' | 'rcp45' | 'rcp85'
let currentMode     = 'bikes'; // 'bikes' | 'bus'

const SCENARIO_SHORT = { rcp45: 'RCP 4.5', rcp85: 'RCP 8.5' };

const DATA_BASE = 'https://raw.githubusercontent.com/BaderAnna/WebMap_Practical4_TheThreeHeatwaves/main/data/';

// =====================================================================
// 1. Climate layers: flood depth (WMS) + road risk (GeoJSON)
//    Beide werden automatisch geladen, sobald ein RCP gewaehlt ist.
// =====================================================================
const GS    = 'https://geoserver.lounaistieto.fi/geoserver/';
const TULVA = GS + 'tulvamallinnus/ows';
const VESI  = GS + 'vesiensuojelu/ows';

const FLOOD_CFG = {
  rcp45: { url: TULVA, layer: 'tulvaveden_syvyys_kohtalaiset_paastot' },
  rcp85: { url: VESI,  layer: 'Veden_syvyys_huletulva_RCP8_5' },
  // Legende fuer BEIDE Szenarien: die des RCP-8.5-Layers
  legend: { url: VESI, layer: 'Veden_syvyys_huletulva_RCP8_5' }
};

function makeSource(cfg) {
  return new ol.source.TileWMS({
    url: cfg.url,
    params: { 'LAYERS': cfg.layer, 'TILED': true, 'VERSION': '1.3.0' },
    serverType: 'geoserver',
    crossOrigin: 'anonymous'
  });
}

function legendUrl(cfg) {
  return cfg.url +
    '?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=' +
    encodeURIComponent(cfg.layer);
}

const floodLayer = new ol.layer.Tile({
  opacity: 0.7,
  visible: false,
  source: makeSource(FLOOD_CFG.rcp45)
});
map.addLayer(floodLayer);

const ROAD_COLORS = {
  3: '#8ecae6',
  4: '#219ebc',
  5: '#023e8a'
};
const ROAD_URLS = {
  rcp45: DATA_BASE + 'RCP4_5roadsrisk.geojson',
  rcp85: DATA_BASE + 'RCP8_5roadsrisk.geojson'
};

const roadStyles = {};
Object.keys(ROAD_COLORS).forEach(function (riskClass) {
  roadStyles[riskClass] = new ol.style.Style({
    stroke: new ol.style.Stroke({ color: ROAD_COLORS[riskClass], width: 3 }),
    fill: new ol.style.Fill({ color: ROAD_COLORS[riskClass] + '40' }),
    image: new ol.style.Circle({
      radius: 5,
      fill: new ol.style.Fill({ color: ROAD_COLORS[riskClass] }),
      stroke: new ol.style.Stroke({ color: 'white', width: 1.5 })
    })
  });
});
const unclassifiedRoadStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: '#777777', width: 3 }),
  fill: new ol.style.Fill({ color: 'rgba(119, 119, 119, 0.25)' }),
  image: new ol.style.Circle({
    radius: 5,
    fill: new ol.style.Fill({ color: '#777777' }),
    stroke: new ol.style.Stroke({ color: 'white', width: 1.5 })
  })
});

function roadStyle(feature) {
  return roadStyles[String(feature.get('Risk_class'))] || unclassifiedRoadStyle;
}

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
  map.addLayer(roadLayers[scn]);
});

// =====================================================================
// 2. Stationen: Donkey bikes und Foeli-Bushaltestellen
// =====================================================================
const DONKEY_ORANGE    = '#f7711e';
const AFFECTED_RED     = '#f7711e85';
const AFFECTED_BUS     = '#F5B02785';
const BUS_YELLOW       = '#F5B027';
const AFFECTED_FERRY   = '#F5B02785';
const FERRY_BLUE     = '#F5B027';
const MATCH_TOLERANCE  = 5;    // Toleranz (Kartenmeter) beim Abgleich der Stationen

// ---------- Symbole (selbst gezeichnete SVGs) ----------
function bikeIconSvg(color) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
    '<circle cx="16" cy="16" r="15" fill="' + color + '" stroke="white" stroke-width="2"/>' +
    '<g fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="10" cy="21" r="4.2"/><circle cx="22" cy="21" r="4.2"/>' +
    '<polyline points="10,21 16,21 13,13 20,14 16,21"/>' +
    '<polyline points="20,14 22,21"/>' +
    '<polyline points="19,11 20,14"/><polyline points="19,11 22,11"/>' +
    '<polyline points="11.5,12.5 14.5,12.5"/>' +
    '</g></svg>';
}

function busIconSvg(color) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 64 64">' +
    '<rect x="2" y="2" width="60" height="60" fill="' + color + '" stroke="#000000" stroke-width="4"/>' +
    '<path d="M12 20a5 5 0 0 1 5-5h29a6 6 0 0 1 6 6v23H12z" fill="#000000"/>' +
    '<rect x="17" y="20" width="8" height="10" rx="1" fill="' + color + '"/>' +
    '<rect x="28" y="20" width="8" height="10" rx="1" fill="' + color + '"/>' +
    '<rect x="39" y="20" width="8" height="10" rx="1" fill="' + color + '"/>' +
    '<rect x="17" y="34" width="30" height="3" fill="' + color + '"/>' +
    '<circle cx="22" cy="46" r="5" fill="#000000"/>' +
    '<circle cx="43" cy="46" r="5" fill="#000000"/>' +
    '</svg>';
}

function svgIconStyle(svg, scale) {
  return new ol.style.Style({
    image: new ol.style.Icon({
      src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
      scale: scale || 1
    })
  });
}

function ferryIconSvg(color) {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 64 64">' +
    '<rect x="2" y="2" width="60" height="60" fill="' + color + '" stroke="#ffffff" stroke-width="4"/>' +
    '<path d="M30 17h4v5h-4zM29 16h6v2h-6z" fill="#ffffff"/>' +
    '<path d="M18 25h28v14H18z" fill="#ffffff"/>' +
    '<path d="M16 22h32v4H16z" fill="#ffffff"/>' +
    '<rect x="21" y="29" width="6" height="6" fill="' + color + '"/>' +
    '<rect x="29" y="29" width="6" height="6" fill="' + color + '"/>' +
    '<rect x="37" y="29" width="6" height="6" fill="' + color + '"/>' +
    '<path d="M12 39h40l-6 10-6 3H24l-6-3z" fill="#ffffff"/>' +
    '<path d="M18 42h28l-2 3H20z" fill="' + color + '"/>' +
    '<path d="M14 56c3-2 6 2 9 0s6-2 9 0 6 2 9 0 6-2 9 0" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>' +
    '</svg>';
}

// ---------- Konfiguration pro Modus ----------
const MODES = {
  bikes: {
    label: 'Donkey Republic stations',
    singular: 'Station',
    noun: 'stations',
    color: DONKEY_ORANGE,
    affectedColor: AFFECTED_RED,
    zoomIcon: 14,
    clusterDistance: 50,
    shape: 'round',
    clusterText: '#ffffff',
    stationsUrl: DATA_BASE + 'donkey_bike_stations_WGS84.geojson',
    affectedUrls: {
      rcp45: DATA_BASE + 'RCP45_DonkeyBikes_inside100mBuffer.geojson',
      rcp85: DATA_BASE + 'RCP85_DonkeyBikes_inside100mBuffer.geojson'
    },
    nameKeys: ['name'],
    capKeys: ['capacity'],
    iconSvg: bikeIconSvg
  },
  bus: {
    label: 'Föli bus stops',
    singular: 'Bus stop',
    noun: 'stops',
    color: BUS_YELLOW,
    affectedColor: AFFECTED_BUS,
    zoomIcon: 15,
    clusterDistance: 80,
    shape: 'square',
    clusterText: '#000000',   // dunkle Schrift, weiss waere auf Gelb schlecht lesbar
    stationsUrl: DATA_BASE + 'Turku_Bus_Stops.geojson',
    affectedUrls: {
      rcp45: DATA_BASE + encodeURIComponent('RCP45_Fölibus_inside100mBuffer.geojson'),
      rcp85: DATA_BASE + encodeURIComponent('RCP85_Fölibus_inside100mBuffer.geojson')
    },
    nameKeys: ['name', 'Name', 'NAME', 'stop_name', 'nimi', 'Nimi', 'NIMI'],
    capKeys: [],
    majorStopPattern: /linja-autoasema|turun satama|kauppatori|puutori|rautatientori|turun rautatieasema/i,
    majorStopScale: 1.4,
    majorStopColor: '#D99500',
    majorStopAffectedColor: '#D9950085',
    iconSvg: busIconSvg
  },
  ferry: {
    label: 'Föli ferry terminals',
    singular: 'Ferry terminal',
    noun: 'terminals',
    color: FERRY_BLUE,
    affectedColor: AFFECTED_FERRY,
    zoomIcon: 14,
    clusterDistance: 50,
    shape: 'diamond',
    clusterText: '#ffffff',
    stationsUrl: DATA_BASE + 'Ferry_stations_all_wgs84.geojson',
    affectedUrls: {
      rcp45: DATA_BASE + encodeURIComponent('RCP45_Ferry_inside100mBuffer_wgs84.geojson'),
      rcp85: DATA_BASE + encodeURIComponent('RCP85_Ferry_inside100mBuffer_wgs84.geojson')
    },
    nameKeys: ['name', 'Name', 'NAME', 'terminal_name', 'nimi', 'Nimi', 'NIMI'],
    capKeys: [],
    iconSvg: ferryIconSvg
  },
};

const geojsonFormat = new ol.format.GeoJSON();
const M = {}; // Laufzeitdaten pro Modus

document.querySelectorAll('.mode-option').forEach(function (option) {
  const mode = option.querySelector('input[name="mode"]').value;
  const cfg = MODES[mode];
  option.querySelector('.mode-icon').src =
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(cfg.iconSvg(cfg.color));
});

// Liegt die Station in der Datei der betroffenen Stationen? (mit kleiner Toleranz)
function isAffectedIn(modeKey, scn, station) {
  const aff = M[modeKey].affected[scn];
  if (aff.cache.has(station)) return aff.cache.get(station);
  const c = station.getGeometry().getCoordinates();
  const near = aff.source.getFeaturesInExtent(
    ol.extent.buffer([c[0], c[1], c[0], c[1]], MATCH_TOLERANCE)
  );
  const hit = near.some(function (a) {
    const g = a.getGeometry();
    if (g.getType() === 'Point' || g.intersectsCoordinate(c)) return true;
    const closest = g.getClosestPoint(c);
    const dx = closest[0] - c[0];
    const dy = closest[1] - c[1];
    return dx * dx + dy * dy <= MATCH_TOLERANCE * MATCH_TOLERANCE;
  });
  aff.cache.set(station, hit);
  return hit;
}

function clusterStyle(st, size, state) { // state: 'none' | 'mixed' | 'all'
  const key = size + '|' + state;
  if (!st.styleCache[key]) {
    const radius = Math.min(12 + Math.sqrt(size) * 4, 40);
    const styles = [new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        fill: new ol.style.Fill({ color: state === 'all' ? st.cfg.affectedColor : st.cfg.color }),
        stroke: new ol.style.Stroke({
          color: state === 'mixed' ? st.cfg.affectedColor : 'white',
          width: state === 'mixed' ? 4 : 2
        })
      }),
      text: new ol.style.Text({
        text: String(size),
        font: 'bold 14px Arial, sans-serif',
        fill: new ol.style.Fill({ color: st.cfg.clusterText })
      })
    })];
    if (state === 'all') {
      styles.push(new ol.style.Style({
        image: new ol.style.RegularShape({
          points: 4,        // 4 Spitzen -> mit radius2: 0 ergibt das ein "+"
          radius: radius,   // gleicher Radius wie der Kreis
          radius2: 0,       // 0 = reine Linien
          angle: Math.PI / 4, // 45° gedreht -> "×"
          stroke: new ol.style.Stroke({ color: 'black', width: 3 })
        })
      }));
    }
    st.styleCache[key] = styles;
  }
  return st.styleCache[key];
}

const unavailableIconStyle = new ol.style.Style({
  image: new ol.style.RegularShape({
    points: 4,
    radius: 14,
    radius2: 0,
    angle: Math.PI / 4,
    stroke: new ol.style.Stroke({ color: 'black', width: 2 })
  })
});

const unavailableMajorIconStyle = new ol.style.Style({
  image: new ol.style.RegularShape({
    points: 4,
    radius: 20,
    radius2: 0,
    angle: Math.PI / 4,
    stroke: new ol.style.Stroke({ color: 'black', width: 3 })
  })
});

function stationStyle(modeKey, feature) {
  const st = M[modeKey];
  const members = feature.get('features');
  const size = members.length;
  const isMajorStop = size === 1 && st.cfg.majorStopPattern &&
    st.cfg.majorStopPattern.test(String(pick(members[0].getProperties(), st.cfg.nameKeys) || ''));
  let affected = 0;
  if (currentScenario !== 'none') {
    members.forEach(function (m) { if (isAffectedIn(modeKey, currentScenario, m)) affected++; });
  }
  const state = affected === 0 ? 'none' : (affected === size ? 'all' : 'mixed');
  if (map.getView().getZoom() >= st.cfg.zoomIcon && size === 1) {
    if (state === 'all') {
      return [
        isMajorStop ? st.iconMajorAffected : st.iconAffected,
        isMajorStop ? unavailableMajorIconStyle : unavailableIconStyle
      ];
    }
    return isMajorStop ? st.iconMajorNormal : st.iconNormal;
  }
  return clusterStyle(st, size, state);
}

function loadAffected(modeKey, scn) {
  const st  = M[modeKey];
  const url = st.cfg.affectedUrls[scn];
  fetch(url)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (json) {
      const feats = geojsonFormat.readFeatures(json, {
        featureProjection: map.getView().getProjection()
      });
      st.affected[scn].source.addFeatures(feats);
      st.affected[scn].cache = new WeakMap();
      console.log(modeKey + ' ' + SCENARIO_SHORT[scn] + ': ' + feats.length + ' affected features loaded');
      refreshStations();
    })
    .catch(function (err) {
      console.error('Could not load ' + url, err);
    });
}

Object.keys(MODES).forEach(function (modeKey) {
  const cfg = MODES[modeKey];
  const st = M[modeKey] = {
    cfg: cfg,
    source: new ol.source.Vector({ url: cfg.stationsUrl, format: new ol.format.GeoJSON() }),
    affected: {
      rcp45: { source: new ol.source.Vector(), cache: new WeakMap() },
      rcp85: { source: new ol.source.Vector(), cache: new WeakMap() }
    },
    styleCache: {},
    iconNormal:   svgIconStyle(cfg.iconSvg(cfg.color)),
    iconAffected: svgIconStyle(cfg.iconSvg(cfg.affectedColor)),
    iconMajorNormal: svgIconStyle(cfg.iconSvg(cfg.majorStopColor || cfg.color), cfg.majorStopScale),
    iconMajorAffected: svgIconStyle(
      cfg.iconSvg(cfg.majorStopAffectedColor || cfg.affectedColor),
      cfg.majorStopScale
    )
  };

  st.iconMode = map.getView().getZoom() >= cfg.zoomIcon;
  st.cluster = new ol.source.Cluster({
    distance: st.iconMode ? 0 : cfg.clusterDistance,
    source: st.source
  });
  st.layer = new ol.layer.Vector({
    source: st.cluster,
    visible: modeKey === currentMode,
    style: function (f) { return stationStyle(modeKey, f); }
  });
  map.addLayer(st.layer);

  st.source.on('featuresloadend', function (e) {
    if (e.features.length) console.log(modeKey + ' example properties:', e.features[0].getProperties());
    refreshStations();
    if (modeKey === currentMode) fillStationList();
  });
  st.source.on('featuresloaderror', function () {
    console.error('Could not load ' + cfg.stationsUrl);
  });

  loadAffected(modeKey, 'rcp45');
  loadAffected(modeKey, 'rcp85');
});

function refreshStations() {
  Object.keys(M).forEach(function (k) { M[k].layer.changed(); });
  updateLegend();
}

// Zwischen Cluster- und Symbolmodus pro Verkehrsmittel wechseln
map.getView().on('change:resolution', function () {
  const zoom = map.getView().getZoom();
  Object.keys(M).forEach(function (k) {
    const st = M[k];
    const nowIcon = zoom >= st.cfg.zoomIcon;
    if (nowIcon !== st.iconMode) {
      st.iconMode = nowIcon;
      st.cluster.setDistance(nowIcon ? 0 : st.cfg.clusterDistance);
    }
  });
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
  const cfg = MODES[currentMode];
  const props = station.getProperties();
  const name = pick(props, cfg.nameKeys);
  const cap  = pick(props, cfg.capKeys);
  let html;
  if (name === null && cap === null) {
    // Attributnamen nicht erkannt: alle Attribute anzeigen
    html = Object.keys(props).filter(function (k) { return k !== 'geometry'; })
      .map(function (k) { return esc(k) + ': ' + esc(props[k]); }).join('<br>');
  } else {
    html = '<b>' + esc(name !== null ? name : '(no name)') + '</b>';
    if (cfg.capKeys.length) {
      html += '<br>Capacity: ' + (cap !== null ? esc(cap) + ' bikes' : '–');
    }
  }
  if (currentScenario !== 'none') {
    html += isAffectedIn(currentMode, currentScenario, station)
      ? '<br><span style="color:#4b4747"><b>Inside 100 m flood buffer (' +
        SCENARIO_SHORT[currentScenario] + ')</b></span>'
      : '<br>Outside flood buffer (' + SCENARIO_SHORT[currentScenario] + ')';
  }
  return html;
}

function onStationLayer(layer) {
  return Object.keys(M).some(function (k) { return M[k].layer === layer; });
}

map.on('singleclick', function (evt) {
  const hit = map.forEachFeatureAtPixel(evt.pixel, function (f) { return f; },
    { layerFilter: onStationLayer, hitTolerance: 4 });

  if (!hit) { popup.setPosition(undefined); return; }

  const members = hit.get('features');

  // Cluster in der Uebersicht: hineinzoomen statt Popup
  if (members.length > 1 && map.getView().getZoom() < M[currentMode].cfg.zoomIcon) {
    const extent = ol.extent.createEmpty();
    members.forEach(function (m) { ol.extent.extend(extent, m.getGeometry().getExtent()); });
    map.getView().fit(extent, {
      duration: 300,
      padding: [80, 80, 80, 80],
      maxZoom: M[currentMode].cfg.zoomIcon + 1
    });
    return;
  }

  popupContent.innerHTML = members.map(describe).join('<hr>');
  popup.setPosition(hit.getGeometry().getCoordinates());
});

map.on('pointermove', function (e) {
  map.getTargetElement().style.cursor =
    map.hasFeatureAtPixel(e.pixel, { layerFilter: onStationLayer }) ? 'pointer' : '';
});

// =====================================================================
// 4. Legende
// =====================================================================
const legendEl = document.getElementById('legend');

function swatch(color, shape, extraClass, borderColor) {
  return '<span class="dot ' + (shape === 'square' ? 'dot-square ' : '') + (extraClass || '') +
    '" style="background:' + color + (borderColor ? ';border-color:' + borderColor : '') + '"></span>';
}

function updateLegend() {
  const cfg = MODES[currentMode];
  const scn = currentScenario;
  let html = '<b>' + cfg.label + '</b><br>' +
    swatch(cfg.color, cfg.shape) + ' ' + cfg.singular + '<br>';

  if (cfg.majorStopPattern) {
    html += swatch(cfg.majorStopColor || cfg.color, cfg.shape, 'dot-major') +
      ' Main bus hubs<br>';
  }

  if (scn !== 'none') {
    html += swatch(cfg.affectedColor, cfg.shape) + ' Inside 100 m flood buffer<br>' +
      '<span class="unavailable-mark" aria-hidden="true">×</span> Station not accessible<br>' +
      swatch(cfg.color, 'round', 'dot-ring', cfg.affectedColor) + ' Group incl. affected ' + cfg.noun + '<br>';

    const st = M[currentMode];
    const all = st.source.getFeatures();
    if (all.length) {
      let n = 0;
      all.forEach(function (f) { if (isAffectedIn(currentMode, scn, f)) n++; });
      const loaded = st.affected[scn].source.getFeatures().length;
      if (loaded > 0 && n === 0) {
        html += '<small>No ' + cfg.singular.toLowerCase() + ' matched the buffer file (check data / coordinates)</small><br>';
      } else {
        html += '<small>' + n + ' of ' + all.length + ' ' + cfg.noun + ' affected (' + SCENARIO_SHORT[scn] + ')</small><br>';
      }
    }

    html += '<br><b>Flood depth</b> <small>(' + SCENARIO_SHORT[scn] + ')</small><br>' +
            '<img src="' + legendUrl(FLOOD_CFG.legend) + '" alt="Flood depth legend"><br>';
    html += '<br><b>Road network risk</b> <small>(' + SCENARIO_SHORT[scn] + ')</small><br>' +
      Object.keys(ROAD_COLORS).reverse().map(function (riskClass) {
        return '<span class="line-swatch" style="background:' + ROAD_COLORS[riskClass] +
          '"></span> Risk class ' + riskClass + '<br>';
      }).join('');
  }
  legendEl.innerHTML = html;
}

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
// 6. Stationssuche (sucht im gerade gewaehlten Modus)
// =====================================================================
const searchInput = document.getElementById('station-search');
const searchList  = document.getElementById('station-list');
const searchMsg   = document.getElementById('search-msg');

function stationName(f) {
  const n = pick(f.getProperties(), MODES[currentMode].nameKeys);
  return n === null ? '' : String(n);
}

function fillStationList() {
  const names = M[currentMode].source.getFeatures().map(stationName).filter(Boolean)
    .filter(function (n, i, a) { return a.indexOf(n) === i; })
    .sort(function (a, b) { return a.localeCompare(b); });
  searchList.innerHTML = names.map(function (n) {
    return '<option value="' + esc(n) + '"></option>';
  }).join('');
  searchInput.placeholder = 'Search ' + MODES[currentMode].singular.toLowerCase() + '…';
}

// Exakter Treffer zuerst, sonst erster Teiltreffer (Gross-/Kleinschreibung egal)
function findStation(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const all = M[currentMode].source.getFeatures();
  return all.find(function (f) { return stationName(f).toLowerCase() === q; }) ||
         all.find(function (f) { return stationName(f).toLowerCase().indexOf(q) !== -1; }) ||
         null;
}

function showStation(station) {
  const coord = station.getGeometry().getCoordinates();
  const view = map.getView();
  view.animate(
    { center: coord, zoom: Math.max(view.getZoom(), M[currentMode].cfg.zoomIcon + 1), duration: 600 },
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
    searchMsg.textContent = 'Nothing found';
    return;
  }
  searchMsg.textContent = '';
  showStation(station);
});

searchInput.addEventListener('input', function () { searchMsg.textContent = ''; });

// =====================================================================
// 7. Steuerung: Modus (Bikes / Bus) und Klimaszenario
// =====================================================================
function setMode(mode) {
  currentMode = mode;
  Object.keys(M).forEach(function (k) { M[k].layer.setVisible(k === mode); });
  popup.setPosition(undefined);
  searchInput.value = '';
  searchMsg.textContent = '';
  fillStationList();
  updateLegend();
}

function setScenario(scn) {
  currentScenario = scn;
  const on = scn !== 'none';
  if (on) floodLayer.setSource(makeSource(FLOOD_CFG[scn]));
  floodLayer.setVisible(on);
  Object.keys(roadLayers).forEach(function (k) {
    roadLayers[k].setVisible(on && k === scn);
  });
  popup.setPosition(undefined);
  refreshStations();
}

document.querySelectorAll('input[name="mode"]').forEach(function (el) {
  el.addEventListener('change', function (e) { setMode(e.target.value); });
});

document.querySelectorAll('input[name="rcp"]').forEach(function (el) {
  el.addEventListener('change', function (e) { setScenario(e.target.value); });
});

// Startzustand aus dem HTML uebernehmen
const startMode = document.querySelector('input[name="mode"]:checked');
const startRcp  = document.querySelector('input[name="rcp"]:checked');
setMode(startMode ? startMode.value : 'bikes');
setScenario(startRcp ? startRcp.value : 'none');