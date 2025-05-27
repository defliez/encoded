// LoginScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithPassword, signUp } from './authApi';
import { useUser } from './UserContext';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [codename, setCodename] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { signIn, player } = useUser();

    useEffect(() => {
        if (player) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'Map' }],
            });
        }
    }, [player]);


    const handleLogin = async () => {
        console.log("Login button pressed");
        try {
            const session = await signInWithPassword(email, password);
            console.log("session:", session);
            await signIn(session.access_token, codename);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSignup = async () => {
        setError('');
        setIsLoading(true);
        try {
            const data = await signUp(email, password, codename);
            console.log("Sign up success", data);
            await signInWithPassword(email, password).then((session) => {
                signIn(session.access_token, codename);
            });

        } catch (err) {
            console.error("Signup error:", err);
            setError(err.message || 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
        <Text style={styles.title}>Agent Login</Text>

        <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        />

        <TextInput
        placeholder="Codename"
        placeholderTextColor="#888"
        style={styles.input}
        value={codename}
        onChangeText={setCodename}
        />


        <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
        <Text style={styles.buttonText}>Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSignup} disabled={isLoading}>
        <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
        </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    title: {
        fontSize: 28,
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 24,
    },
    input: {
        backgroundColor: '#222',
        color: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 8,
        marginBottom: 12,
        fontSize: 16,
    },
    error: {
        color: '#ff4d4d',
        textAlign: 'center',
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        flex: 1,
        backgroundColor: '#007AFF',
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    secondaryButton: {
        backgroundColor: '#555',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
});

