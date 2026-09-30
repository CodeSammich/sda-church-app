import { GlobalHeader } from '@/components/GlobalHeader';
import { isSwipeBackToParent } from '@/constants/BackNavigation';

type StackScreenContext = {
  route: { key?: string };
  navigation: { getState: () => { routes: { key: string; name: string; params?: object }[] } };
};

/**
 * Screen options for the Home, Explore, and You stacks: the app's header, and
 * iOS's swipe-back only where it reaches the same page as the back arrow.
 */
export const getStackScreenOptions =
  (stack: string) =>
  ({ route, navigation }: StackScreenContext) => ({
    header: (props: any) => <GlobalHeader {...props} />,
    gestureEnabled: isSwipeBackToParent(stack, navigation.getState().routes, route.key),
  });
