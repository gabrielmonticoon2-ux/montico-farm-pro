import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

/**
 * Cabeçalho de seção com título e ação opcional.
 * action: { label: string, onPress: () => void }
 */
export default function SectionHeader({ title, action, className = '' }) {
  return (
    <View className={`flex-row items-center justify-between mb-3 ${className}`}>
      <Text className="text-base font-bold text-primary">{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress} activeOpacity={0.7}>
          <Text className="text-sm font-medium text-primary-light">{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
