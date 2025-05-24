// ActiveMissionsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { supabase } from './supabaseClient';

const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';

export default function ActiveMissionsScreen() {
    const [mission, setMission] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCurrentMission = async () => {
            const { data, error } = await supabase
                .from('mission_participation')
                .select('*, missions(*)')
                .eq('player_id', MOCK_PLAYER_ID)
                .is('completed_at', null)
                .order('started_at', { ascending: false })

            if (error) {
                console.error(error);
            } else if (data.length > 0) {
                console.log("smarta namn", data);
                setMission(data);
            }

            setLoading(false);
        };

        fetchCurrentMission();
    }, []);

    const completeMission = async () => {
        const { error } = await supabase
            .from('mission_participation')
            .update({ completed_at: new Date().toISOString() })
            .eq('player_id', MOCK_PLAYER_ID)
            .eq('mission_id', mission.id)
            .is('completed_at', null);

        if (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to complete mission.');
        } else {
            Alert.alert('🎉 Mission Complete!', `You completed ${mission.title}`);
            setMission(null);
        }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

    mission.forEach(m => console.log(m.missions));
    if (!mission) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>No active mission</Text>
            </View>
        );
    }

    const renderItem = ({ item }) => {

        return (
            <View style={styles.missionBox}>
                <Text style={styles.title}>{item.missions.title}</Text>
                <Text>{item.missions.description}</Text>
                {/*<Text>📍 {item.distance.toFixed(2)} km away</Text>*/}
                <View style={styles.missionDetails}>
                    <Button
                        title="Mission Details"
                        onPress={() =>
                            navigation.navigate('MissionDetails', {
                                mission: item,
                                playerId: MOCK_PLAYER_ID,
                            })
                        }
                    />
                </View>
            </View>
        )
    };


    return (
        <View style={styles.container}>
            <View style={styles.missionBox}>
                <FlatList
                    data={mission}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                />

                <Text style={styles.title}>{mission.title}</Text>
                <Text>{mission.description}</Text>
            </View>
        </View>

    );

}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#222',
        justifyContent: 'center',
    },
    message: {
        fontSize: 18,
        color: '#999',
        textAlign: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 12,
        textAlign: 'left',
    },
    missionDetails: {
        alignSelf: 'flex-end'
    },
    description: {
        fontSize: 16,
        color: '#ccc',
        marginBottom: 24,
        textAlign: 'center',
    },
    missionBox: {
        backgroundColor: '#999',
        padding: 16,
        marginBottom: 12,
        borderRadius: 10,
    },
});

