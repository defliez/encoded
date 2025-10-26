import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { useUser } from './UserContext';

export default function MissionDetails({ route, navigation }) {
    const [alreadyStarted, setAlreadyStarted] = useState(false);
    const [npc, setNpc] = useState(null);
    const [loading, setLoading] = useState(true);
    const { mission } = route.params;
    const { authUser } = useUser();

    // --- Fetch NPC info ---
    useEffect(() => {
        const fetchNpc = async () => {
            try {
                const { data: npcData } = await supabase
                    .from('npcs')
                    .select('id, name')
                    .eq('id', mission.npc_id)
                    .single();
                setNpc(npcData);
            } catch (err) {
                console.error("Failed to fetch NPC", err);
            }
            setLoading(false);
        };
        fetchNpc();
    }, []);

    // --- Check if mission already started ---
    useEffect(() => {
        if (!authUser) return;
        const checkParticipation = async () => {
            const { data } = await supabase
                .from('mission_participation')
                .select('id')
                .eq('player_id', authUser.id)
                .eq('mission_id', mission.id)
                .is('completed_at', null)
                .maybeSingle();

            if (data) setAlreadyStarted(true);
        };
        checkParticipation();
    }, [authUser, mission.id]);

    const handleStartMission = async () => {
        try {
            const { data, error } = await supabase
                .from('mission_participation')
                .insert([
                    {
                        player_id: authUser.id,
                        mission_id: mission.id,
                    },
                ])
                .select()
                .single();

            if (error) throw error;

            setAlreadyStarted(true);

            setTimeout(() => {
                navigation.navigate('NPCChat', {
                    npcId: mission.npc_id,
                    missionId: mission.id,
                    missionTitle: mission.title,
                });
            }, 150);
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Failed to start mission.');
        }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color="#fff" size="large" />;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{mission.title}</Text>
            {npc && <Text style={styles.subtitle}>Handler: {npc.name}</Text>}
            <Text style={styles.description}>{mission.description}</Text>
            <Text style={styles.meta}>
                📍 Location: {mission.lat.toFixed(4)}, {mission.lon.toFixed(4)}
            </Text>

            {alreadyStarted ? (
                <Text style={styles.started}>Already started</Text>
            ) : (
                <Button title="Start Mission" onPress={handleStartMission} />
            )}
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
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        marginBottom: 10,
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
    started: {
        color: '#999',
        marginTop: 20,
        fontSize: 16,
    },
});
