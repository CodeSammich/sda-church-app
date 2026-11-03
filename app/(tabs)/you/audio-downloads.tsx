import { getOfflineBibleAudioTitle, OfflineBibleAudio } from '@/components/OfflineBibleAudio';
import { LanguageContext } from '@/constants/LanguageContext';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';

/** Offline Bible Audio, in the You tab (#556): see components/OfflineBibleAudio.tsx. */
export default function OfflineBibleAudioScreen() {
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  return (
    <>
      <Stack.Screen options={{ title: getOfflineBibleAudioTitle(language), backTo } as any} />
      <OfflineBibleAudio />
    </>
  );
}
