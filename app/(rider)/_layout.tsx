import { Stack } from 'expo-router';

export default function RiderLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Rider' }} />
      <Stack.Screen name="ride" options={{ title: 'Your ride' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
    </Stack>
  );
}
