import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import CitySearchScreen from './src/screens/CitySearchScreen';
import MyLocationScreen from './src/screens/MyLocationScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
            tabBarLabelStyle: { fontSize: 12 },
          }}
        >
          <Tab.Screen name="Mi ubicación" component={MyLocationScreen} />
          <Tab.Screen name="Buscar ciudad" component={CitySearchScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
