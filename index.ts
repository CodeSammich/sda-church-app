// The app's entry. The announcements' background check is defined first, at
// the top level, because Android runs it with the app closed and none of its
// screens, where app/_layout.tsx never loads (#709). Then Expo Router starts
// the app as usual.
import './services/AnnouncementNotificationTask';
import 'expo-router/entry';
