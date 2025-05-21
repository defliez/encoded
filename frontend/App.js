// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MissionList from './MissionList';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Missions">
        <Stack.Screen name="Missions" component={MissionList} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

