import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';

import MapScreen from './MapScreen';
import AgentProfile from './AgentProfile';
import MissionDetails from './MissionDetails';
import ActiveMissionsScreen from './ActiveMissionsScreen';
import NPCChat from './NPCChat';

import { UserProvider } from './UserContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MapStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#111' },
                headerTitleStyle: { color: '#8bc34a' },
                headerTintColor: '#8bc34a',
            }}
        >
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ title: 'Map' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
        </Stack.Navigator>
    );
}

function AgentProfileStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#111' },
                headerTitleStyle: { color: '#8bc34a' },
                headerTintColor: '#8bc34a',
            }}
        >
            <Stack.Screen name="AgentProfile" component={AgentProfile} options={{ title: 'Agent Profile' }} />
        </Stack.Navigator>
    );
}

function ActiveMissionsStack() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: { backgroundColor: '#111' },
                headerTitleStyle: { color: '#8bc34a' },
                headerTintColor: '#8bc34a',
            }}
        >
            <Stack.Screen name="ActiveMissionsScreen" component={ActiveMissionsScreen} options={{ title: 'Active Missions' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <UserProvider>
            <NavigationContainer theme={DarkTheme}>
                <Tab.Navigator
                    initialRouteName="Map"
                    screenOptions={{
                        tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
                        tabBarActiveTintColor: '#8bc34a',
                        tabBarInactiveTintColor: '#888',
                        headerShown: false,
                    }}
                >
                    <Tab.Screen
                        name="Map"
                        component={MapStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <Icon name="map" color={color} size={size} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="Agent Profile"
                        component={AgentProfileStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <Icon name="id-badge" color={color} size={size} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="Active Missions"
                        component={ActiveMissionsStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <Icon name="user-secret" color={color} size={size} />
                            ),
                        }}
                    />
                </Tab.Navigator>
            </NavigationContainer>
        </UserProvider>
    );
}
