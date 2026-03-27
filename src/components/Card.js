import React from 'react';
import { View, StyleSheet } from 'react-native';

/**
 * Card branco com sombra suave.
 * Aceita className para customização via NativeWind e style para overrides pontuais.
 */
export default function Card({ children, className = '', style }) {
  return (
    <View
      className={`bg-surface-card rounded-2xl ${className}`}
      style={[styles.shadow, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});
