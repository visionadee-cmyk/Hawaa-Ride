import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

interface MapViewProps {
  style?: any;
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta?: number;
    longitudeDelta?: number;
  };
  onLongPress?: (e: any) => void;
  children?: React.ReactNode;
}

export const MapView = forwardRef<any, MapViewProps>(function MapView({ style, initialRegion, onLongPress, children }, ref) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }, duration?: number) => {
      if (!mapRef.current) return;
      const zoom = region.longitudeDelta
        ? Math.round(Math.log2(360 / region.longitudeDelta)) + 1
        : 16;
      mapRef.current.flyTo([region.latitude, region.longitude], zoom, { duration: (duration || 500) / 1000 });
    },
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__riderMap = null;
    const loadLeaflet = async () => {
      if ((window as any).L) {
        setLeafletLoaded(true);
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setLeafletLoaded(true);
      document.head.appendChild(script);
    };
    loadLeaflet();
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current || mapRef.current) return;
    const L = (window as any).L;
    const center = initialRegion
      ? [initialRegion.latitude, initialRegion.longitude]
      : [24.8607, 67.0011];
    const map = L.map(mapContainerRef.current).setView(center, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    (window as any).__riderMap = map;
    if (onLongPress) {
      map.on('contextmenu', (e: any) => {
        onLongPress({
          nativeEvent: {
            coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng },
          },
        });
      });
    }
  }, [leafletLoaded, initialRegion, onLongPress]);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = (window as any).L;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    circlesRef.current.forEach((c) => c.remove());
    circlesRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    if (!children) return;
    const childArray = Array.isArray(children) ? children : [children];
    let routeCoords: [number, number][] | null = null;
    childArray.forEach((child: any) => {
      if (!child?.props?.coordinate) return;
      const { latitude, longitude } = child.props.coordinate;
      const title = child.props.title || 'Marker';
      const marker = L.marker([latitude, longitude])
        .addTo(mapRef.current)
        .bindPopup(title);
      markersRef.current.push(marker);
    });
    const circleChildren = childArray.filter((c: any) => c?.type?.name === 'Circle' || c?.type === Circle);
    circleChildren.forEach((child: any) => {
      const { center, radius, fillColor, strokeColor, strokeWidth } = child.props || {};
      if (!center?.latitude || !center?.longitude || !radius) return;
      const circle = L.circle([center.latitude, center.longitude], {
        radius,
        color: strokeColor || '#2196F3',
        weight: strokeWidth || 2,
        fillColor: fillColor || 'rgba(33,150,243,0.15)',
        fillOpacity: 1,
      }).addTo(mapRef.current);
      circlesRef.current.push(circle);
    });

    const polylineChild = childArray.find((c: any) => c?.type?.name === 'Polyline' || c?.type === Polyline);
    if (polylineChild?.props?.coordinates?.length >= 2) {
      const coords = polylineChild.props.coordinates.map((c: any) => [c.latitude, c.longitude]);
      const origin = coords[0];
      const dest = coords[coords.length - 1];
      const url = `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest[1]},${dest[0]}?overview=full&geometries=geojson`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (polylineRef.current) {
            polylineRef.current.remove();
          }
          if (data.code === 'Ok' && data.routes && data.routes[0]) {
            const routePoints = data.routes[0].geometry.coordinates.map((pt: number[]) => [pt[1], pt[0]]);
            polylineRef.current = L.polyline(routePoints, { color: '#2196F3', weight: 6 }).addTo(mapRef.current);
            mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
          } else {
            polylineRef.current = L.polyline(coords, { color: '#2196F3', weight: 6 }).addTo(mapRef.current);
            mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
          }
        })
        .catch(() => {
          if (polylineRef.current) {
            polylineRef.current.remove();
          }
          polylineRef.current = L.polyline(coords, { color: '#2196F3', weight: 6 }).addTo(mapRef.current);
          mapRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
        });
    }
  }, [children, leafletLoaded]);

  return (
    <View style={[style, styles.container]}>
      <div ref={mapContainerRef as any} style={{ width: '100%', height: '100%' }} />
    </View>
  );
});

export function Marker({ coordinate, title }: { coordinate: { latitude: number; longitude: number }; title?: string }) {
  return null;
}

export function Polyline({ coordinates, strokeWidth }: { coordinates?: Array<{ latitude: number; longitude: number }>; strokeWidth?: number }) {
  return null;
}

export function Circle({ center, radius, fillColor, strokeColor, strokeWidth }: any) {
  return null;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
  },
});
