import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    Button,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabaseClient';

const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';

export default function ActiveMissionsScreen({ navigation }) {
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCurrentMissions = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('mission_participation')
            .select('*, missions(*)')
            .eq('player_id', MOCK_PLAYER_ID)
            .is('completed_at', null)
            .order('started_at', { ascending: false });

        if (error) {
            console.error(error);
        } else {
            setMissions(data || []);
        }

        setLoading(false);
    };

    useFocusEffect(
        useCallback(() => {
            fetchCurrentMissions();
        }, [])
    );

    const completeMission = async (missionId, missionTitle) => {
        try {
            const now = new Date().toISOString();

            const { error: updateError } = await supabase
                .from('mission_participation')
                .update({ completed_at: now, status: 'completed' })
                .eq('player_id', MOCK_PLAYER_ID)
                .eq('mission_id', missionId);

            if (updateError) throw updateError;

            const { data: playerData, error: playerError } = await supabase
                .from('players')
                .select('reputation')
                .eq('id', MOCK_PLAYER_ID)
                .single();

            if (playerError) throw playerError;

            const currentRep = playerData.reputation || 0;
            const pointsEarned = 50;
            const newRep = currentRep + pointsEarned;

            let newTier = 'F';
            if (newRep >= 900) newTier = 'S';
            else if (newRep >= 700) newTier = 'A';
            else if (newRep >= 500) newTier = 'B';
            else if (newRep >= 300) newTier = 'C';
            else if (newRep >= 200) newTier = 'D';
            else if (newRep >= 100) newTier = 'E';

            const { error: repError } = await supabase
                .from('players')
                .update({ reputation: newRep, tier: newTier })
                .eq('id', MOCK_PLAYER_ID);

            if (repError) throw repError;

            Alert.alert(
                '🎉 Mission Complete!',
                `You completed ${missionTitle}.\n+${pointsEarned} points\nNew Tier: ${newTier}`
            );

            fetchCurrentMissions();
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Mission completion failed.');
        }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

    const renderItem = ({ item }) => (
        <View style={styles.missionBox}>
            <Text style={styles.title}>{item.missions.title}</Text>
            <Text style={styles.description}>{item.missions.description}</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                <Button
                    title="Details"
                    onPress={() =>
                        navigation.navigate('MissionDetails', {
                            mission: item.missions,
                            playerId: MOCK_PLAYER_ID,
                        })
                    }
                />
                <Button
                    title="Complete Mission"
                    onPress={() => completeMission(item.mission_id, item.missions.title)}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            {missions.length === 0 ? (
                <Text style={styles.message}>No active mission</Text>
            ) : (
                <FlatList
                    data={missions}
                    keyExtractor={(item) => `${item.player_id}-${item.mission_id}`}
                    renderItem={renderItem}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        backgroundColor: '#222',
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
    },
    missionDetails: {
        alignSelf: 'flex-end',
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
