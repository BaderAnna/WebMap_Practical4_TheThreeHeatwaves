const map = new ol.Map({
  target: 'map',
  layers: [ new ol.layer.Tile({ source: new ol.source.OSM() }) ],
  view: new ol.View({
    center: ol.proj.fromLonLat([22.27, 60.45]), // Turku
    zoom: 11.5
  })
});

const GS    = 'https://geoserver.lounaistieto.fi/geoserver/';
const TULVA = GS + 'tulvamallinnus/ows';
const VESI  = GS + 'vesiensuojelu/ows';

// Pro Thema: welcher Layer gehört zu welchem Szenario?
const THEMES = {
  flood: {
    title: 'Flood depth',
    opacity: 0.7,
    visible: true,
    rcp45: { url: TULVA, layer: 'tulvaveden_syvyys_kohtalaiset_paastot' },
    rcp85: { url: VESI,  layer: 'Veden_syvyys_huletulva_RCP8_5' }
  },
  transport: {
    title: 'Public transport vulnerability',
    opacity: 0.8,
    visible: false,
    rcp45: { url: TULVA, layer: 'Joukkoliikenne_haavoittuvuus_kohtalaiset_paastot' },
    rcp85: { url: TULVA, layer: 'joukkoliikenne_haavoittuvuus_korkeat_paastot' }
  },
  roads: {
    title: 'Road network vulnerability',
    opacity: 0.8,
    visible: false,
    rcp45: { url: TULVA, layer: 'tieverkosto_haavoittuvuus_kohtalaiset_paastot' },
    rcp85: { url: TULVA, layer: 'tieverkosto_haavoittuvuus_korkeat_paastot' }
  }
};

let currentRcp = 'rcp45';
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
    visible: t.visible,
    source: makeSource(t[currentRcp])
  });
  map.addLayer(olLayers[key]);
});

function legendUrl(cfg) {
  return cfg.url +
    '?service=WMS&version=1.3.0&request=GetLegendGraphic&format=image/png&layer=' +
    encodeURIComponent(cfg.layer);
}

function updateLegend() {
  let html = '';
  Object.keys(THEMES).forEach(function (key) {
    if (olLayers[key].getVisible()) {
      html += '<b>' + THEMES[key].title + '</b><br>' +
              '<img src="' + legendUrl(THEMES[key][currentRcp]) + '" alt="Legend"><br><br>';
    }
  });
  document.getElementById('legend').innerHTML = html;
  document.getElementById('legend').style.display = html ? 'block' : 'none';
}

function setScenario(rcp) {
  currentRcp = rcp;
  Object.keys(THEMES).forEach(function (key) {
    olLayers[key].setSource(makeSource(THEMES[key][rcp]));
  });
  updateLegend();
}

// Szenario-Umschalter (Radio-Buttons)
document.querySelectorAll('input[name="rcp"]').forEach(function (el) {
  el.addEventListener('change', function (e) { setScenario(e.target.value); });
});

// Layer an/aus (Checkboxen)
document.querySelectorAll('input[data-layer]').forEach(function (el) {
  el.addEventListener('change', function (e) {
    olLayers[e.target.dataset.layer].setVisible(e.target.checked);
    updateLegend();
  });
});

updateLegend();

// Donkey Bike Stations
// ---------- Einstellungen ----------
const DONKEY_ORANGE   = '#f7711e'; // PLATZHALTER: durch das Orange der Donkey-Webseite ersetzen
const ZOOM_ICON       = 14;        // ab diesem Zoom: Fahrradsymbole, darunter: Cluster
const CLUSTER_DISTANCE = 50;       // Pixelabstand zum Zusammenfassen
const GEOJSON_URL = 'https://raw.githubusercontent.com/BaderAnna/WebMap_Practical4_TheThreeHeatwaves/main/data/donkey_bike_stations_WGS84.geojson';

// Mögliche Attributnamen (der erste vorhandene wird genommen)
const NAME_KEYS = ['name'];
const CAP_KEYS  = ['capacity'];

// ---------- Fahrradsymbol (einfaches, selbst gezeichnetes SVG) ----------
const bikeSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
  '<circle cx="16" cy="16" r="15" fill="' + DONKEY_ORANGE + '" stroke="white" stroke-width="2"/>' +
  '<g fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="10" cy="21" r="4.2"/><circle cx="22" cy="21" r="4.2"/>' +
  '<polyline points="10,21 16,21 13,13 20,14 16,21"/>' +
  '<polyline points="20,14 22,21"/>' +
  '<polyline points="19,11 20,14"/><polyline points="19,11 22,11"/>' +
  '<polyline points="11.5,12.5 14.5,12.5"/>' +
  '</g></svg>';
const BIKE_ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(bikeSvg);

// ---------- Quellen ----------
const vectorSource = new ol.source.Vector({
  url: GEOJSON_URL,
  format: new ol.format.GeoJSON()
});

// Hilfe beim Finden der Attributnamen: erscheint in der Konsole (F12)
vectorSource.on('featuresloadend', function (e) {
  if (e.features.length) console.log('Example station properties:', e.features[0].getProperties());
});

const clusterSource = new ol.source.Cluster({
  distance: CLUSTER_DISTANCE,
  source: vectorSource
});

// ---------- Styles (gecacht, damit es flüssig bleibt) ----------
let iconMode = false;
const styleCache = {};

const iconStyle = new ol.style.Style({
  image: new ol.style.Icon({ src: BIKE_ICON })
});

function clusterStyle(size) {
  if (!styleCache[size]) {
    const radius = Math.min(12 + Math.sqrt(size) * 4, 40); // Größe nach Anzahl
    styleCache[size] = new ol.style.Style({
      image: new ol.style.Circle({
        radius: radius,
        fill: new ol.style.Fill({ color: DONKEY_ORANGE }),
        stroke: new ol.style.Stroke({ color: 'white', width: 2 })
      }),
      text: new ol.style.Text({
        text: String(size),
        font: 'bold 14px Arial, sans-serif',
        fill: new ol.style.Fill({ color: '#ffffff' })
      })
    });
  }
  return styleCache[size];
}

function bikeStyle(feature) {
  const size = feature.get('features').length;
  if (iconMode && size === 1) return iconStyle;
  return clusterStyle(size);
}

const bikeLayer = new ol.layer.Vector({
  source: clusterSource,
  style: bikeStyle
});
map.addLayer(bikeLayer);

// Beim Überschreiten der Zoomstufe zwischen Cluster- und Symbolmodus wechseln
map.getView().on('change:resolution', function () {
  const nowIcon = map.getView().getZoom() >= ZOOM_ICON;
  if (nowIcon !== iconMode) {
    iconMode = nowIcon;
    clusterSource.setDistance(iconMode ? 0 : CLUSTER_DISTANCE);
  }
});

// ---------- Popup ----------
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
  if (name === null && cap === null) {
    // Attributnamen nicht erkannt: alle Attribute anzeigen
    return Object.keys(props).filter(function (k) { return k !== 'geometry'; })
      .map(function (k) { return esc(k) + ': ' + esc(props[k]); }).join('<br>');
  }
  return '<b>' + esc(name !== null ? name : '(no name)') + '</b><br>' +
         'Capacity: ' + (cap !== null ? esc(cap) + ' bikes' : '–');
}

function onBikeLayer(layer) { return layer === bikeLayer; }

map.on('singleclick', function (evt) {
  const hit = map.forEachFeatureAtPixel(evt.pixel, function (f) { return f; },
    { layerFilter: onBikeLayer, hitTolerance: 4 });

  if (!hit) { popup.setPosition(undefined); return; }

  const members = hit.get('features');

  // Cluster in der Übersicht: hineinzoomen statt Popup
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