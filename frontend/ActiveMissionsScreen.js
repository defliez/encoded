import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useUser } from './UserContext';

import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabaseClient';

export default function ActiveMissionsScreen({ navigation }) {
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(true);

    const { authUser, loading: userLoading } = useUser();


    const fetchCurrentMissions = async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('mission_participation')
            .select('*, missions(*)')
            .eq('player_id', authUser.id)
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
                .eq('player_id', authUser.id)
                .eq('mission_id', missionId)
                .is('completed_at', null);

            if (updateError) throw updateError;

            const { data: playerData, error: playerError } = await supabase
                .from('players')
                .select('reputation')
                .eq('id', authUser.id)
                .single();

            if (playerError) throw playerError;

            const currentRep = playerData?.reputation || 0;
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
                .eq('id', authUser.id);

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

    if (userLoading || loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

    if (!missions || missions.length === 0) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>No active mission</Text>
            </View>
        );
    }

    const renderItem = ({ item }) => (
        <View style={styles.missionBox}>
            <Text style={styles.title}>{item.missions.title}</Text>
            <Text style={styles.description}>{item.missions.description}</Text>
            <View style={styles.missionDetails}>
                <Button
                    title="Details"
                    onPress={() =>
                        navigation.navigate('MissionDetails', {
                            mission: item.missions,
                            playerId: authUser.id,
                        })
                    }
                />
                <Button
                    title="Chat"
                    onPress={() =>
                        navigation.navigate('NPCChat', {
                            npcId: item.missions.npc_id,
                        })
                    }
                />
                <Button
                    title="Complete"
                    onPress={() => completeMission(item.mission_id, item.missions.title)}
                />
            </View>
        </View>
    );

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
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
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
