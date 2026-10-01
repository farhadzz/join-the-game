import { Pressable, Text, type PressableProps } from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'home' | 'away';
type Size = 'md' | 'lg' | 'xl';

const containers: Record<Variant, string> = {
  primary: 'bg-zinc-900 dark:bg-zinc-100',
  secondary: 'bg-zinc-200 dark:bg-zinc-800',
  danger: 'bg-red-600',
  home: 'bg-home dark:bg-home-dark',
  away: 'bg-away dark:bg-away-dark',
};

const texts: Record<Variant, string> = {
  primary: 'text-white dark:text-zinc-900',
  secondary: 'text-zinc-900 dark:text-zinc-100',
  danger: 'text-white',
  home: 'text-white dark:text-zinc-950',
  away: 'text-white dark:text-zinc-950',
};

const sizes: Record<Size, { container: string; text: string }> = {
  md: { container: 'min-h-12 px-4 py-3', text: 'text-base' },
  lg: { container: 'min-h-16 px-5 py-4', text: 'text-lg' },
  xl: { container: 'min-h-24 px-6 py-5', text: 'text-2xl' },
};

export type ButtonProps = Omit<PressableProps, 'children' | 'className'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      className={`items-center justify-center rounded-2xl active:opacity-70 ${containers[variant]} ${sizes[size].container} ${disabled ? 'opacity-40' : ''} ${className}`}
      {...props}
    >
      <Text className={`text-center font-semibold ${texts[variant]} ${sizes[size].text}`}>
        {label}
      </Text>
    </Pressable>
  );
}
