import { getStackScreenOptions } from '@/components/StackScreenOptions';
import { Stack } from 'expo-router';

export default function ExploreStackLayout() {
  return (
    <Stack screenOptions={getStackScreenOptions('explore')}>
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="library/[collection]" />
      <Stack.Screen name="sabbath-school" />
    </Stack>
  );
}
