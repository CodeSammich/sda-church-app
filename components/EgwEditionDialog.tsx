import { WrappingButton } from '@/components/WrappingButton';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import { openURL } from '@/constants/ExternalLinks';
import {
  getEgwEditionsForLanguage,
  type EgwBookWork,
  type EgwEditionLanguage,
} from '@/features/library/EgwBookCatalog';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

const editionLanguageNames: Readonly<Record<EgwEditionLanguage, string>> = {
  en: 'English',
  zh: '中文',
  es: 'Español',
};

type EgwEditionDialogProps = Readonly<{
  closeLabel: string;
  language: SupportedLanguage;
  onDismiss: () => void;
  openError: string;
  opensOfficial: string;
  selectEditionLabel: string;
  work: EgwBookWork | null;
}>;

export function EgwEditionDialog({
  closeLabel,
  language,
  onDismiss,
  openError,
  opensOfficial,
  selectEditionLabel,
  work,
}: EgwEditionDialogProps) {
  const { textScale } = useTextSize();
  const styles = useMemo(() => createStyles(textScale), [textScale]);

  if (!work) return null;

  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.Title>{work.workTitle[language]}</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.description}>{selectEditionLabel}</Text>
          <View style={styles.editionList}>
            {getEgwEditionsForLanguage(work, language).map((edition) => (
              <WrappingButton
                key={edition.language}
                accessibilityLabel={`${editionLanguageNames[edition.language]}: ${edition.title}. ${opensOfficial}`}
                icon="open-in-new"
                labelStyle={styles.editionButtonLabel}
                mode="outlined"
                onPress={() => {
                  onDismiss();
                  openURL(edition.url, work.workTitle[language], openError);
                }}
                style={styles.editionButton}
              >
                {`${editionLanguageNames[edition.language]} · ${edition.title}`}
              </WrappingButton>
            ))}
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <WrappingButton onPress={onDismiss}>{closeLabel}</WrappingButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    dialog: {
      alignSelf: 'center',
      maxWidth: 560,
      width: '92%',
    },
    description: {
      fontSize: scaleTypographyMetric(14, textScale),
      lineHeight: scaleTypographyMetric(21, textScale),
      marginBottom: 16,
    },
    editionList: {
      gap: 10,
    },
    editionButton: {
      alignSelf: 'stretch',
      justifyContent: 'flex-start',
    },
    editionButtonLabel: {
      flex: 1,
      textAlign: 'left',
    },
  });
