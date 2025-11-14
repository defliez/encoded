import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { supabase } from './supabaseClient';
import { useUser } from './UserContext';
import TypewriterText from './components/TypewriterText';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function NPCChat({ route }) {
    const { npcId, missionId, missionTitle } = route.params;
    const [npc, setNpc] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [lastAnimatedId, setLastAnimatedId] = useState(null);

    const flatListRef = useRef(null);
    const { authUser } = useUser();

    useEffect(() => {
        if (!authUser) return;

        const fetchNpcAndHistory = async () => {
            try {
                const { data: npcData } = await supabase
                    .from('npcs')
                    .select('*')
                    .eq('id', npcId)
                    .single();
                setNpc(npcData);

                await fetch(`${BACKEND_URL}/npc-chat/first-message`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        npcId,
                        missionId,
                        playerId: authUser.id,
                    }),
                });

                const historyRes = await fetch(
                    `${BACKEND_URL}/npc-chat/history?playerId=${authUser.id}&npcId=${npcId}&missionId=${missionId}`
                );
                const historyJson = await historyRes.json();

                if (historyJson.history) {
                    const formatted = historyJson.history.map((msg, i) => ({
                        id: i.toString(),
                        from: msg.from_role,
                        text: msg.text,
                    }));
                    setMessages(formatted);
                }
            } catch (err) {
                console.error("Failed to fetch NPC or chat history", err);
            }
            setLoading(false);
        };

        fetchNpcAndHistory();
    }, []);

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = {
            id: Date.now().toString(),
            from: 'player',
            text: input.trim(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');

        const npcReplyText = await getGeminiReply(userMessage.text);

        const npcReply = {
            id: Date.now().toString() + "-npc",
            from: "npc",
            text: npcReplyText,
        };

        setMessages((prev) => [...prev, npcReply]);
        setLastAnimatedId(npcReply.id);
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);
    };

    const getGeminiReply = async (playerMessage) => {
        try {
            const res = await fetch(`${BACKEND_URL}/npc-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    npcId,
                    missionId,
                    playerId: authUser.id,
                    playerMessage,
                }),
            });

            const data = await res.json();
            return data.reply || "...";
        } catch (err) {
            console.error("Gemini API error:", err);
            return "I... can't respond right now.";
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#ffb15e" />
                <Text style={styles.loadingText}>Establishing secure channel…</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={80}
        >
            <View style={styles.headerContainer}>
                <Text style={styles.headerLabel}>CONTRACT</Text>
                <Text style={styles.missionTitle} numberOfLines={1}>
                    {missionTitle || 'Unknown operation'}
                </Text>
                <Text style={styles.npcName}>
                    Handler: <Text style={styles.npcNameStrong}>{npc?.name || "..."}</Text>
                </Text>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isAnimating = item.from === 'npc' && item.id === lastAnimatedId;
                    const isNpc = item.from === 'npc';

                    return (
                        <View
                            style={[
                                styles.bubbleRow,
                                isNpc ? styles.bubbleRowNpc : styles.bubbleRowPlayer,
                            ]}
                        >
                            <View
                                style={[
                                    styles.bubble,
                                    isNpc ? styles.npcBubble : styles.playerBubble,
                                ]}
                            >
                                {isNpc && (
                                    <Text style={styles.bubbleMeta}>
                                        {npc?.name || 'Handler'}
                                    </Text>
                                )}
                                {!isNpc && (
                                    <Text style={styles.bubbleMeta}>
                                        You
                                    </Text>
                                )}

                                {isNpc && isAnimating ? (
                                    <TypewriterText
                                        content={item.text}
                                        speed={30}
                                        style={styles.bubbleText}
                                        onTypingComplete={() => {
                                            setLastAnimatedId(null);
                                            flatListRef.current?.scrollToEnd({ animated: true });
                                        }}
                                    />
                                ) : (
                                    <Text style={styles.bubbleText}>{item.text}</Text>
                                )}
                            </View>
                        </View>
                    );
                }}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
            />

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your message…"
                    placeholderTextColor="#6f7485"
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Text style={styles.sendButtonText}>SEND</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#05060a',
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
    headerContainer: {
        paddingTop: 16,
        paddingBottom: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#2e3547',
        backgroundColor: '#090c14',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { height: 2, width: 0 },
        elevation: 3,
    },
    headerLabel: {
        fontSize: 11,
        letterSpacing: 2,
        color: '#ffb15e',
        marginBottom: 4,
    },
    missionTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#f1e9dc',
    },
    npcName: {
        fontSize: 13,
        color: '#9da6b8',
        marginTop: 2,
    },
    npcNameStrong: {
        color: '#f1e9dc',
        fontWeight: '600',
    },
    listContent: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 8,
    },
    bubbleRow: {
        marginBottom: 8,
        flexDirection: 'row',
    },
    bubbleRowNpc: {
        justifyContent: 'flex-start',
    },
    bubbleRowPlayer: {
        justifyContent: 'flex-end',
    },
    bubble: {
        maxWidth: '80%',
        padding: 10,
        borderRadius: 14,
    },
    npcBubble: {
        backgroundColor: 'rgba(22, 27, 40, 0.95)',
        borderWidth: 1,
        borderColor: '#2e3547',
        alignSelf: 'flex-start',
    },
    playerBubble: {
        backgroundColor: '#ffb15e',
        borderWidth: 1,
        borderColor: '#ffb15e',
        alignSelf: 'flex-end',
    },
    bubbleMeta: {
        fontSize: 11,
        marginBottom: 2,
        color: '#9da6b8',
    },
    bubbleText: {
        color: '#f1f1f5',
        fontSize: 15,
        lineHeight: 20,
    },
    inputRow: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderColor: '#2e3547',
        backgroundColor: '#090c14',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#111522',
        color: '#f1e9dc',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        marginRight: 8,
        fontSize: 14,
    },
    sendButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#ffb15e',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonText: {
        color: '#151821',
        fontWeight: '700',
        fontSize: 13,
        letterSpacing: 1,
    },
});

