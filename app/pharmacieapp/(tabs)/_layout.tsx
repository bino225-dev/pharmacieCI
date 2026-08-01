import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surfaceContainerLowest,
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 28 : 12,
          paddingTop: 8,
          elevation: 0,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.04,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginTop: 2,
        },
        tabBarItemStyle: {
          gap: 2,
        },
      }}
    >
      <Tabs.Screen
        name="annuaire"
        options={{
          title: 'Annuaire',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={22}
              color={focused ? Colors.primary : color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="garde"
        options={{
          title: 'De Garde',
          tabBarActiveTintColor: Colors.accent,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'moon' : 'moon-outline'}
              size={22}
              color={focused ? Colors.accent : color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
