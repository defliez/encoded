import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Button,
    StyleSheet,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
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

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={80}
        >
            <View style={styles.headerContainer}>
                <Text style={styles.missionTitle}>{missionTitle}</Text>
                <Text style={styles.npcName}>Handler: {npc?.name || "..."}</Text>
            </View>

            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                    const isAnimating = item.from === 'npc' && item.id === lastAnimatedId;
                    return (
                        <View
                            style={[
                                styles.bubble,
                                item.from === 'npc' ? styles.npcBubble : styles.playerBubble,
                            ]}
                        >
                            {item.from === 'npc' && isAnimating ? (
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
                    );
                }}
                onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                contentContainerStyle={{ padding: 12 }}
            />

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Type your message..."
                    placeholderTextColor="#888"
                />
                <Button title="Send" onPress={sendMessage} />
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0b0b0b',
    },
    headerContainer: {
        paddingTop: 48,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderColor: '#222',
        backgroundColor: '#000',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 4,
        shadowOffset: { height: 2, width: 0 },
        elevation: 3,
    },
    missionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        letterSpacing: 0.5,
    },
    npcName: {
        fontSize: 14,
        color: '#999',
        marginTop: 2,
    },
    inputRow: {
        flexDirection: 'row',
        padding: 12,
        borderTopWidth: 1,
        borderColor: '#222',
        backgroundColor: '#000',
    },
    input: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        color: '#fff',
        borderRadius: 8,
        paddingHorizontal: 12,
        marginRight: 8,
    },
    bubble: {
        marginBottom: 8,
        maxWidth: '80%',
        padding: 10,
        borderRadius: 12,
    },
    npcBubble: {
        backgroundColor: '#333',
        alignSelf: 'flex-start',
    },
    playerBubble: {
        backgroundColor: '#007AFF',
        alignSelf: 'flex-end',
    },
    bubbleText: {
        color: '#fff',
        fontSize: 15,
        lineHeight: 20,
    },
});
