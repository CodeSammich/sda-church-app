import { StyleSheet } from "react-native";

/**
 * Shared styles for Menu/Navigation-heavy screens.
 * Preference given to the layout logic defined in ResourcesScreen.
 */
export const NavigationStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20, // Preference: resources.tsx
    paddingBottom: 80, // Tab bar gutter
  },
  heroHeader: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroTitle: {
    fontWeight: 'bold',
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subheader: {
    fontWeight: "bold",
    fontSize: 16, // Preference: resources.tsx
    lineHeight: 22,
  },
});
