// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
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

function MapStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ title: 'Map' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
        </Stack.Navigator>
    );
}

function AgentProfileStack() {
    return (
        <Stack.Navigator>
            <Tab.Screen name="AgentProfile" component={AgentProfile} options={{ title: 'Agent profile' }} />
        </Stack.Navigator>
    );
}

function ActiveMissionsStack() {
    return (
        <Stack.Navigator>
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
        <NavigationContainer>
            {authUser ? (
                <Tab.Navigator initialRouteName="Map">
                    <Tab.Screen name="Map" component={MapStack} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="map" color={color} size={size} /> }} />
                    <Tab.Screen name="Agent Profile" component={AgentProfileStack} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="id-badge" color={color} size={size} /> }} />
                    <Tab.Screen name="Active Missions" component={ActiveMissionsStack} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Icon name="user-secret" color={color} size={size} /> }} />
                </Tab.Navigator>
            ) : (
                <Stack.Navigator>
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

