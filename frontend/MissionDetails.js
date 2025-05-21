// MissionDetails.js
import React from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { supabase } from './supabaseClient';

export default function MissionDetails({ route, navigation }) {
  const { mission, playerId } = route.params;

  const handleStartMission = async () => {
    const { data, error } = await supabase.from('mission_participation').insert([
      {
        player_id: playerId,
        mission_id: mission.id,
      },
    ]);

    if (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to start mission.');
    } else {
      Alert.alert('Mission Started!', `You started: ${mission.title}`);
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{mission.title}</Text>
      <Text style={styles.description}>{mission.description}</Text>
      <Text style={styles.meta}>
        Location: {mission.lat.toFixed(4)}, {mission.lon.toFixed(4)}
      </Text>
      <Button title="Start Mission" onPress={handleStartMission} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#111',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 12,
  },
  meta: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },
});

