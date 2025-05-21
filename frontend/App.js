// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import MapScreen from './MapScreen';
import MissionList from './MissionList';
import MissionDetails from './MissionDetails';
import CurrentMission from './CurrentMission';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MapStack() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="MapScreen" component={MapScreen} options={{ title: 'Map' }} />
            <Stack.Screen name="MissionDetails" component={MissionDetails} options={{ title: 'Mission Details' }} />
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <NavigationContainer>
            <Tab.Navigator initialRouteName="Map">
                <Tab.Screen name="Map" component={MapStack} options={{ headerShown: false }} />
                <Tab.Screen name="Missions" component={MissionList} />
                <Tab.Screen name="Active Mission" component={CurrentMission} />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

