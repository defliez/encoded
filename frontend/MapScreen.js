// MapScreen.js
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';
import { useUser } from './UserContext';


function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function MapScreen({ navigation }) {
    const [location, setLocation] = useState(null);
    const [missions, setMissions] = useState([]);
    const [acceptedMissions, setAcceptedMissions] = useState({});
    const [loading, setLoading] = useState(true);

    const { authUser, loading: userLoading } = useUser();

    const ACCEPT_DISTANCE_METERS = 100;

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchLocationAndMissions = async () => {
                try {
                    setLoading(true);

                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        alert('Location permission denied');
                        return;
                    }
                    const loc = await Location.getCurrentPositionAsync({});
                    if (isActive) setLocation(loc);

                    const { data: allMissions, error: missionsError } = await supabase
                        .from('missions')
                        .select('*');
                    if (missionsError) throw missionsError;

                    const { data: participations, error: participationError } = await supabase
                        .from('mission_participation')
                        .select('mission_id, status, completed_at')
                        .eq('player_id', authUser.id);
                    if (participationError) throw participationError;

                    const participationMap = {};
                    participations.forEach((p) => {
                        participationMap[p.mission_id] = p;
                    });

                    const filtered = allMissions.filter((mission) => {
                        const p = participationMap[mission.id];

                        if (!p) return true;
                        if (!p.completed_at) return true;
                        if (['fail', 'abandoned'].includes(p.status)) return true;

                        return false;
                    });

                    if (isActive) {
                        setMissions(filtered);
                        setAcceptedMissions(participationMap);
                    }
                } catch (err) {
                    console.error('Error fetching map data:', err);
                } finally {
                    if (isActive) setLoading(false);
                }
            };

            fetchLocationAndMissions();

            return () => {
                isActive = false;
            };
        }, [])
    );

    if (!authUser || !location || userLoading || loading) {
        return <ActivityIndicator style={{ flex: 1 }} size="large" color="black" />;
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation={true}
            >
                <Circle
                    center={{
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                    }}
                    radius={ACCEPT_DISTANCE_METERS}
                    strokeColor="rgba(0,0,0,0.3)"
                    fillColor="rgba(0,255,0,0.1)"
                />

                {missions.map((mission) => {
                    const distance = getDistanceFromLatLonInMeters(
                        location.coords.latitude,
                        location.coords.longitude,
                        mission.lat,
                        mission.lon
                    );

                    const withinRange = distance <= ACCEPT_DISTANCE_METERS;
                    const isAccepted = !!acceptedMissions[mission.id];

                    let pinColor = 'green';
                    if (isAccepted) pinColor = 'orange';
                    else if (!withinRange) pinColor = 'gray';

                    return (
                        <Marker
                            key={mission.id}
                            coordinate={{ latitude: mission.lat, longitude: mission.lon }}
                            title={mission.title}
                            description={
                                isAccepted
                                    ? mission.description
                                    : withinRange
                                        ? mission.description
                                        : `Too far away (${Math.round(distance)}m)`
                            }
                            pinColor={pinColor}
                            onPress={() => {
                                if (withinRange || isAccepted) {
                                    navigation.navigate('MissionDetails', {
                                        mission,
                                        playerId: authUser.id,
                                    });
                                }
                            }}
                        />
                    );
                })}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        flex: 1,
    },
});
