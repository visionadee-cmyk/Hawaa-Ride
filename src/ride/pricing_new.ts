import type { LatLng } from '@/src/utils/geo';
import type { VehicleType } from './types';

type Zone = 'male' | 'airport' | 'hulhumale_p1' | 'hulhumale_p2' | 'unknown';

const ZONES: Record<Exclude<Zone, 'unknown'>, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  male: { minLat: 4.165, maxLat: 4.185, minLng: 73.485, maxLng: 73.525 },
  airport: { minLat: 4.190, maxLat: 4.200, minLng: 73.520, maxLng: 73.540 },
  hulhumale_p1: { minLat: 4.205, maxLat: 4.225, minLng: 73.525, maxLng: 73.555 },
  hulhumale_p2: { minLat: 4.225, maxLat: 4.245, minLng: 73.525, maxLng: 73.555 },
};

export function getZone(latlng: LatLng): Zone {
  for (const [zone, b] of Object.entries(ZONES)) {
    if (latlng.latitude >= b.minLat && latlng.latitude <= b.maxLat &&
        latlng.longitude >= b.minLng && latlng.longitude <= b.maxLng) {
      return zone as Zone;
    }
  }
  return 'unknown';
}

// Government fare table (MVR) - November 2024
const FARE_TABLE: Record<string, Record<'motorcycle' | 'under6' | 'over6', number>> = {
  // Airport routes
  airport_male: { motorcycle: 40, under6: 70, over6: 110 },
  male_airport: { motorcycle: 40, under6: 70, over6: 110 },
  airport_hulhumale_p1: { motorcycle: 50, under6: 80, over6: 125 },
  hulhumale_p1_airport: { motorcycle: 50, under6: 80, over6: 125 },
  airport_hulhumale_p2: { motorcycle: 50, under6: 85, over6: 130 },
  hulhumale_p2_airport: { motorcycle: 50, under6: 85, over6: 130 },
  // Between areas
  male_hulhumale_p1: { motorcycle: 50, under6: 85, over6: 130 },
  hulhumale_p1_male: { motorcycle: 50, under6: 85, over6: 130 },
  male_hulhumale_p2: { motorcycle: 60, under6: 100, over6: 155 },
  hulhumale_p2_male: { motorcycle: 60, under6: 100, over6: 155 },
  hulhumale_p1_hulhumale_p2: { motorcycle: 20, under6: 40, over6: 60 },
  hulhumale_p2_hulhumale_p1: { motorcycle: 20, under6: 40, over6: 60 },
};

// Within zone fares (Male, Hulhumale Phase 1, Hulhumale Phase 2)
const WITHIN_ZONE_FARE: Record<'motorcycle' | 'under6' | 'over6', number> = {
  motorcycle: 15,
  under6: 30,
  over6: 45,
};

function mapVehicleToGovType(v: VehicleType): 'motorcycle' | 'under6' | 'over6' {
  if (v === 'bike') return 'motorcycle';
  if (v === 'van') return 'over6';
  return 'under6';
}

const DISTANCE_PRICING: Record<VehicleType, { base: number; perKm: number }> = {
  bike: { base: 80, perKm: 35 },
  car: { base: 150, perKm: 55 },
  pickup: { base: 220, perKm: 75 },
  van: { base: 260, perKm: 85 },
};

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const aa = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

export function estimateFareByRoute(v: VehicleType, pickup: LatLng, dropoff: LatLng): number {
  const from = getZone(pickup);
  const to = getZone(dropoff);
  const govType = mapVehicleToGovType(v);

  // Within same zone (Male, Hulhumale Phase 1, or Phase 2)
  if (from !== 'unknown' && to !== 'unknown' && from === to) {
    return WITHIN_ZONE_FARE[govType];
  }

  // Between different zones
  if (from !== 'unknown' && to !== 'unknown' && from !== to) {
    const key = `${from}_${to}` as keyof typeof FARE_TABLE;
    const fare = FARE_TABLE[key]?.[govType];
    if (fare) return fare;
  }

  // Fallback to distance pricing for unknown zones
  const km = haversineKm(pickup, dropoff);
  const p = DISTANCE_PRICING[v];
  return Math.round(p.base + p.perKm * km);
}

export function estimateFare(v: VehicleType, km: number): number {
  const p = DISTANCE_PRICING[v];
  return Math.round(p.base + p.perKm * km);
}
