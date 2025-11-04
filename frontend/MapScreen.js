import SPY_MAP_STYLE from './SpyMapStyle';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Image, Pressable, Text } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { supabase } from './supabaseClient';
import { useUser } from './UserContext';

import blueEye from './assets/view.png';
import redEye from './assets/technology.png';
import blackEye from './assets/focus.png';

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL;


const ACCEPT_DISTANCE_METERS = 50;
const GENERATION_RADIUS_METERS = 500;
const SCAN_SWEEP_MS = 1200;
const SCAN_STEPS = 24;
const MAX_GENERATION_CALLS = 60;
const DUPLICATE_TOLERANCE = 5;

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export default function MapScreen({ navigation }) {
    const [location, setLocation] = useState(null);
    const [missions, setMissions] = useState([]);
    const [acceptedMissions, setAcceptedMissions] = useState({});
    const [loading, setLoading] = useState(true);

    const [scanning, setScanning] = useState(false);
    const [scanRadius, setScanRadius] = useState(0);
    const sweepTimerRef = useRef(null);

    const [generating, setGenerating] = useState(false);
    const [generatedCount, setGeneratedCount] = useState(0);

    const { authUser, loading: userLoading } = useUser();

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            const fetchLocationAndMissions = async () => {
                try {
                    setLoading(true);
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') {
                        alert('Location permission denied');
                        return;
                    }
                    const loc = await Location.getCurrentPositionAsync({});
                    if (isActive) setLocation(loc);

                    const { data: allMissions, error: missionsError } = await supabase
                        .from('missions')
                        .select('*');
                    if (missionsError) throw missionsError;

                    const { data: participations, error: participationError } = await supabase
                        .from('mission_participation')
                        .select('mission_id, status, completed_at')
                        .eq('player_id', authUser.id);
                    if (participationError) throw participationError;

                    const participationMap = {};
                    participations.forEach((p) => {
                        participationMap[p.mission_id] = p;
                    });

                    const filtered = allMissions.filter((mission) => {
                        const p = participationMap[mission.id];
                        if (!p) return true;
                        if (!p.completed_at) return true;
                        if (['fail', 'abandoned'].includes(p.status)) return true;
                        return false;
                    });

                    if (isActive) {
                        setMissions(filtered);
                        setAcceptedMissions(participationMap);
                    }
                } catch (err) {
                    console.error('Error fetching map data:', err);
                } finally {
                    if (isActive) setLoading(false);
                }
            };

            fetchLocationAndMissions();
            return () => {
                isActive = false;
            };
        }, [authUser?.id])
    );

    useEffect(() => {
        if (sweepTimerRef.current) {
            clearInterval(sweepTimerRef.current);
            sweepTimerRef.current = null;
        }
        if (!scanning) {
            setScanRadius(0);
            return;
        }

        const steps = SCAN_STEPS;
        const stepMs = Math.floor(SCAN_SWEEP_MS / steps);
        const increment = GENERATION_RADIUS_METERS / steps;

        let r = 0;
        setScanRadius(0);

        sweepTimerRef.current = setInterval(() => {
            r += increment;
            if (r >= GENERATION_RADIUS_METERS) r = 0;
            setScanRadius(r);
        }, stepMs);

        return () => {
            if (sweepTimerRef.current) {
                clearInterval(sweepTimerRef.current);
                sweepTimerRef.current = null;
            }
        };
    }, [scanning]);

    async function tryBatchGenerate(lat, lng) {
        try {
            const url = `${BACKEND_BASE}/pcg/missions?lat=${lat}&lng=${lng}&radius=${GENERATION_RADIUS_METERS}`;
            const resp = await fetch(url);
            if (!resp.ok) return { ok: false, missions: [] };
            const json = await resp.json();
            const newMissions = Array.isArray(json?.missions) ? json.missions : [];
            return { ok: true, missions: newMissions };
        } catch {
            return { ok: false, missions: [] };
        }
    }

    async function fallbackLoopGenerate(lat, lng) {
        let createdIds = [];
        let noProgressStreak = 0;

        for (let i = 0; i < MAX_GENERATION_CALLS; i++) {
            try {
                const resp = await fetch(`${BACKEND_BASE}/pcg/mission`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lat, lng, radius: GENERATION_RADIUS_METERS }),
                });

                if (resp.status === 204) break;
                const json = await resp.json();

                if (!resp.ok) {
                    if (json?.done || json?.noMore || json?.reason === 'exhausted' || resp.status === 404 || resp.status === 409) break;
                    console.warn('Generate mission failed:', json);
                    break;
                }

                const m = json?.mission;
                if (!m?.id) {
                    noProgressStreak++;
                } else {
                    const already = createdIds.includes(m.id) || missions.some((x) => x.id === m.id);
                    if (already) {
                        noProgressStreak++;
                    } else {
                        createdIds.push(m.id);
                        setMissions((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
                        setGeneratedCount((c) => c + 1);
                        noProgressStreak = 0;
                    }
                }

                if (noProgressStreak >= DUPLICATE_TOLERANCE) break;
                await new Promise((res) => setTimeout(res, 120));
            } catch (e) {
                console.warn('fallback generation error:', e);
                break;
            }
        }

        return createdIds.length;
    }

    async function generateAllMissionsWithinRadius() {
        if (!location?.coords || generating) return;
        const { latitude, longitude } = location.coords;

        setGenerating(true);
        setGeneratedCount(0);
        setScanning(true);

        try {
            const batch = await tryBatchGenerate(latitude, longitude);
            if (batch.ok && batch.missions.length) {
                setMissions((prev) => {
                    const seen = new Set(prev.map((m) => m.id));
                    const fresh = batch.missions.filter((m) => !seen.has(m.id));
                    setGeneratedCount(fresh.length);
                    return fresh.length ? [...prev, ...fresh] : prev;
                });
            } else {
                await fallbackLoopGenerate(latitude, longitude);
            }
        } finally {
            setScanning(false);
            setGenerating(false);
        }
    }

    function onPressGenerate() {
        generateAllMissionsWithinRadius();
    }

    if (!authUser || !location || userLoading || loading) {
        return <ActivityIndicator style={{ flex: 1 }} size="large" color="black" />;
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                provider="google"
                customMapStyle={SPY_MAP_STYLE}
                initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation={true}
            >
                <Circle
                    center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                    radius={ACCEPT_DISTANCE_METERS}
                    strokeColor="rgba(0,0,0,0.3)"
                    fillColor="rgba(0,255,0,0.1)"
                />

                {scanning && (
                    <Circle
                        center={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}
                        radius={scanRadius}
                        strokeColor="rgba(0,255,0,0.7)"
                        fillColor="rgba(0,255,0,0.18)"
                    />
                )}

                {missions.map((mission) => {
                    const distance = getDistanceFromLatLonInMeters(
                        location.coords.latitude,
                        location.coords.longitude,
                        mission.lat,
                        mission.lon
                    );

                    const withinRange = distance <= ACCEPT_DISTANCE_METERS;
                    const isAccepted = !!acceptedMissions[mission.id];
                    const markerIcon = isAccepted ? blackEye : withinRange ? blueEye : redEye;

                    return (
                        <Marker
                            key={mission.id}
                            coordinate={{ latitude: mission.lat, longitude: mission.lon }}
                            title={mission.title}
                            description={
                                isAccepted
                                    ? mission.description
                                    : withinRange
                                        ? mission.description
                                        : `Too far away (${Math.round(distance)}m)`
                            }
                            onPress={() => {
                                if (withinRange || isAccepted) {
                                    navigation.navigate('MissionDetails', { mission, playerId: authUser.id });
                                }
                            }}
                        >
                            <Image source={markerIcon} style={{ width: 32, height: 32, resizeMode: 'contain' }} />
                        </Marker>
                    );
                })}
            </MapView>

            <Pressable
                onPress={onPressGenerate}
                style={[styles.fab, generating && styles.fabDisabled]}
                disabled={generating}
            >
                <Text style={styles.fabText}>
                    {generating ? `Generating… (${generatedCount})` : 'Scan 500m'}
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    map: { flex: 1 },
    fab: {
        position: 'absolute',
        right: 24,
        bottom: 24,
        backgroundColor: '#8bc34a',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    fabDisabled: { opacity: 0.6 },
    fabText: { color: '#000', fontWeight: '700' },
});
