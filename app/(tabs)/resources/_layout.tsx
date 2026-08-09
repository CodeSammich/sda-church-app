import { GlobalHeader } from '@/components/GlobalHeader';
import { Stack } from 'expo-router';

export default function ResourcesStackLayout() {
  return (
    <Stack screenOptions={{ header: (props) => <GlobalHeader {...props} /> }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="hymnal-selection" />
      <Stack.Screen name="english-hymnal" />
      <Stack.Screen name="chinese-505-hymnal" />
      <Stack.Screen name="chinese-506-hymnal" />
      <Stack.Screen name="chinese-707-new-simplified-hymnal" />
      <Stack.Screen name="chinese-707-four-part-hymnal" />
      <Stack.Screen name="chinese-707-standard-hymnal" />
    </Stack>
  );
}
