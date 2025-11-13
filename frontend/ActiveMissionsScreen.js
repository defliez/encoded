import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Button, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
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

    if (userLoading || loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffb15e" />
                <Text style={styles.loadingText}>Fetching active missions...</Text>
            </View>
        );
    }

    if (!missions || missions.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>No active mission</Text>
                <Text style={styles.emptyMessage}>
                    Scan the city from the map screen to pick up new work.
                </Text>
            </View>
        );
    }

    const renderItem = ({ item }) => (
        <View style={styles.missionBox}>
            <Text style={styles.label}>CONTRACT</Text>
            <Text style={styles.title}>{item.missions.title}</Text>
            <Text style={styles.description}>{item.missions.description}</Text>

            <View style={styles.missionDetails}>
                {item.started_at && (
                    <Text style={styles.metaText}>
                        Started: {new Date(item.started_at).toLocaleString()}
                    </Text>
                )}
            </View>

            <View style={styles.missionDetails}>
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() =>
                        navigation.navigate('MissionDetails', {
                            mission: item.missions,
                            playerId: authUser.id,
                        })
                    }
                >
                    <Text style={styles.actionButtonText}>Details</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                    onPress={() =>
                        navigation.navigate('NPCChat', {
                            npcId: item.missions.npc_id,
                            missionId: item.missions.id
                        })
                    }
                >
                    <Text style={styles.actionButtonText}>Chat</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => abandonMission(item.mission_id, item.missions.title)}
                >
                    <Text style={styles.actionButtonText}>Abandon</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={missions}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05060a',
    },
    listContent: {
        padding: 16,
        paddingBottom: 24,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#05060a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        color: '#f1e9dc',
        fontSize: 14,
        letterSpacing: 1,
    },
    emptyContainer: {
        flex: 1,
        backgroundColor: '#05060a',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        color: '#f1e9dc',
        marginBottom: 8,
        letterSpacing: 2,
    },
    emptyMessage: {
        fontSize: 14,
        color: '#9da6b8',
        textAlign: 'center',
    },
    missionBox: {
        backgroundColor: 'rgba(9, 12, 20, 0.95)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#2e3547',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 14,
    },
    label: {
        fontSize: 11,
        color: '#ffb15e',
        letterSpacing: 2,
        marginBottom: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#f1e9dc',
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        color: '#c6cedd',
        marginBottom: 12,
    },
    missionMeta: {
        marginBottom: 12,
    },
    metaText: {
        fontSize: 12,
        color: '#7d8598',
    },
    missionDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: '#ffb15e',
    },
    actionButtonSecondary: {
        backgroundColor: '#2a3040',
    },
    actionButtonDanger: {
        backgroundColor: '#7f2635',
    },
    actionButtonText: {
        color: '#05060a',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 1,
    },
});
