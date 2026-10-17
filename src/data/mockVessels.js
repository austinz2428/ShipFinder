import { generateGlobalFleet } from './globalFleetGenerator';

export const CHOKEPOINTS = [
  { id: 'us_great_lakes', name: 'US Great Lakes / Sam Laud', region: 'North America', lat: 44.62, lon: -86.85, zoom: 7 },
  { id: 'us_mississippi', name: 'Mississippi River Inland', region: 'North America', lat: 35.1, lon: -90.0, zoom: 6 },
  { id: 'us_gulf', name: 'Gulf of Mexico / Texas', region: 'North America', lat: 27.5, lon: -93.0, zoom: 6 },
  { id: 'transatlantic', name: 'North Atlantic Shipping', region: 'Atlantic', lat: 38.0, lon: -50.0, zoom: 5 },
  { id: 'bosphorus', name: 'Bosphorus Strait', region: 'Black Sea / Marmara', lat: 41.1685, lon: 29.0558, zoom: 12 },
  { id: 'dover', name: 'Dover Strait / English Ch.', region: 'Europe', lat: 51.1245, lon: 1.4580, zoom: 10 },
  { id: 'malacca', name: 'Strait of Malacca / Singapore', region: 'Southeast Asia', lat: 1.2580, lon: 103.8820, zoom: 10 },
  { id: 'gibraltar', name: 'Strait of Gibraltar', region: 'Mediterranean', lat: 35.9850, lon: -5.4520, zoom: 10 },
  { id: 'suez', name: 'Suez Canal', region: 'Red Sea / Med', lat: 29.9800, lon: 32.5600, zoom: 11 },
  { id: 'panama', name: 'Panama Canal', region: 'Central America', lat: 9.0800, lon: -79.6800, zoom: 11 }
];

export const INITIAL_VESSELS = [];

export const INITIAL_ALERTS = [];

