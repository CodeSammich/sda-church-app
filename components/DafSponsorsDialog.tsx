import { AppIcon } from '@/components/AppIcon';
import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import {
  CHURCH_EIN,
  CHURCH_LEGAL_NAME,
  type DafSponsor,
  openDafSponsor,
  OTHER_DAF_SPONSORS,
} from '@/constants/ExternalLinks';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

export const DAF_SPONSORS_COPY = {
  en: {
    intro:
      'Please contact church staff in advance to give through one of these, or through another sponsor or brokerage.',
    formerly: 'Formerly',
    recipient: 'Grant recipient',
    close: 'Close',
  },
  zh: {
    intro:
      '如要透過以下機構或其他慈善贊助機構或券商奉獻，請提前聯絡教會同工。',
    formerly: '原名',
    recipient: '撥款對象',
    close: '關閉',
  },
  'zh-cn': {
    intro:
      '如要通过以下机构或其他慈善赞助机构或券商奉献，请提前联系教会同工。',
    formerly: '原名',
    recipient: '拨款对象',
    close: '关闭',
  },
  es: {
    intro:
      'Para donar mediante una de estas organizaciones, u otra organización patrocinadora o casa de corretaje, comuníquese con el personal de la iglesia con anticipación.',
    formerly: 'Anteriormente',
    recipient: 'Destinatario de la donación',
    close: 'Cerrar',
  },
} as const satisfies Record<SupportedLanguage, Record<string, string>>;

/** The lines under a sponsor's name: its old name, if it had one, and its website. */
export const getDafSponsorDetails = (sponsor: DafSponsor, language: SupportedLanguage): string[] => {
  const labels = DAF_SPONSORS_COPY[language] || DAF_SPONSORS_COPY.en;
  const website = new URL(sponsor.url).hostname.replace(/^www\./, '');
  return sponsor.formerName ? [`${labels.formerly} ${sponsor.formerName}`, website] : [website];
};

type DafSponsorsDialogProps = Readonly<{
  /** The button's label, such as "Other Sponsors", which titles the popup. */
  title: string;
  visible: boolean;
  onDismiss: () => void;
}>;

/**
 * The Tithe & Offering page's Other Sponsors popup (#646): the donor-advised
 * fund sponsors other than Fidelity Charitable, which the church prefers, each
 * opening its home page in the in-app browser, then the church's legal name
 * and EIN to recommend a grant to.
 */
export function DafSponsorsDialog({ onDismiss, title, visible }: DafSponsorsDialogProps) {
  const { language } = useContext(LanguageContext);
  const labels = DAF_SPONSORS_COPY[language] || DAF_SPONSORS_COPY.en;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  // A numeric width: on iOS, Paper splits a percentage width from maxWidth (#324).
  const popupWidthStyle = usePopupWidthStyle();

  return (
    <Portal>
      <Dialog
        testID="daf-sponsors-dialog"
        visible={visible}
        onDismiss={onDismiss}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <PopupHeader
          closeLabel={labels.close}
          onClose={onDismiss}
          style={styles.header}
          title={title}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea style={styles.scrollArea}>
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
            <Text
              variant="bodyMedium"
              style={[styles.intro, { color: theme.colors.onSurfaceVariant }]}
            >
              {labels.intro}
            </Text>
            <View style={styles.sponsors}>
              {OTHER_DAF_SPONSORS.map((sponsor) => {
                const details = getDafSponsorDetails(sponsor, language);
                return (
                  <Pressable
                    key={sponsor.id}
                    testID={`daf-sponsor-${sponsor.id}`}
                    accessibilityLabel={[sponsor.name, ...details].join(', ')}
                    accessibilityRole="link"
                    onPress={() => openDafSponsor(sponsor)}
                    style={({ pressed }) => [
                      styles.sponsor,
                      {
                        backgroundColor: theme.colors.surfaceVariant,
                        borderColor: theme.colors.outlineVariant,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <View style={styles.sponsorText}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {sponsor.name}
                      </Text>
                      {details.map((line) => (
                        <Text key={line} variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                          {line}
                        </Text>
                      ))}
                    </View>
                    <AppIcon
                      name="open-in-new"
                      size={20}
                      color={theme.colors.primary}
                      pointerEvents="none"
                    />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.recipient}>
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {labels.recipient}
              </Text>
              <Text selectable variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                {CHURCH_LEGAL_NAME}
              </Text>
              <Text selectable variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                {`EIN ${CHURCH_EIN}`}
              </Text>
            </View>
          </PopupScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // As in the other popups: with the X's 48-point row, 16 keeps the title where
  // Paper's own title sits.
  header: {
    marginBottom: 8,
    marginTop: 16,
    paddingLeft: 24,
    paddingRight: 12,
  },
  intro: {
    marginBottom: 16,
  },
  recipient: {
    gap: 2,
    marginTop: 20,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  sponsor: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sponsorText: {
    flex: 1,
    gap: 2,
  },
  sponsors: {
    gap: 10,
  },
});
