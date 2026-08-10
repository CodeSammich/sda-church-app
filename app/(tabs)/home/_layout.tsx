import { GlobalHeader } from '@/components/GlobalHeader';
import { Stack } from 'expo-router';

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={{ header: (props) => <GlobalHeader {...props} /> }}>
      <Stack.Screen name="about-sda" />
      <Stack.Screen name="about-my-church" />
      <Stack.Screen name="team" />
      <Stack.Screen name="bulletin" />
      <Stack.Screen name="contact" />
      <Stack.Screen name="discover" />
      <Stack.Screen name="give" />
      <Stack.Screen name="worship" />
      <Stack.Screen name="fellowship" />
      <Stack.Screen name="roster" />
      <Stack.Screen name="hymnal-selection" />
      <Stack.Screen name="english-hymnal" />
      <Stack.Screen name="chinese-505-hymnal" />
      <Stack.Screen name="chinese-506-hymnal" />
      <Stack.Screen name="chinese-707-new-simplified-hymnal" />
      <Stack.Screen name="chinese-707-four-part-hymnal" />
      <Stack.Screen name="chinese-707-standard-hymnal" />
      <Stack.Screen name="baptism" />
      <Stack.Screen name="events" />
    </Stack>
  );
}
