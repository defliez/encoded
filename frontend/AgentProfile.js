import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Switch, ScrollView, Button, Alert, ActivityIndicator } from 'react-native';
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

    // Placeholders
    const [profilePicture] = useState(null);
    const [skills] = useState([]);
    const [inventory] = useState([]);
    const [achievements] = useState([]);
    const [friends] = useState([]);

    const alias = authUser?.codename || 'tba';

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

            const completed = participationData.filter(p => p.status === 'completed' && p.completed_at).length;
            const failed = participationData.filter(p => ['fail', 'abandoned'].includes(p.status)).length;

            setPoints(playerData.reputation || 0);
            setTier(playerData.tier || 'F');
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
        return <ActivityIndicator style={{ flex: 1 }} size="large" color="#FFD700" />;
    }

    if (error) {
        return <Text>Error fetching user data: {error.message}</Text>;
    }

    const totalMissions = missionsCompleted + missionsFailed;
    const completionRate = totalMissions > 0 ? (missionsCompleted / totalMissions * 100).toFixed(2) : 0;

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                {profilePicture ? (
                    <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
                ) : (
                    <Icon name="user-circle" size={100} color="#FFD700" />
                )}
                <Text style={styles.alias}>{alias}</Text>
                <Text style={styles.tier}>Tier: {tier}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Statistics</Text>
                <View style={styles.statItem}>
                    <Icon name="star" size={20} color="#FFD700" />
                    <Text style={styles.statText}>Points: {points}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statText}>
                        Missions
                        <Icon name="check" size={20} color="#28a745" /> {missionsCompleted} /
                        <Icon name="times" size={20} color="#dc3545" /> {missionsFailed} -
                        ({completionRate}%)
                    </Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Skills and Abilities</Text>
                <View style={styles.skillsContainer}>
                    {skills.map((skill, index) => (
                        <View key={index} style={styles.skillItem}>
                            <Icon name="cogs" size={20} color="#007bff" />
                            <Text style={styles.skillText}>{skill}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Equipment and Gear</Text>
                <View style={styles.gearContainer}>
                    {inventory.map((item, index) => (
                        <View key={index} style={styles.gearItem}>
                            <Icon name="wrench" size={20} color="#6c757d" />
                            <Text style={styles.gearText}>{item}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Achievements</Text>
                <View style={styles.achievementsContainer}>
                    {achievements.map((achievement, index) => (
                        <View key={index} style={styles.achievementItem}>
                            <Icon name="medal" size={20} color="#FFD700" />
                            <Text style={styles.achievementText}>{achievement}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Social Features</Text>
                <View style={styles.friendsContainer}>
                    {friends.map((friend, index) => (
                        <View key={index} style={styles.friendItem}>
                            <Icon name="user-friends" size={20} color="#17a2b8" />
                            <Text style={styles.friendText}>{friend}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Settings</Text>
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Dark Mode</Text>
                    <Switch
                        value={isDarkMode}
                        onValueChange={() => setIsDarkMode(prev => !prev)}
                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                        thumbColor={isDarkMode ? "#f5dd4b" : "#f4f3f4"}
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.settingItem}>
                    <Text style={styles.settingText}>Alerts</Text>
                    <Switch
                        value={allowNotifications}
                        onValueChange={() => setAllowNotification(prev => !prev)}
                        trackColor={{ false: "#767577", true: "#81b0ff" }}
                        thumbColor="#f5dd4b"
                    />
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.logoutContainer}>
                    <Button title="Log out" onPress={handleLogout} color="#dc3545" />
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        backgroundColor: '#1E1E1E',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    profilePicture: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 10,
    },
    alias: {
        fontSize: 24,
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
    tier: {
        fontSize: 18,
        color: '#FFFFFF',
    },
    section: {
        marginBottom: 20,
        padding: 15,
        backgroundColor: '#2E2E2E',
        borderRadius: 10,
    },
    sectionTitle: {
        fontSize: 20,
        color: '#FFD700',
        marginBottom: 10,
        fontWeight: 'bold',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    statText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 10,
    },
    skillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    skillItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 10,
    },
    skillText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 5,
    },
    gearContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gearItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 10,
    },
    gearText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 5,
    },
    achievementsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    achievementItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 10,
    },
    achievementText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 5,
    },
    friendsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 15,
        marginBottom: 10,
    },
    friendText: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 5,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    settingText: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    logoutContainer: {
        marginTop: 10,
        alignItems: 'center',
    },
});

export default AgentProfile;
