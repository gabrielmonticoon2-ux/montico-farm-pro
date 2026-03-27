import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Botão reutilizável com variantes: primary | secondary | danger | accent
 * Altura mínima 52px para uso confortável em campo.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  className = '',
  style,
}) {
  const base = 'flex-row items-center justify-center gap-2 rounded-xl px-5';

  const variants = {
    primary:   'bg-primary',
    secondary: 'border-2 border-primary bg-transparent',
    danger:    'bg-danger',
    accent:    'bg-accent',
    outline:   'border-2 border-primary-light bg-transparent',
  };

  const textVariants = {
    primary:   'text-white',
    secondary: 'text-primary',
    danger:    'text-white',
    accent:    'text-white',
    outline:   'text-primary-light',
  };

  const iconColor = ['secondary', 'outline'].includes(variant) ? '#1B4332' : '#fff';

  return (
    <TouchableOpacity
      className={`${base} ${variants[variant] ?? variants.primary} ${disabled || loading ? 'opacity-50' : ''} ${className}`}
      style={[styles.minHeight, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={20} color={iconColor} />}
          <Text className={`font-bold text-base ${textVariants[variant] ?? textVariants.primary}`}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  minHeight: { minHeight: 52 },
});
