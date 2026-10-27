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