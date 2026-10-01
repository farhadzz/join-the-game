import type { SportId } from '@join-the-game/core';
import { createFriendlyMatchSchema } from '@join-the-game/validation';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/button';
import { createFriendlyMatch } from '@/db/matches';

type Field = 'homeTeamName' | 'awayTeamName';

const sportOptions: { id: SportId; label: string }[] = [
  { id: 'football', label: 'Football' },
  { id: 'basketball', label: 'Basketball' },
];

export default function NewMatchScreen() {
  const db = useSQLiteContext();
  const [sport, setSport] = useState<SportId>('football');
  const [names, setNames] = useState<Record<Field, string>>({ homeTeamName: '', awayTeamName: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const submit = async () => {
    const result = createFriendlyMatchSchema.safeParse({ sport, ...names });
    if (!result.success) {
      const fieldErrors: Partial<Record<Field, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if ((field === 'homeTeamName' || field === 'awayTeamName') && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    setSaveError(null);
    try {
      const id = await createFriendlyMatch(db, result.data);
      router.replace({ pathname: '/match/[id]', params: { id } });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save the match');
      setSaving(false);
    }
  };

  const field = (key: Field, label: string, placeholder: string) => (
    <View className="gap-2">
      <Text className="font-medium text-zinc-700 dark:text-zinc-300">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={names[key]}
        onChangeText={(text) => setNames((current) => ({ ...current, [key]: text }))}
        placeholder={placeholder}
        placeholderTextColor="#71717a"
        maxLength={50}
        autoCapitalize="words"
        returnKeyType="next"
        className={`rounded-xl border bg-white px-4 py-3 text-lg text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 ${errors[key] ? 'border-red-500' : 'border-zinc-300 dark:border-zinc-700'}`}
      />
      {errors[key] && (
        <Text accessibilityRole="alert" className="text-red-600 dark:text-red-400">
          {errors[key]}
        </Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white dark:bg-zinc-950"
    >
      <ScrollView contentContainerClassName="gap-6 p-4" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text className="font-medium text-zinc-700 dark:text-zinc-300">Sport</Text>
          <View accessibilityRole="radiogroup" className="flex-row gap-2">
            {sportOptions.map((option) => {
              const selected = option.id === sport;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setSport(option.id)}
                  className={`flex-1 items-center rounded-xl border px-4 py-3 ${selected ? 'border-zinc-900 bg-zinc-900 dark:border-zinc-100 dark:bg-zinc-100' : 'border-zinc-300 dark:border-zinc-700'}`}
                >
                  <Text
                    className={`text-base font-semibold ${selected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'}`}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {field('homeTeamName', 'Home team', 'e.g. Riverside Rovers')}
        {field('awayTeamName', 'Away team', 'e.g. Northside United')}

        {saveError && (
          <Text accessibilityRole="alert" className="text-red-600 dark:text-red-400">
            {saveError}
          </Text>
        )}

        <Button
          label={saving ? 'Creating…' : 'Start scorekeeping'}
          size="lg"
          disabled={saving}
          onPress={submit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
