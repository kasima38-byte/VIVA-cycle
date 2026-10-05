import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { isSetupDone } from '../../lib/setupState';

const NAVY = '#0B1F4F';
const NAVY_SOFT = '#38598F';
const MAGENTA = '#E9006F';
const BORDER = '#EFEBF2';

export default function TabsLayout() {
  // Show the welcome screen until setup is completed
  if (!isSetupDone()) return <Redirect href="/welcome" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: MAGENTA,
        tabBarInactiveTintColor: NAVY_SOFT,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: BORDER,
          borderTopWidth: 1,
          height: 64,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12.5,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '',
          tabBarIcon: () => (
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 29,
                backgroundColor: MAGENTA,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -22,
                shadowColor: MAGENTA,
                shadowOpacity: 0.28,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}