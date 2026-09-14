## Native Development (Legacy Documentation Only)

Preserved for technical reference in case the project resumes native distribution.

### iOS Reference

```bash
npm run ios
```

This command launches the iOS simulator. Browser/PWA installation via Safari is retained
only for web testing; signed native builds are the primary distribution path.

### Android Reference

To start the Metro bundler and launch the app:

```bash
# Default
npm run android

# For Expo Go
npx expo start --host lan

# For a development build
npx expo run:android
```

### WSL Debugging

If developing in WSL2, the Android Emulator on Windows may not connect automatically.

1. Verify device connection:

```bash
adb devices
```

2. Manual Bundle Location:

- In the Emulator: Ctrl + M -> Change Bundle Location -> Set to your WSL IP (e.g., 172.23.202.254:8081).

3. Alternative WSL Start:

```bash
npx expo start --dev-client --tunnel

# or alternatively
npm run wsl
```

### Debugging First-Time Launch

To re-test the onboarding flow:

1. Open the Developer Menu (Ctrl + M).
2. Select Debug: Reset Onboarding.
3. Reload the app.
