import { Image } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { HAIRLINE_WIDTH, Typography } from '@/constants/theme';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tabIconSelected,
        tabBarInactiveTintColor: Colors[colorScheme].tabIconDefault,
        tabBarStyle: {
          backgroundColor: Colors[colorScheme].background,
          borderTopColor: Colors[colorScheme].border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: 'JetBrainsMono_500Medium',
          fontSize: 9,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
        },
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation v6.
        headerShown: useClientOnlyValue(false, true),
        // DESIGN-SYSTEM.md void contract (checkpoint fix, Plan 03-10): the stock native
        // header rendered white with black text. Void background, bone Archivo-heavy
        // uppercase title, hairline bottom border instead of a shadow.
        headerStyle: {
          backgroundColor: Colors[colorScheme].background,
          borderBottomColor: Colors[colorScheme].border,
          borderBottomWidth: HAIRLINE_WIDTH,
        },
        headerShadowVisible: false,
        headerTintColor: Colors[colorScheme].text,
        headerTitleStyle: {
          ...Typography.heading,
          fontSize: 17,
          color: Colors[colorScheme].text,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Image
              source={require('../../assets/images/apsis-plate-mark.png')}
              style={{ width: 28, height: 28, tintColor: color }}
              resizeMode="contain"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          // Settings renders its own Design System v1 ScreenHeader inside a SafeAreaView —
          // showing the tab header too would double the header (and double the top inset).
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              tintColor={color}
              size={28}
            />
          ),
        }}
      />
    </Tabs>
  );
}
