// =========================================================
// MeteoGuard — Clima con GPS (dentro de Historial)
// =========================================================

(function(){
  "use strict";

  var GEO_STORAGE = "meteoguard_geo_clima";
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  var btn = document.getElementById("geoBtn");
  var card = document.getElementById("geoWeather");
  var locEl = document.getElementById("geoLocation");
  var timeEl = document.getElementById("geoTime");
  var iconEl = document.getElementById("geoIcon");
  var tempEl = document.getElementById("geoTemp");
  var descEl = document.getElementById("geoDesc");
  var feelsEl = document.getElementById("geoFeels");
  var humEl = document.getElementById("geoHumidity");
  var windEl = document.getElementById("geoWind");
  var refreshBtn = document.getElementById("geoRefresh");
  var srcEl = document.getElementById("geoSource");

  var weatherMap = [
    { codes: [0], icon: "☀️", text: "Despejado" },
    { codes: [1, 2], icon: "🌤️", text: "Parcialmente nublado" },
    { codes: [3], icon: "☁️", text: "Nublado" },
    { codes: [45, 48], icon: "🌫️", text: "Niebla" },
    { codes: [51, 53, 55, 56, 57], icon: "🌦️", text: "Llovizna" },
    { codes: [61, 63, 65, 66, 67], icon: "🌧️", text: "Lluvia" },
    { codes: [71, 73, 75, 77], icon: "🌨️", text: "Nieve" },
    { codes: [80, 81, 82], icon: "🌦️", text: "Chubascos" },
    { codes: [85, 86], icon: "🌨️", text: "Chubascos de nieve" },
    { codes: [95, 96, 99], icon: "⛈️", text: "Tormenta eléctrica" }
  ];

  function getInfo(code){
    var c = Number(code);
    for (var i=0;i<weatherMap.length;i++) if (weatherMap[i].codes.indexOf(c)!==-1) return weatherMap[i];
    return {icon:"🌡️", text:"Condiciones variables"};
  }

  function save(d){ try{ localStorage.setItem(GEO_STORAGE, JSON.stringify(d)); }catch(e){} }
  function load(){ try{ var x=JSON.parse(localStorage.getItem(GEO_STORAGE)); return x||null; }catch(e){return null;} }

  function render(data){
    var info = getInfo(data.code);
    locEl.textContent = data.place || "Mi ubicación";
    timeEl.textContent = "Actualizado: " + new Date(data.updated).toLocaleString("es-CL");
    iconEl.textContent = info.icon;
    tempEl.textContent = Math.round(data.temp) + "°C";
    descEl.textContent = info.text;
    feelsEl.textContent = Math.round(data.feels) + " °C";
    humEl.textContent = data.humidity + " %";
    windEl.textContent = Math.round(data.wind) + " km/h";
    card.hidden = false;
    srcEl.hidden = false;
    if (btn) btn.textContent = "Actualizar ubicación";
  }

  async function getPlace(lat,lng){
    try {
      var url = NOMINATIM_URL + "?format=json&lat=" + lat + "&lon=" + lng + "&zoom=18&addressdetails=1&accept-language=es";
      var r = await fetch(url, { headers: { "Accept": "application/json" } });
      if(!r.ok) throw new Error("geo");
      var j = await r.json();
      var a = j.address || {};
      var place = a.city || a.town || a.village || a.municipality || a.hamlet || a.county || j.display_name.split(",")[0];
      if (a.country) place = place + ", " + a.country;
      return place || (lat.toFixed(3)+", "+lng.toFixed(3));
    } catch(e){
      return lat.toFixed(3)+", "+lng.toFixed(3);
    }
  }

  async function getWeather(lat,lng){
    var params = [
      "latitude=" + lat,
      "longitude=" + lng,
      "current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
      "timezone=auto"
    ];
    var url = FORECAST_URL + "?" + params.join("&");
    var r = await fetch(url);
    if(!r.ok) throw new Error("wx");
    return r.json();
  }

  function run(){
    if(!navigator.geolocation){
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    if(btn){ btn.disabled = true; btn.textContent = "Obteniendo ubicación..."; }
    navigator.geolocation.getCurrentPosition(async function(pos){
      try {
        var lat = pos.coords.latitude, lng = pos.coords.longitude;
        var place = await getPlace(lat,lng);
        var wx = await getWeather(lat,lng);
        var cur = wx.current;
        var data = {
          place: place,
          temp: cur.temperature_2m,
          feels: cur.apparent_temperature,
          humidity: cur.relative_humidity_2m,
          wind: cur.wind_speed_10m,
          code: cur.weather_code,
          updated: Date.now(),
          lat: lat, lng: lng
        };
        save(data);
        render(data);
      } catch(e){
        alert("No se pudo obtener el clima con tu ubicación. Prueba en Clima por ciudad.");
      } finally {
        if(btn){ btn.disabled = false; if(!card.hidden) btn.textContent = "Actualizar ubicación"; else btn.textContent = "Usar mi ubicación"; }
      }
    }, function(err){
      if(btn){ btn.disabled = false; btn.textContent = "Usar mi ubicación"; }
      if(err.code === 1) alert("Permiso denegado. Puedes buscar la ciudad manualmente en la sección Clima por ciudad.");
      else alert("No se pudo obtener tu ubicación. Activa el GPS y vuelve a intentarlo.");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }

  if(btn) btn.addEventListener("click", run);
  if(refreshBtn) refreshBtn.addEventListener("click", run);

  document.addEventListener("DOMContentLoaded", function(){
    var d = load();
    if(d){ render(d); if(btn) btn.textContent = "Actualizar ubicación"; }
  });
})();
// Home geo
(function(){
  "use strict";
  var NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  var locEl = document.getElementById("homeGeoLoc");
  var tempEl = document.getElementById("homeGeoTemp");
  var humEl = document.getElementById("homeGeoHum");
  var feelsEl = document.getElementById("homeGeoFeels");
  var noteEl = document.getElementById("homeGeoNote");
  var card = document.getElementById("homeGeoCard");

  async function getPlace(lat,lng){
    try{
      var u=NOMINATIM_URL+"?format=json&lat="+lat+"&lon="+lng+"&zoom=18&addressdetails=1&accept-language=es";
      var r=await fetch(u);
      if(!r.ok) throw new Error();
      var j=await r.json(); var a=j.address||{};
      var p=a.city||a.town||a.village||a.municipality||a.hamlet||a.county||(j.display_name||"").split(",")[0];
      if(a.country) p+=", "+a.country;
      return p|| (lat.toFixed(3)+", "+lng.toFixed(3));
    }catch(e){return (lat.toFixed(3)+", "+lng.toFixed(3));}
  }
  async function getWx(lat,lng){
    var u=FORECAST_URL+"?latitude="+lat+"&longitude="+lng+"&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code&timezone=auto";
    var r=await fetch(u); if(!r.ok) throw new Error(); return r.json();
  }
  function render(d){ if(!d) return;
    if(locEl) locEl.textContent = d.place||"Tu ubicación";
    if(tempEl) tempEl.innerHTML = Math.round(d.temp)+"<small>°C</small>";
    if(humEl) humEl.innerHTML = d.hum+"<small>%</small>";
    if(feelsEl) feelsEl.textContent = Math.round(d.feels)+" °C";
    if(noteEl) noteEl.textContent = "Actualizado: "+new Date(d.updated).toLocaleTimeString("es-CL",{hour12:false});
  }
  function run(){
    if(!navigator.geolocation){ if(noteEl) noteEl.textContent="Geolocalización no soportada"; return; }
    if(noteEl) noteEl.textContent="Obteniendo ubicación...";
    navigator.geolocation.getCurrentPosition(async p=>{
      try{
        var lat=p.coords.latitude,lng=p.coords.longitude;
        var pl=await getPlace(lat,lng);
        var w=await getWx(lat,lng);
        var c=w.current;
        var data={place:pl,temp:c.temperature_2m,hum:c.relative_humidity_2m,feels:c.apparent_temperature,updated:Date.now()};
        render(data);
        try{ localStorage.setItem("meteoguard_home_geo", JSON.stringify(data)); }catch(e){}
      }catch(e){ if(noteEl) noteEl.textContent="No se pudo obtener clima de tu ubicación"; }
    }, err=>{
      if(noteEl) noteEl.textContent=(err.code===1?"Permiso denegado":"GPS no disponible");
    }, {enableHighAccuracy:true,timeout:8000,maximumAge:0});
  }
  document.addEventListener("DOMContentLoaded", function(){
    try{ var s=JSON.parse(localStorage.getItem("meteoguard_home_geo")); if(s){ render(s); } }catch(e){}
    run();
  });
})();
