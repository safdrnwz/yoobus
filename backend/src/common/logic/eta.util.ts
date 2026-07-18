// Haversine distance + naive ETA. Production me OSRM/Valhalla swap (self-hosted).
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
}
// avgSpeedKmph default 45 (mixed road)
export function etaMinutes(distanceKm: number, avgSpeedKmph = 45): number {
  if (distanceKm <= 0) return 0;
  return Math.round((distanceKm / avgSpeedKmph) * 60);
}
