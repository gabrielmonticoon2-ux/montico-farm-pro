import React from 'react';
import { View, Text } from 'react-native';

/**
 * Badge de status em pílula.
 * variant: 'success' | 'danger' | 'warning' | 'muted'
 */
export default function Badge({ label, variant = 'success', className = '' }) {
  const variants = {
    success: 'bg-success/15',
    danger:  'bg-danger/15',
    warning: 'bg-accent/15',
    muted:   'bg-muted/15',
  };

  const textVariants = {
    success: 'text-success',
    danger:  'text-danger',
    warning: 'text-accent-dark',
    muted:   'text-muted',
  };

  return (
    <View className={`rounded-full px-3 py-0.5 self-start ${variants[variant]} ${className}`}>
      <Text className={`text-xs font-bold ${textVariants[variant]}`}>{label}</Text>
    </View>
  );
}
