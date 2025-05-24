import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';

export default function MapScreen({ navigation }) {
    const [location, setLocation] = useState(null);
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);

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

            const startedMissionIds = participations.map((p) => p.mission_id);
            console.log('startedMissionIds:', startedMissionIds);

            let query = supabase.from('missions').select('*');
            console.log('query1:', query);

            if (startedMissionIds.length > 0) {
                query = query.not('id', 'in', `(${startedMissionIds.join(',')})`);
            }
            console.log('query:', query);

            const { data: filtered, error: filteredError } = await query;
            const p = filtered.map((d) => d.id) || [];
            console.log('final:', p);

            if (filteredError) console.error(filteredError);
            if (filtered) setMissions(filtered);
            console.log("missions:", missions);
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
                {missions.map((mission) => (
                    <Marker
                        key={mission.id}
                        coordinate={{ latitude: mission.lat, longitude: mission.lon }}
                        title={mission.title}
                        description={mission.description}
                        onPress={() => navigation.navigate('MissionDetails', { mission, playerId: '00000000-0000-0000-0000-000000000000' })} // Replace playerId later
                    />
                ))}
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


