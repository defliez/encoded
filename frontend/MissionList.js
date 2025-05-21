// MissionList.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';

export default function MissionList() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        alert('Location permission denied');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
    })();
  }, []);

  useEffect(() => {
    if (!location) return;

    const fetchMissions = async () => {
      const { data, error } = await supabase.from('missions').select('*');
      if (error) console.error(error);

      if (data) {
        const missionsWithDistance = data.map((mission) => {
          const distance = getDistanceFromLatLonInKm(
            location.coords.latitude,
            location.coords.longitude,
            mission.lat,
            mission.lon
          );
          return { ...mission, distance };
        });
        setMissions(missionsWithDistance);
        setLoading(false);
      }
    };

    fetchMissions();
  }, [location]);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  const renderItem = ({ item }) => (
    <View style={styles.missionBox}>
      <Text style={styles.title}>{item.title}</Text>
      <Text>{item.description}</Text>
      <Text>📍 {item.distance.toFixed(2)} km away</Text>
      <Button title="Start Mission" onPress={() => alert('Start mission logic here')} />
    </View>
  );

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

  return (
    <View style={styles.container}>
      <FlatList
        data={missions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#111',
  },
  missionBox: {
    backgroundColor: '#222',
    padding: 16,
    marginBottom: 12,
    borderRadius: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
});

