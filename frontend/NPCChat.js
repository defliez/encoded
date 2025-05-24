import React, { useEffect, useState } from 'react';
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

export default function NPCChat({ route }) {
    const { npcId } = route.params;
    const [npc, setNpc] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);

    // Fetch NPC info
    useEffect(() => {
        const fetchNpc = async () => {
            const { data, error } = await supabase
                .from('npcs')
                .select('*')
                .eq('id', npcId)
                .single();

            if (error) console.error(error);
            else {
                setNpc(data);
                setMessages([
                    {
                        id: 'npc-intro',
                        from: 'npc',
                        text: data.intro,
                    },
                ]);
            }

            setLoading(false);
        };

        fetchNpc();
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

        // Simulate NPC "thinking"
        setTimeout(() => {
            const npcReply = {
                id: Date.now().toString() + '-npc',
                from: 'npc',
                text: getMockReply(userMessage.text),
            };
            setMessages((prev) => [...prev, npcReply]);
        }, 800);
    };

    const getMockReply = (text) => {
        // Just echoes back with a spy twist — replace with Gemini later
        return `Hmm... "${text}"... interesting. Proceed with caution.`;
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#fff" />;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={80}
        >
            <Text style={styles.header}>{npc?.name}</Text>

            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View
                        style={[
                            styles.bubble,
                            item.from === 'npc' ? styles.npcBubble : styles.playerBubble,
                        ]}
                    >
                        <Text style={styles.bubbleText}>{item.text}</Text>
                    </View>
                )}
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
        backgroundColor: '#111',
    },
    header: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        padding: 16,
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
        backgroundColor: '#222',
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
    },
});

