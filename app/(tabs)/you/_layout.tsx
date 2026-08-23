import { GlobalHeader } from '@/components/GlobalHeader';
import { Stack } from 'expo-router';

export default function YouStackLayout() {
  return (
    <Stack screenOptions={{ header: (props) => <GlobalHeader {...props} /> }}>
      {/* The index.tsx in this folder will be the default screen for the 'You' tab */}
      <Stack.Screen name="index" />
      {/* Screens pushed onto this stack */}
      <Stack.Screen name="contact" />
      <Stack.Screen name="about" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="legal" />
    </Stack>
  );
}
