import type {
  AppIconProps,
  MaterialCommunityIconName,
} from '@/components/AppIcon';

type MaterialAppIcon = {
  family?: 'material-community';
  name: MaterialCommunityIconName;
};

type AppIconography = {
  explore: {
    appleAppStore: AppIconProps;
    library: MaterialAppIcon;
    sabbathSchool: MaterialAppIcon;
  };
  tabs: {
    explore: MaterialAppIcon;
  };
};

/** Semantic icon choices shared by navigation and Explore content. */
export const APP_ICONOGRAPHY: AppIconography = {
  explore: {
    appleAppStore: {
      family: 'ionicons',
      name: 'logo-apple-appstore',
    },
    library: { name: 'bookshelf' },
    sabbathSchool: { name: 'school' },
  },
  tabs: {
    explore: { name: 'compass' },
  },
};
