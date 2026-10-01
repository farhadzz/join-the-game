import '../global.css';

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  type ErrorBoundaryProps,
} from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { useColorScheme } from 'react-native';
import { ErrorState, LoadingState } from '@/components/states';
import { migrate } from '@/db/migrate';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorState message={error.message} onRetry={retry} />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Suspense fallback={<LoadingState />}>
        <SQLiteProvider databaseName="join-the-game.db" onInit={migrate} useSuspense>
          <Stack>
            <Stack.Screen name="index" options={{ title: 'Matches' }} />
            <Stack.Screen
              name="new-match"
              options={{ title: 'New match', presentation: 'modal' }}
            />
            <Stack.Screen name="match/[id]" options={{ title: 'Scorekeeper' }} />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}
