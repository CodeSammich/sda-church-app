import { APP_ICONOGRAPHY } from '@/constants/Iconography';

describe('semantic app iconography', () => {
  it('uses a compass for Explore and distinct study/library icons', () => {
    expect(APP_ICONOGRAPHY.tabs.explore).toEqual({ name: 'compass' });
    expect(APP_ICONOGRAPHY.explore.sabbathSchool).toEqual({ name: 'school' });
    expect(APP_ICONOGRAPHY.explore.library).toEqual({ name: 'bookshelf' });
  });

  it('uses the Ionicons Apple App Store logo for the iOS hymnal link', () => {
    expect(APP_ICONOGRAPHY.explore.appleAppStore).toEqual({
      family: 'ionicons',
      name: 'logo-apple-appstore',
    });
  });
});
