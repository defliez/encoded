import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';

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
    const [acceptedMissionIds, setAcceptedMissionIds] = useState([]);
    const [loading, setLoading] = useState(true);

    const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';
    const ACCEPT_DISTANCE_METERS = 100;

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
        const fetchMissions = async () => {
            const { data: participations, error: participationError } = await supabase
                .from('mission_participation')
                .select('mission_id')
                .eq('player_id', MOCK_PLAYER_ID)
                .is('completed_at', null);

            if (participationError) {
                console.error(participationError);
                return;
            }

            const acceptedIds = participations?.map((p) => p.mission_id) || [];
            setAcceptedMissionIds(acceptedIds);

            const excludedIdsString = acceptedIds.join(',');
            const { data: filtered, error: filteredError } = await supabase
                .from('missions')
                .select('*')
                .not('id', 'in', `(${excludedIdsString})`);

            if (filteredError) console.error(filteredError);

            const { data: acceptedMissions, error: acceptedMissionsError } = await supabase
                .from('missions')
                .select('*')
                .in('id', acceptedIds);

            if (acceptedMissionsError) console.error(acceptedMissionsError);

            const allMissions = [...(filtered || []), ...(acceptedMissions || [])];
            setMissions(allMissions);

            setLoading(false);
        };

        fetchMissions();
    }, []);

    if (!location || loading) {
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

                    const isAccepted = acceptedMissionIds.includes(mission.id);
                    const withinRange = distance <= ACCEPT_DISTANCE_METERS;

                    let pinColor = 'green';
                    if (isAccepted) pinColor = 'orange';
                    else if (!withinRange) x = 'gray';

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
                                if (isAccepted || withinRange) {
                                    navigation.navigate('MissionDetails', {
                                        mission,
                                        playerId: MOCK_PLAYER_ID,
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
