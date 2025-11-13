// LoginScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { requestPasswordReset, resendConfirmation, signInWithPassword, signUp } from './authApi';
import { useUser } from './UserContext';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [codename, setCodename] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [signUpSelected, setSignUpSelected] = useState(false);
    const [needsVerification, setNeedsVerification] = useState(false);
    const [notice, setNotice] = useState('');

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
        setError('');
        setNotice('');
        setNeedsVerification(false);
        setIsLoading(true);
        try {
            const session = await signInWithPassword(email, password);
            await signIn(session.access_token, codename);
        } catch (err) {
            const msg = (err?.message || '').toLowerCase();
            if (msg.includes('not confirmed')) {
                setNeedsVerification(true);
                setNotice("Check your inbox to confirm your email before logging in");
            }
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignup = async () => {
        setError('');
        setNotice('');
        setIsLoading(true);
        try {
            await signUp(email, password, codename);
            setNotice("Signup successful. We've sent a confirmation link to your email. Open it to activate your account.");
            setSignUpSelected(false);
            setNeedsVerification(true);
            // await signInWithPassword(email, password).then((session) => {
            //     signIn(session.access_token, codename);
            // });

        } catch (err) {
            console.error("Signup error:", err);
            setError(err.message || 'Signup failed');
        } finally {
            setIsLoading(false);
        }
    };

    const switchLayout = async () => {
        setSignUpSelected(!signUpSelected);
    };

    const handleResend = async () => {
        setError('');
        setIsLoading(true);
        try {
            await resendConfirmation(email.trim());
            setNotice("Confirmation email resent. Check your inbox (and spam).");
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgot = async () => {
        setError('');
        setIsLoading(true);
        try {
            await requestPasswordReset(email.trim());
            setNotice("Password reset email sent. Follow the link to set a new password.");
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }


    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {signUpSelected ?
                <Text style={styles.title}>Agent Signup</Text>
                :
                <Text style={styles.title}>Agent Login</Text>
            }

            <TextInput
                placeholder="Email"
                placeholderTextColor="#888"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            {signUpSelected ? (
                <TextInput
                    placeholder="Codename"
                    placeholderTextColor="#888"
                    style={styles.input}
                    value={codename}
                    onChangeText={setCodename}
                />
            ) : (<></>)
            }

            <TextInput
                placeholder="Password"
                placeholderTextColor="#888"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {signUpSelected ? (
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={isLoading}>
                        <Text style={styles.buttonText}>Sign up</Text>
                    </TouchableOpacity>

                    <Text style={styles.or}>or</Text>

                    <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={switchLayout} disabled={isLoading}>
                        <Text style={styles.buttonText}>Log in</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.buttonRow}>
                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                        <Text style={styles.buttonText}>Log in</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleForgot} disabled={isLoading} style={styles.inlineLink}>
                        <Text style={styles.inlineLinkText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <Text style={styles.or}>or</Text>

                    <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={switchLayout} disabled={isLoading}>
                        <Text style={styles.buttonText}>Sign up</Text>
                    </TouchableOpacity>

                    {needsVerification && (
                        <TouchableOpacity onPress={handleResend} disabled={isLoading} style={styles.inlineLink}>
                            <Text style={styles.inlineLinkText}>Resend confirmation email</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
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
    or: {
        fontSize: 14,
        color: '#fff',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 4,

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
    notice: {
        color: '#7bd88f',
        textAlign: 'center',
        marginBottom: 8,
    },
    error: {
        color: '#ff4d4d',
        textAlign: 'center',
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        // flex: 1,
        backgroundColor: '#007AFF',
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
        // marginLeft: 48,
        // marginRight: 48,
    },
    secondaryButton: {
        backgroundColor: '#222',
        marginLeft: 48,
        marginRight: 48,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    inlineLink: {
        alignSelf: 'center',
        marginTop: 6,
    },
    inlineLinkText: {
        color: '#9ecbff',
        textDecorationLine: 'underline',
    },
});

