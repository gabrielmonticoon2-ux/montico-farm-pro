import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

/**
 * Input com label acima e borda de foco dinâmica.
 * Altura mínima 52px para uso em campo.
 */
export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
  autoCapitalize = 'sentences',
  className = '',
  style,
  ...rest
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View className={`gap-1 ${className}`}>
      {label && (
        <Text className="text-xs font-bold text-muted uppercase tracking-wide">{label}</Text>
      )}
      <TextInput
        className={`bg-surface-card rounded-xl px-4 font-sans text-base text-gray-800 border ${
          focused ? 'border-primary-light' : 'border-gray-200'
        }`}
        style={[styles.minHeight, multiline && styles.multiline, style]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  minHeight: { minHeight: 52 },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
});
