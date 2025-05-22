// CurrentMission.js
import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { supabase } from './supabaseClient';

const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';

export default function CurrentMission() {
    const [mission, setMission] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCurrentMission = async () => {
            const { data, error } = await supabase
                .from('mission_participation')
                .select('*, missions(*)')
                .eq('player_id', MOCK_PLAYER_ID)
                .is('completed_at', null)
                .order('started_at', { ascending: false })
                .limit(1);

            if (error) {
                console.error(error);
            } else if (data.length > 0) {
                setMission(data[0].missions);
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

    if (!mission) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>No active mission</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{mission.title}</Text>
            <Text style={styles.description}>{mission.description}</Text>
            <Button title="✅ Complete Mission" onPress={completeMission} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#111',
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
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: '#ccc',
        marginBottom: 24,
        textAlign: 'center',
    },
});

