// Cobe uses an orthographic sphere with radius 0.8 in clip space.
export const COUNTRY_LOCATIONS = [
  [37.77, -122.42], // San Francisco
  [51.51, -0.12],   // London
  [1.35, 103.82],   // Singapore
  [40.42, -3.70],   // Madrid
  [35.68, 139.69],  // Tokyo
  [-23.55, -46.63], // São Paulo
  [-33.87, 151.21], // Sydney
  [52.52, 13.405],  // Berlin
];
export function locationVector([latitude, longitude]) {
  const lat = latitude * Math.PI / 180;
  const lon = longitude * Math.PI / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
}
export function projectVector([x, y, z], phi, theta = 0.22) {
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const screenX = cosP * x + sinP * z;
  const screenY = sinP * sinT * x + cosT * y - cosP * sinT * z;
  const depth = -sinP * cosT * x + sinT * y + cosP * cosT * z;
  return { x: 0.5 + screenX * 0.4, y: 0.5 - screenY * 0.4, depth, visible: depth > 0.025 };
}
