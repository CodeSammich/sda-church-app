import { GlobalHeader } from '@/components/GlobalHeader';
import { Stack } from 'expo-router';

export default function ExploreStackLayout() {
  return (
    <Stack screenOptions={{ header: (props) => <GlobalHeader {...props} /> }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="library" />
      <Stack.Screen name="library/[collection]" />
      <Stack.Screen name="sabbath-school" />
    </Stack>
  );
}
