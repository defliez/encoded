import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';

import LoginScreen from './LoginScreen';
import MapScreen from './MapScreen';
import AgentProfile from './AgentProfile';
import MissionDetails from './MissionDetails';
import ActiveMissionsScreen from './ActiveMissionsScreen';
import NPCChat from './NPCChat';

import { UserProvider, useUser } from './UserContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Spy-themed global navigation color scheme
const SpyTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#000',       // Background of app
        card: '#111',             // Header background
        text: '#8bc34a',          // Header and tab text
        border: '#333',           // Optional: bottom border color
        primary: '#8bc34a',       // Tint color (back arrow, etc)
    },
};

const screenOptions = {
    headerStyle: { backgroundColor: '#111' },
    headerTitleStyle: { color: '#8bc34a' },
    headerTintColor: '#8bc34a',
};

function MapStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ title: 'Map' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
        </Stack.Navigator>
    );
}

function AgentProfileStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="AgentProfile" component={AgentProfile} options={{ title: 'Agent Profile' }} />
        </Stack.Navigator>
    );
}

function ActiveMissionsStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="ActiveMissionsScreen" component={ActiveMissionsScreen} options={{ title: 'Active Missions' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
        </Stack.Navigator>
    );
}

function Root() {
    const { authUser, loading } = useUser();

    if (loading) return null;

    return (
        <NavigationContainer theme={SpyTheme}>
            {authUser ? (
                <Tab.Navigator
                    initialRouteName="Map"
                    screenOptions={{
                        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
                        tabBarActiveTintColor: '#8bc34a',
                        tabBarInactiveTintColor: '#555',
                    }}
                >
                    <Tab.Screen
                        name="Map"
                        component={MapStack}
                        options={{
                            headerShown: false,
                            tabBarIcon: ({ color, size }) => <Icon name="map" color={color} size={size} />,
                        }}
                    />
                    <Tab.Screen
                        name="Agent Profile"
                        component={AgentProfileStack}
                        options={{
                            headerShown: false,
                            tabBarIcon: ({ color, size }) => <Icon name="id-badge" color={color} size={size} />,
                        }}
                    />
                    <Tab.Screen
                        name="Active Missions"
                        component={ActiveMissionsStack}
                        options={{
                            headerShown: false,
                            tabBarIcon: ({ color, size }) => <Icon name="user-secret" color={color} size={size} />,
                        }}
                    />
                </Tab.Navigator>
            ) : (
                <Stack.Navigator screenOptions={screenOptions}>
                    <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
                </Stack.Navigator>
            )}
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <UserProvider>
            <Root />
        </UserProvider>
    );
}
