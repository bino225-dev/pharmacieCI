import { Stack } from 'expo-router';
import { PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { Provider } from 'react-redux';
import { store } from '@/store';
import { StatusBar } from 'expo-status-bar';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#27AE60',
    background: '#ffffff',
  },
};

export default function RootLayout() {
  return (
    <Provider store={store}>
      <PaperProvider theme={theme}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="pharmacieapp" />
        </Stack>
      </PaperProvider>
    </Provider>
  );
}
