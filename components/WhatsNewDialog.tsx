import { ContrastStep } from '@/components/ContrastChoice';
import { SetupAction } from '@/components/SetupAction';
import { getSetupWords, SetupScreen } from '@/components/SetupScreen';
import { LanguageContext } from '@/constants/LanguageContext';
import { ThemeContext, type ThemeKind } from '@/constants/Themes';
import { isKeyScreensBuild, SCREENSHOT_WHATS_NEW_STEP_KEY } from '@/services/ScreenshotRoute';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useState } from 'react';

/**
 * What's new in 1.7.0 (#669), once, for members who set up an earlier
 * version: only the contrast question setup now asks, for light mode and
 * then dark mode, each with its two pictures. It's setup's own full screen
 * and contrast steps (#708), not a popup, so both pictures and the buttons
 * show without a scroll, where a popup's height limit hid Standard. As in
 * setup, a tap on a picture only chooses it, and Next, then Done, beside
 * Back, go on. High contrast starts chosen: when a tap on a picture went on,
 * a tap on the one already chosen seemed to do nothing. Each button saves the
 * choice shown, so high contrast kept is saved. It asks questions, so it has
 * no X and can't be dismissed.
 */
export function WhatsNewDialog({ onDone }: Readonly<{ onDone: () => void }>) {
  const { language } = useContext(LanguageContext);
  const { contrastModes, setContrastMode } = useContext(ThemeContext);
  const words = getSetupWords(language);
  const [kind, setKind] = useState<ThemeKind>('light');

  // A key-screens build can open the second question, since the capture
  // can't press the first.
  useEffect(() => {
    if (!isKeyScreensBuild()) return;
    void AsyncStorage.getItem(SCREENSHOT_WHATS_NEW_STEP_KEY).then((saved) => {
      if (saved === 'dark') setKind('dark');
    });
  }, []);

  return (
    <SetupScreen
      scrollKey={kind}
      step={kind === 'light' ? 0 : 1}
      steps={2}
      actions={
        <>
          {kind === 'dark' && (
            <SetupAction kind="outlined" label={words.back} onPress={() => setKind('light')} placement="fill" />
          )}
          <SetupAction
            label={kind === 'dark' ? words.done : words.next}
            onPress={() => {
              void setContrastMode(kind, contrastModes[kind]);
              if (kind === 'light') setKind('dark');
              else onDone();
            }}
            placement="fill"
          />
        </>
      }
    >
      <ContrastStep
        key={kind}
        kind={kind}
        language={language}
        onChoose={(mode) => void setContrastMode(kind, mode)}
        value={contrastModes[kind]}
      />
    </SetupScreen>
  );
}
