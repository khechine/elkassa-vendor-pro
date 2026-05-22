import React, { useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { AuthService } from '@/services/auth';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#e64545', // Made-in-China Red
        tabBarInactiveTintColor: '#94a3b8',
        tabBarItemStyle: {
          borderRadius: 15,
          marginHorizontal: 5,
          marginVertical: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '900',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 60 + insets.bottom,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 32 : insets.bottom,
          marginHorizontal: Platform.OS === 'ios' ? 0 : 12,
          marginBottom: Platform.OS === 'ios' ? 0 : 0,
          borderRadius: Platform.OS === 'ios' ? 0 : 24,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 25,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
        },
        headerStyle: {
          backgroundColor: '#0a0f1e',
        },
        headerTitleStyle: {
          color: '#ffffff',
          fontWeight: '800',
        },
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tableau de Bord',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{
          title: 'Catalogue',
          tabBarLabel: 'Catalogue',
          tabBarIcon: ({ color }) => <TabBarIcon name="archive" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ventes"
        options={{
          title: 'Ventes',
          tabBarLabel: 'Ventes',
          tabBarIcon: ({ color }) => <TabBarIcon name="shopping-cart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Mon Wallet',
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color }) => <TabBarIcon name="credit-card" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Mon Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      {/* Legacy screens hidden from tab bar but kept for deep linking */}
      <Tabs.Screen name="products" options={{ href: null }} />
      <Tabs.Screen name="bundles" options={{ href: null }} />
      <Tabs.Screen name="orders" options={{ href: null }} />
      <Tabs.Screen name="rfq" options={{ href: null }} />
      <Tabs.Screen name="messaging" options={{ href: null }} />
      <Tabs.Screen name="rachma" options={{ href: null }} />
      <Tabs.Screen name="pos" options={{ href: null }} />
      <Tabs.Screen name="tables" options={{ href: null }} />
      <Tabs.Screen name="marketplace" options={{ href: null }} />
      <Tabs.Screen name="stocks" options={{ href: null }} />
      <Tabs.Screen name="suppliers" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
      {/* No scanner screen exists */}
    </Tabs>
  );
}
