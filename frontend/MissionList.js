import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Button, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';

export default function MissionList({ navigation }) {
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState(null);

    const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';

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

        const fetchFilteredMissions = async () => {
            try {
                const { data: allMissions, error: missionsError } = await supabase
                    .from('missions')
                    .select('*');

                if (missionsError) throw missionsError;

                const { data: participations, error: participationError } = await supabase
                    .from('mission_participation')
                    .select('mission_id, status, completed_at')
                    .eq('player_id', MOCK_PLAYER_ID);

                if (participationError) throw participationError;

                const participationMap = {};
                participations.forEach((p) => {
                    participationMap[p.mission_id] = p;
                });

                const visibleMissions = allMissions
                    .filter((mission) => {
                        const p = participationMap[mission.id];

                        if (!p) return true;
                        if (!p.completed_at) return true;
                        if (['fail', 'abandoned'].includes(p.status)) return true;

                        return false;
                    })
                    .map((mission) => {
                        const distance = getDistanceFromLatLonInKm(
                            location.coords.latitude,
                            location.coords.longitude,
                            mission.lat,
                            mission.lon
                        );
                        return { ...mission, distance };
                    });

                setMissions(visibleMissions);
            } catch (err) {
                console.error('Error fetching filtered missions:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchFilteredMissions();

        const interval = setInterval(fetchFilteredMissions, 10000);
        return () => clearInterval(interval);
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

    const renderItem = ({ item }) => {
        return (
            <View style={styles.missionBox}>
                <Text style={styles.title}>{item.title}</Text>
                <Text>{item.description}</Text>
                <Text>📍 {item.distance.toFixed(2)} km away</Text>
                <Button
                    title="Start Mission"
                    onPress={() =>
                        navigation.navigate('MissionDetails', {
                            mission: item,
                            playerId: MOCK_PLAYER_ID,
                        })
                    }
                />
            </View>
        );
    };

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
