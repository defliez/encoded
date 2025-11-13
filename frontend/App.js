import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/FontAwesome';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

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
        background: '#000',
        card: '#111',
        text: '#8bc34a',
        border: '#333',
        primary: '#8bc34a',
    },
};

const DiscoTheme = {
    ...DefaultTheme,
    colors: {
        ...DefaultTheme.colors,
        background: '#05060a',
        card: '#090c14',
        text: '#f1e9dc',
        border: '#2e3547',
        primary: '#ffb15e',
    },
};

const screenOptions = {
    headerStyle: { backgroundColor: DiscoTheme.colors.card },
    headerTitleStyle: {
        color: DiscoTheme.colors.text,
        letterSpacing: 2,
        fontSize: 14,
    },
    headerTintColor: DiscoTheme.colors.primary,
};

function MapStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ title: 'FIELD' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'MISSION DOSSIER' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'CONTACT AGENT' }} />
        </Stack.Navigator>
    );
}

function AgentProfileStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="AgentProfile" component={AgentProfile} options={{ title: 'AGENT PROFILE' }} />
        </Stack.Navigator>
    );
}

function ActiveMissionsStack() {
    return (
        <Stack.Navigator screenOptions={screenOptions}>
            <Stack.Screen name="ActiveMissionsScreen" component={ActiveMissionsScreen} options={{ title: 'ACTIVE MISSIONS' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'MISSION DOSSIER' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'CONTACT AGENT' }} />
        </Stack.Navigator>
    );
}

function Root() {
    const { authUser, loading } = useUser();

    if (loading) return null;

    return (
        <NavigationContainer theme={DiscoTheme}>
            {authUser ? (
                <Tab.Navigator
                    initialRouteName="Map"
                    screenOptions={{
                        headerShown: false,
                        tabBarStyle: {
                            backgroundColor: DiscoTheme.colors.card,
                            borderTopColor: DiscoTheme.colors.border,
                                borderTopWidth: 1,
                                height: 72,
                                paddingBottom: 8,
                                paddingTop: 4,
                        },
                        tabBarActiveTintColor: DiscoTheme.colors.primary,
                        tabBarInactiveTintColor: '#6f7485',
                        tabBarLabelStyle: {
                            fontSize: 10,
                            letterSpacing: 1,
                        },
                    }}
                >
                    <Tab.Screen
                        name="MAP"
                        component={MapStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                // <Icon name="map" color={color} size={size} />
                                <MaterialCommunityIcons name="radar" color={color} size={size} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="AGENT PROFILE"
                        component={AgentProfileStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <Icon name="id-badge" color={color} size={size} />
                            ),
                        }}
                    />
                    <Tab.Screen
                        name="ACTIVE MISSIONS"
                        component={ActiveMissionsStack}
                        options={{
                            tabBarIcon: ({ color, size }) => (
                                <Icon name="user-secret" color={color} size={size} />
                            ),
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
