import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from './button';

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-zinc-950">
      <ActivityIndicator accessibilityLabel={label} size="large" />
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View
      accessibilityRole="alert"
      className="flex-1 items-center justify-center gap-3 bg-white px-8 dark:bg-zinc-950"
    >
      <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</Text>
      <Text className="text-center text-zinc-600 dark:text-zinc-400">{message}</Text>
      {onRetry && <Button label="Try again" variant="secondary" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Text className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</Text>
      <Text className="text-center text-zinc-600 dark:text-zinc-400">{message}</Text>
      {action}
    </View>
  );
}
