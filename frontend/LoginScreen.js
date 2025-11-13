// LoginScreen.js
import React, { useState, useEffect } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    };

    return (
        <LinearGradient
            colors={['#05060a', '#101320', '#151821']}
            style={{ flex: 1 }}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.headerBlock}>
                    <Text style={styles.gameTitle}>ENCODED</Text>
                    <Text style={styles.subtitle}>Your brain is a nest of rats. Use it anyway.</Text>
                </View>

                <View style={styles.authCard}>
                    {signUpSelected ?
                        <Text style={styles.sectionLabel}>AGENT SIGNUP</Text>
                        :
                        <Text style={styles.sectionLabel}>AGENT LOGIN</Text>
                    }

                    <TextInput
                        placeholder="Email"
                        placeholderTextColor="#aaa"
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    {signUpSelected ? (
                        <TextInput
                            placeholder="Codename"
                            placeholderTextColor="#aaa"
                            style={styles.input}
                            value={codename}
                            onChangeText={setCodename}
                        />
                    ) : (<></>)
                    }

                    <TextInput
                        placeholder="Password"
                        placeholderTextColor="#aaa"
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
                </View>

                <View style={styles.footerBlock}>
                    <Text style={styles.footerText}>BUILD: INTERNAL · FIELD TEST</Text>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 24,
    },
    headerBlock: {
        marginTop: 16,
    },
    gameTitle: {
        fontSize: 32,
        letterSpacing: 4,
        color: '#f1e9dc',
        fontWeight: '700',
    },
    subtitle: {
        marginTop: 4,
        color: '#9da6b8',
        fontSize: 12,
        letterSpacing: 2,
    },
    authCard: {
        backgroundColor: 'rgba(9, 12, 20, 0.9)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#2e3547',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 20,
    },
    sectionLabel: {
        color: '#ffb15e',
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: 16,
        textAlign: 'center',
    },
    input: {
        backgroundColor: 'rgba(15, 18, 26, 0.95)',
        color: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#3a4254',
        marginBottom: 12,
        fontSize: 16,
    },
    notice: {
        color: '#66f0c6',
        textAlign: 'center',
        marginBottom: 8,
    },
    error: {
        color: '#ff6b6b',
        textAlign: 'center',
        marginBottom: 12,
    },
    buttonRow: {
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12,
    },
    button: {
        backgroundColor: '#ffb15e',
        padding: 18,
        borderRadius: 10,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
    },
    secondaryButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#ffb15e44',
        marginLeft: 48,
        marginRight: 48,
    },
    buttonText: {
        color: '#0c0f17',
        fontWeight: 'bold',
        fontSize: 16,
        letterSpacing: 1,
    },
    inlineLink: {
        alignSelf: 'center',
        marginTop: 6,
    },
    inlineLinkText: {
        color: '#9ecbff',
        textDecorationLine: 'underline',
    },
    or: {
        fontSize: 14,
        color: '#d0d5e0',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 4,
        letterSpacing: 2,
    },
    footerBlock: {
        alignItems: 'center',
        marginBottom: 8,
    },
    footerText: {
        fontSize: 10,
        letterSpacing: 2,
        color: '#545e73',
    },
});

