import { WrappingButton as Button } from '@/components/WrappingButton';
import { CHURCH_LOCATIONS, getLocationNames, getServiceTimes } from '@/constants/ChurchData';
import { openInMaps } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';

export const ADDRESS_AND_SERVICE_TIMES_LABELS = {
  en: { title: 'Address & Service Times', separator: ': ', getDirections: 'Get Directions' },
  zh: { title: '教會地址與聚會時間', separator: '：', getDirections: '獲取路線' },
  'zh-cn': { title: '教会地址与聚会时间', separator: '：', getDirections: '获取路线' },
  es: { title: 'Dirección y horarios', separator: ': ', getDirections: 'Obtener Direcciones' },
};

/**
 * Where and when the church meets, at the top of New Member & Visitor (#793):
 * each location's name, its gathering and hours, and its street address, with
 * a button that opens it in Maps. The address is the English one, as maps and
 * drivers need it, in the page's full ink, and can be selected to copy.
 */
export function AddressAndServiceTimes() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const labels =
    ADDRESS_AND_SERVICE_TIMES_LABELS[language as keyof typeof ADDRESS_AND_SERVICE_TIMES_LABELS] ||
    ADDRESS_AND_SERVICE_TIMES_LABELS.en;
  const names = getLocationNames(language);
  const times = getServiceTimes(language);

  return (
    <View>
      <Text
        accessibilityRole="header"
        variant="titleLarge"
        style={[
          DocumentStyles.sectionTitle,
          { color: theme.colors.onSurface, borderBottomColor: theme.colors.outlineVariant },
        ]}
      >
        {labels.title}
      </Text>
      <Card mode="outlined" style={[DocumentStyles.card, DocumentStyles.leadCard]}>
        <Card.Content>
          {CHURCH_LOCATIONS.map((location, index) => (
            <View key={location.address} testID="church-location">
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <Text variant="titleMedium" style={[styles.name, { color: theme.colors.onSurface }]}>
                {names[index]}
              </Text>
              {times[index] ? (
                <Text variant="bodyLarge" style={[styles.line, { color: theme.colors.onSurface }]}>
                  <Text variant="bodyLarge" style={[styles.service, { color: theme.colors.onSurface }]}>
                    {times[index].service}
                  </Text>
                  {labels.separator}
                  {times[index].time}
                </Text>
              ) : null}
              <Text selectable variant="bodyLarge" style={[styles.line, { color: theme.colors.onSurface }]}>
                {location.address}
              </Text>
              <Button
                mode="contained"
                icon="map-marker"
                onPress={() => openInMaps(location.searchQuery)}
                style={styles.directions}
              >
                {labels.getDirections}
              </Button>
            </View>
          ))}
        </Card.Content>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    marginVertical: 14,
  },
  name: {
    fontWeight: 'bold',
  },
  line: {
    marginTop: 4,
  },
  service: {
    fontWeight: 'bold',
  },
  directions: {
    marginTop: 10,
  },
});
