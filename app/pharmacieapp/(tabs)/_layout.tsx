import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 20,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 0.3,
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
            <View style={focused ? {
              backgroundColor: Colors.primaryLight,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <Ionicons name={focused ? 'search' : 'search-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="garde"
        options={{
          title: 'De Garde',
          tabBarIcon: ({ color, focused }) => (
            <View style={focused ? {
              backgroundColor: Colors.primaryLight,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 4,
            } : undefined}>
              <Ionicons name={focused ? 'moon' : 'moon-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
