import { getStackScreenOptions } from '@/components/StackScreenOptions';
import { Stack } from 'expo-router';

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={getStackScreenOptions('home')}>
      <Stack.Screen name="about-sda" />
      <Stack.Screen name="about-my-church" />
      <Stack.Screen name="team" />
      <Stack.Screen name="bulletin" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="give" />
      <Stack.Screen name="worship" />
      <Stack.Screen name="fellowship" />
      <Stack.Screen name="hymnal-selection" />
      <Stack.Screen name="hymn-lookup" />
      <Stack.Screen name="english-hymnal" />
      <Stack.Screen name="chinese-505-hymnal" />
      <Stack.Screen name="chinese-506-hymnal" />
      <Stack.Screen name="chinese-707-new-simplified-hymnal" />
      <Stack.Screen name="chinese-707-four-part-hymnal" />
      <Stack.Screen name="chinese-707-standard-hymnal" />
      <Stack.Screen name="baptism" />
    </Stack>
  );
}
