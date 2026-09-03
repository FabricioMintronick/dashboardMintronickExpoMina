'use strict';

// La traslación ocurre en el servidor: latPublica=latReal+latOffset y
// lonPublica=lonReal+lonOffset. Un único desplazamiento conserva la forma de
// recorridos y agrupaciones sin entregar el emplazamiento real al navegador.
function offsetLocation(point,gateway,enabled=true,latOffset=.75,lonOffset=.75){
  if(!enabled||!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lon))return point;
  const lat=point.lat+latOffset,lon=point.lon+lonOffset;
  return Math.abs(lat)<=90&&Math.abs(lon)<=180?{...point,lat,lon}:point;
}
module.exports={offsetLocation};
