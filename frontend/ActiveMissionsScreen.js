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

    const abandonMission = (missionId, missionTitle) => {
        Alert.alert(
            'Abandon mission?',
            `You will drop "${missionTitle}".`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Abandon',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('mission_participation')
                                .delete()
                                .eq('player_id', authUser.id)
                                .eq('mission_id', missionId)
                                .is('completed_at', null);

                            if (error) throw error;

                            Alert.alert('Mission abandoned');
                            fetchCurrentMissions(); // refresh list
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'Could not abandon mission.');
                        }
                    }
                }
            ]
        );
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
                            missionId: item.missions.id
                        })
                    }
                />
                <Button
                    title="Abandon"
                    onPress={() => abandonMission(item.mission_id, item.missions.title)}
                />
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={missions}
                keyExtractor={(item) => String(item.id)}
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
