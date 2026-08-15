import { GlobalHeader } from '@/components/GlobalHeader';
import { Stack } from 'expo-router';

export default function BibleStackLayout() {
  return (
    <Stack screenOptions={{ header: (props) => <GlobalHeader {...props} /> }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
