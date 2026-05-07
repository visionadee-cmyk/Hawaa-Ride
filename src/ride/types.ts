import type { LatLng } from '@/src/utils/geo';

export type VehicleType = 'bike' | 'car' | 'pickup' | 'van';

export type ServiceType = 'ride' | 'delivery';

export type RideStatus =
  | 'searching'
  | 'driver_assigned'
  | 'driver_arriving'
  | 'trip_started'
  | 'trip_completed'
  | 'cancelled';

export type RideDoc = {
  riderId: string;
  riderName?: string | null;
  riderPhone?: string | null;
  driverId: string | null;
  vehicleType: VehicleType;
  status: RideStatus;
  pickup: LatLng;
  dropoff: LatLng;
  estimatedDistanceKm: number;
  estimatedFare: number;
  pickupName?: string | null;
  dropoffName?: string | null;
  waypoints?: LatLng[] | null;
  waypointNames?: string[] | null;
  stopsCount?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type DriverProfile = {
  uid: string;
  name: string;
  phoneNumber: string | null;
  licenseNumber: string;
  vehicleType: VehicleType;
  vehicleDetails: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  online: boolean;
  notificationRangeKm: number;
  lastLocation?: LatLng;
  updatedAt?: unknown;
  createdAt?: unknown;
};
