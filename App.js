import "./global.css";

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';

import { FarmProvider, useFarm } from './src/storage/FarmContext';
import { StorageProvider } from './src/storage/StorageContext';
import FarmSetupScreen from './src/screens/FarmSetupScreen';
import HomeScreen from './src/screens/HomeScreen';
import EstoqueScreen from './src/screens/EstoqueScreen';
import TalhaoScreen from './src/screens/TalhaoScreen';
import ColheitaScreen from './src/screens/ColheitaScreen';
import RelatorioScreen from './src/screens/RelatorioScreen';

SplashScreen.preventAutoHideAsync();

const Tab = createBottomTabNavigator();

const PRIMARY  = '#1B4332';
const ACCENT   = '#D4A017';
const INACTIVE = '#9CA3AF';

const TAB_ICONS = {
  Home:      'home',
  Estoque:   'cube-outline',
  Talhao:    'map-outline',
  Colheita:  'basket-outline',
  Relatorio: 'bar-chart-outline',
};

function AppContent() {
  const { farmCode, loading } = useFarm();

  if (loading) return null;
  if (!farmCode) return <FarmSetupScreen />;

  return (
    <StorageProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
            ),
            tabBarStyle: {
              backgroundColor: PRIMARY,
              borderTopWidth: 0,
              height: 64,
              paddingBottom: 8,
              paddingTop: 4,
            },
            tabBarActiveTintColor:   ACCENT,
            tabBarInactiveTintColor: INACTIVE,
            tabBarLabelStyle: {
              fontFamily: 'Inter_500Medium',
              fontSize: 11,
            },
            headerStyle:      { backgroundColor: PRIMARY },
            headerTintColor:  '#FFFFFF',
            headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 18 },
            headerTitleAlign: 'center',
          })}
        >
          <Tab.Screen name="Home"      component={HomeScreen}      options={{ title: 'Montico Farm Pro', tabBarLabel: 'Início'   }} />
          <Tab.Screen name="Estoque"   component={EstoqueScreen}   options={{ title: 'Estoque',          tabBarLabel: 'Estoque'  }} />
          <Tab.Screen name="Talhao"    component={TalhaoScreen}    options={{ title: 'Talhões',          tabBarLabel: 'Talhão'   }} />
          <Tab.Screen name="Colheita"  component={ColheitaScreen}  options={{ title: 'Colheita',         tabBarLabel: 'Colheita' }} />
          <Tab.Screen name="Relatorio" component={RelatorioScreen} options={{ title: 'Relatórios',       tabBarLabel: 'Relatório'}} />
        </Tab.Navigator>
      </NavigationContainer>
    </StorageProvider>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <FarmProvider>
        <AppContent />
      </FarmProvider>
    </SafeAreaProvider>
  );
}
