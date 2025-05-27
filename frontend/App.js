// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MapScreen from './MapScreen';
import MissionList from './MissionList';
import MissionDetails from './MissionDetails';
import ActiveMissionsScreen from './ActiveMissionsScreen';
import NPCChat from './NPCChat';

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

function MissionsStack() {
    return (
        <Stack.Navigator>
            <Tab.Screen name="Missions" component={MissionList} options={{ title: 'Missions' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
            <Stack.Screen name="NPCChat" component={NPCChat} options={{ title: 'Contact NPC' }} />
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

export default function App() {
    return (
        <NavigationContainer>
            <Tab.Navigator initialRouteName="Map">
                <Tab.Screen name="Map" component={MapStack} options={{ headerShown: false }} />
                <Tab.Screen name="Missions" component={MissionsStack} options={{ headerShown: false }} />
                <Tab.Screen name="Active Missions" component={ActiveMissionsStack} options={{ headerShown: false }} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

