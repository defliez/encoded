import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Switch,
    TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import { useUser } from './UserContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from './supabaseClient';

const AgentProfile = () => {
    const { authUser, loading: userLoading, signOut, error } = useUser();
    const navigation = useNavigation();

    const [isDarkMode, setIsDarkMode] = useState(false);
    const [allowNotifications, setAllowNotification] = useState(false);
    const [points, setPoints] = useState(0);
    const [tier, setTier] = useState('F');
    const [missionsCompleted, setMissionsCompleted] = useState(0);
    const [missionsFailed, setMissionsFailed] = useState(0);

    const alias = authUser?.codename || 'UNASSIGNED';

    const fetchPlayerStats = async () => {
        if (!authUser?.id) return;

        try {
            const { data: playerData, error: playerError } = await supabase
                .from('players')
                .select('reputation, tier')
                .eq('id', authUser.id)
                .single();

            if (playerError) throw playerError;

            const { data: participationData, error: participationError } = await supabase
                .from('mission_participation')
                .select('status, completed_at')
                .eq('player_id', authUser.id);

            if (participationError) throw participationError;

            const completed = participationData.filter(
                (p) => p.status === 'completed' && p.completed_at
            ).length;
            const failed = participationData.filter((p) =>
                ['fail', 'abandoned'].includes(p.status)
            ).length;

            setPoints(playerData?.reputation || 0);
            setTier(playerData?.tier || 'F');
            setMissionsCompleted(completed);
            setMissionsFailed(failed);
        } catch (err) {
            console.error('Error fetching player stats:', err);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPlayerStats();
        }, [authUser])
    );

    const handleLogout = async () => {
        await signOut();
        navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
        });
    };

    if (userLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffb15e" />
                <Text style={styles.loadingText}>Syncing agent dossier…</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>Error fetching user data: {error.message}</Text>
            </View>
        );
    }

    const totalMissions = missionsCompleted + missionsFailed;
    const completionRate =
        totalMissions > 0 ? Math.round((missionsCompleted / totalMissions) * 100) : 0;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            {/* Agent header */}
            <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                    <Icon name="user-circle" size={64} color="#ffb15e" />
                </View>
                <View style={styles.headerTextBlock}>
                    <Text style={styles.headerLabel}>AGENT ALIAS</Text>
                    <Text style={styles.alias}>{alias}</Text>
                    <View style={styles.tierRow}>
                        <Text style={styles.headerLabel}>TIER</Text>
                        <View style={styles.tierBadge}>
                            <Text style={styles.tierText}>{tier}</Text>
                        </View>
                    </View>
                    {authUser?.email && (
                        <Text style={styles.emailText}>{authUser.email}</Text>
                    )}
                </View>
            </View>

            {/* Stats / Mission card */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>OPERATION STATS</Text>

                <View style={styles.statsRow}>
                    <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>REPUTATION</Text>
                        <View style={styles.statValueRow}>
                            <Icon name="star" size={16} color="#ffb15e" />
                            <Text style={styles.statValue}>{points}</Text>
                        </View>
                    </View>

                    <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>CONTRACTS</Text>
                        <Text style={styles.statValue}>{totalMissions}</Text>
                    </View>

                    <View style={styles.statBlock}>
                        <Text style={styles.statLabel}>SUCCESS</Text>
                        <Text style={styles.statValue}>{completionRate}%</Text>
                    </View>
                </View>

                <View style={styles.separator} />

                <View style={styles.missionRow}>
                    <View style={styles.missionStat}>
                        <Text style={styles.missionStatLabel}>Completed</Text>
                        <Text style={styles.missionStatValue}>{missionsCompleted}</Text>
                    </View>
                    <View style={styles.missionStat}>
                        <Text style={styles.missionStatLabel}>Failed / Abandoned</Text>
                        <Text style={styles.missionStatValue}>{missionsFailed}</Text>
                    </View>
                </View>

                <View style={styles.progressWrapper}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${completionRate}%` },
                            ]}
                        />
                    </View>
                    <Text style={styles.progressCaption}>
                        Completion rate based on finished contracts.
                    </Text>
                </View>
            </View>

            {/* Local settings – not wired to backend yet, but actually usable */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>LOCAL SETTINGS</Text>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Interface theme</Text>
                        <Text style={styles.settingSub}>
                            Toggle visual theme (device-local only).
                        </Text>
                    </View>
                    <Switch
                        value={isDarkMode}
                        onValueChange={() => setIsDarkMode((prev) => !prev)}
                        trackColor={{ false: '#3c4256', true: '#ffb15e' }}
                        thumbColor={isDarkMode ? '#151821' : '#f1e9dc'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View>
                        <Text style={styles.settingLabel}>Alert prompts</Text>
                        <Text style={styles.settingSub}>
                            Enable experimental notifications (client-side placeholder).
                        </Text>
                    </View>
                    <Switch
                        value={allowNotifications}
                        onValueChange={() => setAllowNotification((prev) => !prev)}
                        trackColor={{ false: '#3c4256', true: '#ffb15e' }}
                        thumbColor="#151821"
                    />
                </View>
            </View>

            {/* Account / logout */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>ACCOUNT</Text>
                <View style={styles.accountRow}>
                    <View>
                        <Text style={styles.accountLabel}>Signed in as</Text>
                        <Text style={styles.accountValue}>{authUser?.email || 'Unknown'}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Icon name="sign-out" size={16} color="#151821" />
                    <Text style={styles.logoutText}>SIGN OUT</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#05060a',
        padding: 16,
        paddingBottom: 32,
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
    errorText: {
        color: '#ff6b6b',
        paddingHorizontal: 20,
        textAlign: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#090c14',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2e3547',
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 14,
    },
    avatar: {
        marginRight: 14,
    },
    headerTextBlock: {
        flex: 1,
    },
    headerLabel: {
        fontSize: 11,
        color: '#9da6b8',
        letterSpacing: 2,
        marginBottom: 2,
    },
    alias: {
        fontSize: 22,
        color: '#f1e9dc',
        marginBottom: 4,
    },
    tierRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    tierBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 177, 94, 0.15)',
        borderWidth: 1,
        borderColor: '#ffb15e',
    },
    tierText: {
        color: '#ffb15e',
        fontWeight: '700',
        fontSize: 12,
        letterSpacing: 1,
    },
    emailText: {
        fontSize: 12,
        color: '#7d8598',
    },
    card: {
        backgroundColor: '#090c14',
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#2e3547',
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 10,
    },
    cardTitle: {
        fontSize: 14,
        color: '#f1e9dc',
        letterSpacing: 2,
        marginBottom: 12,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statBlock: {
        flex: 1,
        marginRight: 8,
    },
    statLabel: {
        fontSize: 11,
        color: '#9da6b8',
        marginBottom: 4,
    },
    statValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 16,
        color: '#f1e9dc',
        fontWeight: '600',
    },
    separator: {
        height: 1,
        backgroundColor: '#1b2130',
        marginVertical: 8,
    },
    missionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    missionStat: {
        flex: 1,
        marginRight: 8,
    },
    missionStatLabel: {
        fontSize: 12,
        color: '#9da6b8',
        marginBottom: 2,
    },
    missionStatValue: {
        fontSize: 14,
        color: '#f1e9dc',
        fontWeight: '500',
    },
    progressWrapper: {
        marginTop: 4,
    },
    progressBar: {
        height: 8,
        borderRadius: 999,
        backgroundColor: '#141927',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#66f0c6',
    },
    progressCaption: {
        marginTop: 4,
        fontSize: 11,
        color: '#7d8598',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    settingLabel: {
        fontSize: 13,
        color: '#f1e9dc',
        marginBottom: 2,
    },
    settingSub: {
        fontSize: 11,
        color: '#7d8598',
        maxWidth: 220,
    },
    accountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    accountLabel: {
        fontSize: 12,
        color: '#9da6b8',
    },
    accountValue: {
        fontSize: 14,
        color: '#f1e9dc',
        marginTop: 2,
    },
    logoutButton: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: '#ffb15e',
        gap: 8,
    },
    logoutText: {
        color: '#151821',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 1,
    },
});

export default AgentProfile;

