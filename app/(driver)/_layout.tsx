import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Driver', headerShown: false }} />
      <Stack.Screen name="register" options={{ title: 'Driver registration' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', headerShown: false }} />
      <Stack.Screen name="ride" options={{ title: 'Ride', headerShown: false }} />
      <Stack.Screen name="history" options={{ title: 'Recent Orders', headerShown: false }} />
      <Stack.Screen name="billing" options={{ title: 'Billing', headerShown: false }} />
      <Stack.Screen name="services" options={{ title: 'Services', headerShown: false }} />
      <Stack.Screen name="restrictions" options={{ title: 'Restrictions', headerShown: false }} />
      <Stack.Screen name="overlay" options={{ title: 'Overlay', headerShown: false }} />
      <Stack.Screen name="appearance" options={{ title: 'Appearance', headerShown: false }} />
      <Stack.Screen name="contact" options={{ title: 'Contact', headerShown: false }} />
      <Stack.Screen name="range" options={{ title: 'Range', headerShown: false }} />
    </Stack>
  );
}
