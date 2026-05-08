import { MapView, Marker, Polyline } from '@/src/components/Map';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, FlatList, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/src/auth/AuthContext';
import { db } from '@/src/firebase';
import { estimateFareByRoute } from '@/src/ride/pricing_new';
import type { ServiceType, VehicleType } from '@/src/ride/types';
import type { LatLng } from '@/src/utils/geo';
import { haversineKm } from '@/src/utils/geo';

export default function RiderHome() {
  const router = useRouter();
  const { firebaseUser, logout } = useAuth();

  const mapRef = useRef<MapView | null>(null);

  const NEARBY_RADIUS_KM = 5;
  const nearbyDelta = useMemo(() => {
    // 1 degree latitude ~= 111km. We want ~2 * radius visible (diameter).
    const diameterKm = NEARBY_RADIUS_KM * 2;
    const delta = Math.max(0.02, diameterKm / 111);
    return { latitudeDelta: delta, longitudeDelta: delta };
  }, []);

  const [pickup, setPickup] = useState<LatLng | null>(null);
  const [dropoff, setDropoff] = useState<LatLng | null>(null);
  const [waypoints, setWaypoints] = useState<Array<{ name: string; latlng: LatLng }>>([]);
  const [currentLocation, setCurrentLocation] = useState<LatLng | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [serviceType, setServiceType] = useState<ServiceType>('ride');
  const [rideTab, setRideTab] = useState<'ride' | 'delivery' | 'prebook'>('ride');
  const [prebookDate, setPrebookDate] = useState('');
  const [prebookTime, setPrebookTime] = useState('');

  const [deliveryType, setDeliveryType] = useState<'boxes' | 'parcels' | 'boat' | 'other'>('parcels');
  const [packageCount, setPackageCount] = useState('1');
  const [arrivalTime, setArrivalTime] = useState('');
  const [jettyName, setJettyName] = useState('');

  const [pickupQuery, setPickupQuery] = useState('');
  const [dropoffQuery, setDropoffQuery] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);

  const [pickupSuggestions, setPickupSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [dropoffSuggestions, setDropoffSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [waypointSuggestions, setWaypointSuggestions] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [waypointQuery, setWaypointQuery] = useState('');
  const [activeWaypointIndex, setActiveWaypointIndex] = useState<number | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [activeRide, setActiveRide] = useState<{ id: string; status: string; pickupName?: string; dropoffName?: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  const RECENT_PLACES = [
    { name: 'Home', icon: '🏠', lat: 4.1755, lng: 73.5093 },
    { name: 'Work', icon: '🏢', lat: 4.2105, lng: 73.5318 },
    { name: 'Airport', icon: '✈️', lat: 4.2168, lng: 73.5434 },
    { name: 'IGMH', icon: '🏥', lat: 4.1745, lng: 73.5108 },
  ];

  const fetchCurrentLocation = async (): Promise<LatLng | null> => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos.coords),
            (err) => reject(err),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        });
        return { latitude: coords.latitude, longitude: coords.longitude };
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    } catch {
      try {
        const last = await Location.getLastKnownPositionAsync({});
        if (!last) return null;
        return { latitude: last.coords.latitude, longitude: last.coords.longitude };
      } catch {
        return null;
      }
    }
  };

  useEffect(() => {
    (async () => {
      const next = await fetchCurrentLocation();
      if (!next) return;
      setCurrentLocation(next);
      setPickup(next);
    })();
  }, []);

  // Track rider's active ride
  useEffect(() => {
    if (!firebaseUser) {
      setActiveRide(null);
      return;
    }
    const q = query(collection(db, 'rides'), where('riderId', '==', firebaseUser.uid));
    const unsub = onSnapshot(q, (snap: any) => {
      let found: any = null;
      snap.forEach((d: any) => {
        const data = d.data();
        if (data.status === 'searching' || data.status === 'driver_assigned' || 
            data.status === 'driver_arriving' || data.status === 'trip_started') {
          found = { id: d.id, status: data.status, pickupName: data.pickupName, dropoffName: data.dropoffName };
        }
      });
      setActiveRide(found);
    });
    return unsub;
  }, [firebaseUser]);

  // Refresh active ride when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (!firebaseUser) return;
      const q = query(collection(db, 'rides'), where('riderId', '==', firebaseUser.uid));
      const unsub = onSnapshot(q, (snap: any) => {
        let found: any = null;
        snap.forEach((d: any) => {
          const data = d.data();
          if (data.status === 'searching' || data.status === 'driver_assigned' || 
              data.status === 'driver_arriving' || data.status === 'trip_started') {
            found = { id: d.id, status: data.status, pickupName: data.pickupName, dropoffName: data.dropoffName };
          }
        });
        setActiveRide(found);
      });
      return unsub;
    }, [firebaseUser])
  );

  useEffect(() => {
    if (!mapReady) return;
    if (!currentLocation) return;
    mapRef.current?.animateToRegion({
      ...currentLocation,
      ...nearbyDelta,
    });
  }, [mapReady, currentLocation, nearbyDelta]);

  const recenterToCurrentLocation = async () => {
    const next = await fetchCurrentLocation();
    if (!next) return;
    setCurrentLocation(next);
    mapRef.current?.animateToRegion({ ...next, ...nearbyDelta });
  };

  const geocodePlace = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return null;
    setGeoLoading(true);
    try {
      const results = await Location.geocodeAsync(trimmed);
      if (!results.length) return null;
      const first = results[0];
      return { latitude: first.latitude, longitude: first.longitude } as LatLng;
    } finally {
      setGeoLoading(false);
    }
  };

  const setPickupFromQuery = async () => {
    const p = await geocodePlace(pickupQuery);
    if (!p) return;
    setPickup(p);
  };

  const setDropoffFromQuery = async () => {
    const d = await geocodePlace(dropoffQuery);
    if (!d) return;
    setDropoff(d);
  };

  // Common Maldives locations as fallback
  const commonPlaces = [
    { name: 'Male, Maldives', lat: 4.1755, lng: 73.5093 },
    { name: 'Hulhumale, Maldives', lat: 4.2105, lng: 73.5318 },
    { name: 'Velana International Airport', lat: 4.2168, lng: 73.5434 },
    { name: 'Ibrahim Nasir International Airport', lat: 4.2168, lng: 73.5434 },
    { name: 'IGMH - Indira Gandhi Memorial Hospital', lat: 4.1745, lng: 73.5108 },
    { name: 'ADK Hospital', lat: 4.1675, lng: 73.5135 },
    { name: 'Tree Top Hospital', lat: 4.2285, lng: 73.5562 },
    { name: 'Hulhumale Hospital', lat: 4.2108, lng: 73.5350 },
    { name: 'National Museum, Male', lat: 4.1812, lng: 73.5098 },
    { name: 'Artificial Beach, Male', lat: 4.1765, lng: 73.5135 },
    { name: 'Sultan Park, Male', lat: 4.1748, lng: 73.5125 },
    { name: 'Majeedhee Magu, Male', lat: 4.1745, lng: 73.5098 },
    { name: 'Chaandhanee Magu, Male', lat: 4.1715, lng: 73.5075 },
    { name: 'Medhuziyyathu Magu, Male', lat: 4.1685, lng: 73.5055 },
    { name: 'Orchid Magu, Male', lat: 4.1655, lng: 73.5035 },
    { name: 'Karankaa Magu, Male', lat: 4.1625, lng: 73.5015 },
    { name: 'Handhuvaree Hingun, Male', lat: 4.1595, lng: 73.4995 },
    { name: 'Ameenee Magu, Male', lat: 4.1565, lng: 73.4975 },
    { name: 'Muli Magu, Male', lat: 4.1535, lng: 73.4955 },
    { name: 'Fares Maafannu, Male', lat: 4.1505, lng: 73.4935 },
    { name: 'Ghiyasuddin Magu, Male', lat: 4.1475, lng: 73.4915 },
    { name: 'Hulhumale Phase 1', lat: 4.2105, lng: 73.5318 },
    { name: 'Hulhumale Phase 2', lat: 4.2285, lng: 73.5562 },
    { name: 'Villimale, Maldives', lat: 4.1625, lng: 73.5215 },
    { name: 'Thilafushi, Maldives', lat: 4.2555, lng: 73.5785 },
    { name: 'Gulhi Falhu, Maldives', lat: 4.0895, lng: 73.4875 },
    { name: 'Villingili, Maldives', lat: 4.1455, lng: 73.5365 },
    { name: 'Kudahuvadhoo, Maldives', lat: 3.2065, lng: 73.0955 },
    { name: 'Mahibadhoo, Maldives', lat: 3.7585, lng: 72.9685 },
    { name: 'Addu City, Maldives', lat: -0.6175, lng: 73.0835 },
    { name: 'Fuvahmulah, Maldives', lat: -0.2995, lng: 73.4245 },
    { name: 'Kobe, Maldives', lat: 4.2215, lng: 73.5425 },
    { name: 'Centra Hotel, Male', lat: 4.1755, lng: 73.5115 },
    { name: 'Hotel Ocean Grand, Male', lat: 4.1765, lng: 73.5125 },
    { name: 'Sun Sand Hotel, Male', lat: 4.1775, lng: 73.5135 },
    { name: 'Maafushi Island', lat: 3.9405, lng: 73.6815 },
    { name: 'Biyadhoo Island', lat: 3.8685, lng: 73.5755 },
    { name: 'South Male Atoll', lat: 4.0525, lng: 73.6215 },
    { name: 'North Male Atoll', lat: 4.3525, lng: 73.5215 },
    { name: 'Baa Atoll', lat: 5.1025, lng: 73.0515 },
    { name: 'Alif Atoll', lat: 4.3525, lng: 73.6215 },
    { name: 'Dhaalu Atoll', lat: 4.8525, lng: 73.2515 },
    { name: 'Laamu Atoll', lat: 4.8525, lng: 73.0515 },
    { name: 'Seenu Atoll', lat: -0.6175, lng: 73.0835 },
    { name: 'Gnaviyani Atoll', lat: -0.2995, lng: 73.4245 },
    { name: 'Faafu Atoll', lat: 3.3525, lng: 73.2515 },
    { name: 'Dhaalu Atoll', lat: 4.8525, lng: 73.2515 },
    { name: 'Thoddoo Island', lat: 4.4525, lng: 73.4515 },
    { name: 'Rasdhoo Island', lat: 4.3525, lng: 73.6515 },
    { name: 'Ukulhas Island', lat: 4.3025, lng: 73.6015 },
    { name: 'Mathiveri Island', lat: 4.3525, lng: 73.5515 },
  ];
  
  const nominatimSearch = async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed || trimmed.length < 1) return [];
    
    // Filter common places by query
    const matched = commonPlaces.filter(p => 
      p.name.toLowerCase().includes(trimmed)
    );
    
    if (matched.length > 0) {
      return matched.slice(0, 10);
    }
    
    // If no match, return all places that start with the query
    const startsWith = commonPlaces.filter(p => 
      p.name.toLowerCase().startsWith(trimmed)
    );
    
    if (startsWith.length > 0) {
      return startsWith.slice(0, 10);
    }
    
    return [];
  };

  useEffect(() => {
    const t = setTimeout(() => {
      nominatimSearch(pickupQuery)
        .then(setPickupSuggestions)
        .catch(() => setPickupSuggestions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [pickupQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      nominatimSearch(dropoffQuery)
        .then(setDropoffSuggestions)
        .catch(() => setDropoffSuggestions([]));
    }, 350);
    return () => clearTimeout(t);
  }, [dropoffQuery]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (activeWaypointIndex !== null && waypointQuery.trim().length >= 1) {
        nominatimSearch(waypointQuery)
          .then(setWaypointSuggestions)
          .catch(() => setWaypointSuggestions([]));
      } else {
        setWaypointSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [waypointQuery, activeWaypointIndex]);

  // Build route: pickup -> waypoint1 -> waypoint2 -> ... -> dropoff
  const routePoints = useMemo(() => {
    const points: LatLng[] = [];
    if (pickup) points.push(pickup);
    waypoints.forEach(w => points.push(w.latlng));
    if (dropoff) points.push(dropoff);
    return points;
  }, [pickup, waypoints, dropoff]);

  // Calculate total fare for multi-stop route
  const { distanceKm, fare } = useMemo(() => {
    if (routePoints.length < 2) return { distanceKm: 0, fare: 0 };
    
    let totalFare = 0;
    let totalKm = 0;
    
    // Sum fare for each leg of the journey
    for (let i = 0; i < routePoints.length - 1; i++) {
      const legFare = estimateFareByRoute(vehicleType, routePoints[i], routePoints[i + 1]);
      const legKm = haversineKm(routePoints[i], routePoints[i + 1]);
      totalFare += legFare;
      totalKm += legKm;
    }
    
    return { distanceKm: totalKm, fare: totalFare };
  }, [routePoints, vehicleType]);

  const vehicleFares = useMemo(() => {
    if (routePoints.length < 2) return [];
    const vehicles: VehicleType[] = ['car', 'bike', 'pickup', 'van'];
    return vehicles.map((v) => {
      let totalFare = 0;
      for (let i = 0; i < routePoints.length - 1; i++) {
        totalFare += estimateFareByRoute(v, routePoints[i], routePoints[i + 1]);
      }
      return { v, fare: totalFare };
    });
  }, [routePoints]);

  const addWaypoint = () => {
    setWaypoints([...waypoints, { name: '', latlng: { latitude: 0, longitude: 0 } }]);
  };

  const removeWaypoint = (index: number) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const updateWaypoint = (index: number, name: string, latlng: LatLng) => {
    const updated = [...waypoints];
    updated[index] = { name, latlng };
    setWaypoints(updated);
  };

  const requestRide = async () => {
    if (!firebaseUser || !pickup || !dropoff) return;

    const isPrebook = rideTab === 'prebook';
    const effectiveServiceType: ServiceType = rideTab === 'delivery' ? 'delivery' : 'ride';
    if (isPrebook && (!prebookDate || !prebookTime)) return;

    const rideRef = await addDoc(collection(db, 'rides'), {
      riderId: firebaseUser.uid,
      riderName: firebaseUser.displayName || firebaseUser.phoneNumber || 'Rider',
      riderPhone: firebaseUser.phoneNumber || null,
      driverId: null,
      vehicleType,
      serviceType: effectiveServiceType,
      status: 'searching',
      pickup,
      dropoff,
      estimatedDistanceKm: distanceKm,
      estimatedFare: fare,
      isPrebook,
      prebookDate: isPrebook ? prebookDate : null,
      prebookTime: isPrebook ? prebookTime : null,
      deliveryType: effectiveServiceType === 'delivery' ? deliveryType : null,
      packageCount:
        effectiveServiceType === 'delivery' && deliveryType !== 'boat' ? parseInt(packageCount) || 1 : null,
      arrivalTime: effectiveServiceType === 'delivery' && deliveryType === 'boat' ? arrivalTime : null,
      jettyName: effectiveServiceType === 'delivery' && deliveryType === 'boat' ? jettyName : null,
      waypoints: waypoints.length > 0 ? waypoints.map(w => w.latlng) : null,
      waypointNames: waypoints.length > 0 ? waypoints.map(w => w.name) : null,
      stopsCount: waypoints.length + 1,
      pickupName: pickupQuery || null,
      dropoffName: dropoffQuery || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    router.push({ pathname: '/(rider)/ride', params: { id: rideRef.id } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapBg}>
        <MapView
          ref={(r: any) => {
            mapRef.current = r;
          }}
          style={StyleSheet.absoluteFill}
          initialRegion={pickup ? { ...pickup, ...nearbyDelta } : currentLocation ? { ...currentLocation, ...nearbyDelta } : undefined}
          onLongPress={(e: any) => setDropoff(e.nativeEvent.coordinate)}
          onMapReady={() => setMapReady(true)}
          showsUserLocation={true}
          followsUserLocation={true}
        >
          {pickup ? <Marker coordinate={pickup} title="Pickup" pinColor="#4CAF50" /> : null}
          {dropoff ? <Marker coordinate={dropoff} title="Dropoff" pinColor="#f44336" /> : null}
          {currentLocation && !pickup ? (
            <Marker coordinate={currentLocation} title="You are here" pinColor="#2196F3" />
          ) : null}
          {pickup && dropoff ? (
            <Polyline coordinates={[pickup, dropoff]} strokeWidth={4} strokeColor="#4CAF50" />
          ) : null}
        </MapView>

        <Pressable style={styles.myLocationBtn} onPress={recenterToCurrentLocation}>
          <ThemedText style={styles.myLocationText}>📍</ThemedText>
        </Pressable>
      </View>

      <Pressable style={styles.hamburgerBtn} onPress={() => setDrawerOpen(true)}>
        <ThemedText style={styles.hamburgerText}>≡</ThemedText>
      </Pressable>

      <Pressable style={styles.paymentPill} onPress={() => setPaymentMethod(p => p === 'cash' ? 'card' : 'cash')}>
        <ThemedText style={styles.paymentText}>{paymentMethod === 'cash' ? '💵 Cash' : '💳 Card'}</ThemedText>
      </Pressable>

      {activeRide && (
        <View style={styles.activeRideBanner}>
          <ThemedText style={styles.activeRideTitle}>🚗 Driver is on the way</ThemedText>
          <ThemedText style={styles.activeRideSub}>{activeRide.pickupName || 'Pickup location'}</ThemedText>
          <Pressable style={styles.activeRideBtn} onPress={() => router.push({ pathname: '/(rider)/ride', params: { id: activeRide.id } })}>
            <ThemedText style={styles.activeRideBtnText}>View Ride</ThemedText>
          </Pressable>
        </View>
      )}

      <View style={styles.topCard}>
        <ScrollView style={styles.topCardScroll} contentContainerStyle={styles.topCardContent} showsVerticalScrollIndicator={false}>
        <View style={styles.serviceTabs}>
          <Pressable
            style={[styles.serviceTab, rideTab === 'ride' && styles.serviceTabActive]}
            onPress={() => {
              setRideTab('ride');
              setServiceType('ride');
            }}
          >
            <ThemedText style={[styles.serviceTabText, rideTab === 'ride' && styles.serviceTabTextActive]}>
              🚗 Ride
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.serviceTab, rideTab === 'delivery' && styles.serviceTabActive]}
            onPress={() => {
              setRideTab('delivery');
              setServiceType('delivery');
            }}
          >
            <ThemedText style={[styles.serviceTabText, rideTab === 'delivery' && styles.serviceTabTextActive]}>
              📦 Delivery
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.serviceTab, rideTab === 'prebook' && styles.serviceTabActive]}
            onPress={() => {
              setRideTab('prebook');
              setServiceType('ride');
            }}
          >
            <ThemedText style={[styles.serviceTabText, rideTab === 'prebook' && styles.serviceTabTextActive]}>
              📅 Prebook
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.addressCard}>
          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: '#1aa37a' }]}>
              <ThemedText style={styles.addressDotText}>A</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.addressLabel}>Pick-up</ThemedText>
              <TextInput
                placeholder="Set pick-up point"
                value={pickupQuery}
                onChangeText={setPickupQuery}
                style={styles.addressInput}
              />
              {pickupSuggestions.length > 0 && (
                <View style={styles.suggestDropdown}>
                  {pickupSuggestions.map((item, idx) => (
                    <Pressable
                      key={`${item.lat}-${item.lng}-${idx}`}
                      style={styles.suggestItem}
                      onPress={() => {
                        setPickupQuery(item.name);
                        setPickup({ latitude: item.lat, longitude: item.lng });
                        setPickupSuggestions([]);
                      }}
                    >
                      <ThemedText style={styles.suggestText}>📍 {item.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
              {geoLoading && pickupQuery.length >= 2 && (
                <View style={styles.suggestDropdown}>
                  <ThemedText style={styles.suggestText}>🔄 Searching...</ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.addressDivider} />

          <View style={styles.addressRow}>
            <View style={[styles.addressDot, { backgroundColor: '#0f6ad6' }]}>
              <ThemedText style={styles.addressDotText}>B</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.addressLabel}>
                {rideTab === 'delivery' ? 'Delivery destination' : 'Drop-off'}
              </ThemedText>
              <TextInput
                placeholder={rideTab === 'delivery' ? 'Delivery destination' : 'Set drop-off'}
                value={dropoffQuery}
                onChangeText={setDropoffQuery}
                style={styles.addressInput}
              />
              {dropoffSuggestions.length > 0 && (
                <View style={styles.suggestDropdown}>
                  {dropoffSuggestions.map((item, idx) => (
                    <Pressable
                      key={`${item.lat}-${item.lng}-${idx}`}
                      style={styles.suggestItem}
                      onPress={() => {
                        setDropoffQuery(item.name);
                        setDropoff({ latitude: item.lat, longitude: item.lng });
                        setDropoffSuggestions([]);
                      }}
                    >
                      <ThemedText style={styles.suggestText}>📍 {item.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
              {geoLoading && dropoffQuery.length >= 2 && (
                <View style={styles.suggestDropdown}>
                  <ThemedText style={styles.suggestText}>🔄 Searching...</ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Add Stop Button */}
        <Pressable style={styles.addStopBtn} onPress={addWaypoint}>
          <ThemedText style={styles.addStopBtnText}>➕ Add Stop</ThemedText>
        </Pressable>

        {/* Waypoints */}
        {waypoints.map((wp, idx) => {
          const label = String.fromCharCode(67 + idx); // C=67, D=68, E=69...
          return (
          <View key={idx} style={styles.waypointCard}>
            <View style={styles.waypointHeader}>
              <View style={styles.waypointLabelRow}>
                <View style={[styles.addressDot, { backgroundColor: '#f59e0b', width: 24, height: 24 }]}>
                  <ThemedText style={styles.addressDotText}>{label}</ThemedText>
                </View>
                <ThemedText style={styles.waypointLabelText}>Stop {idx + 1}</ThemedText>
              </View>
              <Pressable onPress={() => {
                removeWaypoint(idx);
                setActiveWaypointIndex(null);
                setWaypointQuery('');
              }}>
                <ThemedText style={styles.waypointRemove}>✕</ThemedText>
              </Pressable>
            </View>
            <TextInput
              placeholder={`Enter stop location`}
              value={wp.name}
              onChangeText={(text) => {
                setActiveWaypointIndex(idx);
                setWaypointQuery(text);
                updateWaypoint(idx, text, wp.latlng);
              }}
              onFocus={() => {
                setActiveWaypointIndex(idx);
                setWaypointQuery(wp.name);
              }}
              style={styles.addressInput}
            />
          </View>
          );
        })}

        {/* Waypoint Suggestions - shown below all waypoints */}
        {activeWaypointIndex !== null && waypointSuggestions.length > 0 && (
          <View style={styles.suggestCard}>
            {waypointSuggestions.map((item, sidx) => (
              <Pressable
                key={`wp-sug-${sidx}`}
                style={styles.suggestItem}
                onPress={() => {
                  updateWaypoint(activeWaypointIndex, item.name, { latitude: item.lat, longitude: item.lng });
                  setWaypointQuery(item.name);
                  setWaypointSuggestions([]);
                  setActiveWaypointIndex(null);
                }}
              >
                <ThemedText style={styles.suggestText}>📍 {item.name}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        {pickupSuggestions.length > 0 ? (
          <View style={styles.suggestCard}>
            <FlatList
              data={pickupSuggestions}
              keyExtractor={(i) => `${i.lat},${i.lng},${i.name}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.suggestItem}
                  onPress={() => {
                    setPickupQuery(item.name);
                    setPickup({ latitude: item.lat, longitude: item.lng });
                    setPickupSuggestions([]);
                  }}
                >
                  <ThemedText>{item.name}</ThemedText>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {dropoffSuggestions.length > 0 ? (
          <View style={styles.suggestCard}>
            <FlatList
              data={dropoffSuggestions}
              keyExtractor={(i) => `${i.lat},${i.lng},${i.name}`}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.suggestItem}
                  onPress={() => {
                    setDropoffQuery(item.name);
                    setDropoff({ latitude: item.lat, longitude: item.lng });
                    setDropoffSuggestions([]);
                  }}
                >
                  <ThemedText>{item.name}</ThemedText>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {rideTab === 'delivery' && (
          <View style={styles.deliveryCard}>
            <ThemedText style={styles.deliveryTitle}>📦 Delivery Details</ThemedText>

            <ThemedText style={styles.deliveryLabel}>Delivery Type</ThemedText>
            <View style={styles.deliveryTypeRow}>
              {(['boxes', 'parcels', 'boat', 'other'] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[styles.deliveryTypeBtn, deliveryType === type && styles.deliveryTypeBtnActive]}
                  onPress={() => setDeliveryType(type)}
                >
                  <ThemedText style={[styles.deliveryTypeText, deliveryType === type && styles.deliveryTypeTextActive]}>
                    {type === 'boxes' && '📦'}
                    {type === 'parcels' && '📮'}
                    {type === 'boat' && '🚢'}
                    {type === 'other' && '📋'} {type.charAt(0).toUpperCase() + type.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {deliveryType !== 'boat' && (
              <>
                <ThemedText style={styles.deliveryLabel}>Number of Packages</ThemedText>
                <TextInput
                  placeholder="e.g. 3"
                  value={packageCount}
                  onChangeText={setPackageCount}
                  keyboardType="numeric"
                  style={styles.deliveryInput}
                />
              </>
            )}

            {deliveryType === 'boat' && (
              <>
                <ThemedText style={styles.deliveryLabel}>Arrival Time</ThemedText>
                <TextInput
                  placeholder="e.g. 14:30"
                  value={arrivalTime}
                  onChangeText={setArrivalTime}
                  style={styles.deliveryInput}
                />

                <ThemedText style={styles.deliveryLabel}>Jetty Name</ThemedText>
                <TextInput
                  placeholder="e.g. Karachi Port Trust Jetty"
                  value={jettyName}
                  onChangeText={setJettyName}
                  style={styles.deliveryInput}
                />
              </>
            )}
          </View>
        )}

        {rideTab === 'prebook' && (
          <View style={styles.prebookCard}>
            <View style={styles.prebookHeader}>
              <ThemedText style={styles.prebookTitle}>📅 Schedule Ride</ThemedText>
              <ThemedText style={{ color: '#666' }}>Choose date & time</ThemedText>
            </View>
            <View style={styles.prebookInputs}>
              <View style={styles.prebookField}>
                <ThemedText style={styles.prebookLabel}>Date</ThemedText>
                <TextInput
                  placeholder="DD/MM/YYYY"
                  value={prebookDate}
                  onChangeText={setPrebookDate}
                  style={styles.prebookInput}
                />
              </View>
              <View style={styles.prebookField}>
                <ThemedText style={styles.prebookLabel}>Time</ThemedText>
                <TextInput
                  placeholder="HH:MM"
                  value={prebookTime}
                  onChangeText={setPrebookTime}
                  style={styles.prebookInput}
                />
              </View>
            </View>
            {prebookDate && prebookTime && (
              <View style={styles.prebookSummary}>
                <ThemedText style={styles.prebookSummaryText}>
                  Scheduled for: {prebookDate} at {prebookTime}
                </ThemedText>
              </View>
            )}
          </View>
        )}

        <View style={styles.vehicleCardsRow}>
          {vehicleFares.map(({ v, fare: f }) => (
            <Pressable
              key={v}
              style={[styles.vehicleCard, vehicleType === v && styles.vehicleCardActive]}
              onPress={() => setVehicleType(v)}
            >
              <View style={styles.vehicleIconBox}>
                <ThemedText style={styles.vehicleIcon}>
                  {v === 'bike' ? '🛵' : v === 'car' ? '🚗' : v === 'van' ? '🚐' : '🛻'}
                </ThemedText>
              </View>
              <ThemedText style={[styles.vehicleCardTitle, vehicleType === v && styles.vehicleCardTitleActive]}>
                {v === 'bike' ? 'Bike' : v === 'car' ? 'Car' : v === 'van' ? 'Van' : 'Pickup'}
              </ThemedText>
              <ThemedText style={[styles.vehicleCardPrice, vehicleType === v && styles.vehicleCardPriceActive]}>
                {f} MVR
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {/* Recent places quick select */}
        <View style={styles.recentPlacesRow}>
          {RECENT_PLACES.map((place) => (
            <Pressable
              key={place.name}
              style={styles.recentPlaceChip}
              onPress={() => {
                setDropoffQuery(place.name);
                setDropoff({ latitude: place.lat, longitude: place.lng });
              }}
            >
              <ThemedText style={styles.recentPlaceIcon}>{place.icon}</ThemedText>
              <ThemedText style={styles.recentPlaceName}>{place.name}</ThemedText>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={[styles.primaryBtn, (!pickup || !dropoff || !firebaseUser) && styles.primaryBtnDisabled, activeRide && styles.primaryBtnActiveRide]}
          onPress={activeRide ? () => router.push({ pathname: '/(rider)/ride', params: { id: activeRide.id } }) : requestRide}
          disabled={!pickup || !dropoff || !firebaseUser}
        >
          <ThemedText style={styles.primaryBtnText}>
            {activeRide 
              ? 'View Active Ride' 
              : rideTab === 'delivery' ? 'Book Delivery' : rideTab === 'prebook' ? 'Schedule Ride' : 'Request Ride'}
          </ThemedText>
          <ThemedText style={styles.primaryBtnSubText}>
            {activeRide 
              ? `Trip to ${activeRide.dropoffName || 'destination'}`
              : distanceKm ? `${distanceKm.toFixed(1)} km • Rs. ${fare}` : 'Select pickup and drop-off'}
          </ThemedText>
        </Pressable>
        </ScrollView>
      </View>

      {drawerOpen ? (
        <Pressable style={styles.drawerOverlay} onPress={() => setDrawerOpen(false)}>
          <View style={styles.drawer}>
            <ThemedText type="title" style={{ marginBottom: 16 }}>Menu</ThemedText>

            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); router.push('/(rider)/history'); }}>
              <ThemedText style={styles.drawerItemText}>📖 Ride History</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>💳 Payment Methods</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>⚙️ Settings</ThemedText>
            </Pressable>
            <Pressable style={styles.drawerItem} onPress={() => { setDrawerOpen(false); }}>
              <ThemedText style={styles.drawerItemText}>🆘 Help & Support</ThemedText>
            </Pressable>

            <View style={{ marginTop: 16 }}>
              <Button
                title="Logout"
                onPress={async () => {
                  setDrawerOpen(false);
                  await logout();
                  router.replace('/(auth)/login');
                }}
                color="#f44336"
              />
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapBg: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  hamburgerBtn: {
    position: 'absolute',
    top: 48,
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hamburgerText: {
    fontSize: 22,
  },
  paymentPill: {
    position: 'absolute',
    top: 48,
    right: 16,
    zIndex: 100,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  paymentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  activeRideBanner: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    zIndex: 90,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  activeRideTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
  },
  activeRideSub: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  activeRideBtn: {
    marginTop: 12,
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  activeRideBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  myLocationBtn: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    zIndex: 100,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 50,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  myLocationText: {
    fontSize: 20,
  },
  topCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  topCardScroll: {
    flex: 1,
  },
  topCardContent: {
    paddingBottom: 20,
  },
  serviceTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  serviceTab: {
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  serviceTabActive: {
    backgroundColor: '#4CAF50',
  },
  serviceTabText: {
    fontSize: 16,
  },
  serviceTabTextActive: {
    color: '#fff',
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
  },
  addressDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  addressDotText: {
    color: '#fff',
    fontWeight: '700',
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  addressInput: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fafafa',
  },
  addressDivider: {
    height: 1,
    backgroundColor: '#eee',
  },
  suggestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 10,
    marginBottom: 12,
  },
  vehicleCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  vehicleCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    alignItems: 'center',
  },
  vehicleCardActive: {
    borderColor: '#1aa37a',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  vehicleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  vehicleIcon: {
    fontSize: 24,
  },
  vehicleCardTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600',
  },
  vehicleCardTitleActive: {
    color: '#1aa37a',
  },
  vehicleCardPrice: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    color: '#111',
  },
  vehicleCardPriceActive: {
    color: '#1aa37a',
  },
  recentPlacesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  recentPlaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  recentPlaceIcon: {
    fontSize: 16,
  },
  recentPlaceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  metaPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  metaPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1aa37a',
  },
  primaryBtn: {
    backgroundColor: '#1aa37a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 14,
    alignItems: 'center',
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnActiveRide: { backgroundColor: '#FF9800' },
  primaryBtnText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  primaryBtnSubText: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
    fontSize: 12,
  },
  vehicleRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehicleBtn: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  vehicleBtnActive: {
    backgroundColor: '#4CAF50',
  },
  vehicleText: {
    fontSize: 14,
  },
  vehicleTextActive: {
    color: '#fff',
  },
  deliveryCard: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ffcc80',
  },
  deliveryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 12,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  deliveryTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  deliveryTypeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deliveryTypeBtnActive: {
    backgroundColor: '#ff9800',
    borderColor: '#ff9800',
  },
  deliveryTypeText: {
    fontSize: 13,
    color: '#333',
  },
  deliveryTypeTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  deliveryInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  prebookCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  prebookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  prebookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  prebookInputs: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  prebookField: {
    flex: 1,
  },
  prebookLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  prebookInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  prebookSummary: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  prebookSummaryText: {
    color: '#fff',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  placeInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginTop: 8,
  },
  suggestItem: {
    padding: 8,
    backgroundColor: '#f9f9f9',
    marginTop: 4,
    borderRadius: 4,
  },
  suggestDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    zIndex: 1000,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestText: {
    fontSize: 13,
    color: '#333',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  addStopBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1aa37a',
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  addStopBtnText: {
    color: '#1aa37a',
    fontWeight: '600',
  },
  waypointCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    marginTop: 8,
  },
  waypointHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  waypointLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  waypointRemove: {
    color: '#f44336',
    fontSize: 16,
    fontWeight: 'bold',
  },
  waypointLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waypointLabelText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 12,
  },
  fareLabel: {
    color: '#666',
    fontSize: 12,
  },
  fareValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  drawerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    flexDirection: 'row',
  },
  drawer: {
    width: 280,
    backgroundColor: '#fff',
    padding: 16,
    paddingTop: 60,
  },
  drawerItem: {
    paddingVertical: 12,
  },
  drawerItemText: {
    fontSize: 18,
    color: '#4CAF50',
  },
});
