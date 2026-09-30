import { getStackScreenOptions } from '@/components/StackScreenOptions';
import { Stack } from 'expo-router';

export default function YouStackLayout() {
  return (
    <Stack screenOptions={getStackScreenOptions('you')}>
      {/* The index.tsx in this folder will be the default screen for the 'You' tab */}
      <Stack.Screen name="index" />
      {/* Screens pushed onto this stack */}
      <Stack.Screen name="privacy" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}
