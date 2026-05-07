import type { VehicleType } from '@/src/ride/types';

const pricing: Record<VehicleType, { base: number; perKm: number }> = {
  bike: { base: 80, perKm: 35 },
  car: { base: 150, perKm: 55 },
  pickup: { base: 220, perKm: 75 },
  van: { base: 260, perKm: 85 },
};

export function estimateFare(vehicleType: VehicleType, distanceKm: number) {
  const p = pricing[vehicleType];
  return Math.round(p.base + p.perKm * distanceKm);
}
