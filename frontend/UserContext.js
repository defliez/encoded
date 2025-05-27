// UserContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabaseClient';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const [token, setToken] = useState(null);
    const [authUser, setAuthUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            const storedToken = await SecureStore.getItemAsync('access_token');
            if (!storedToken) {
                setLoading(false);
                return;
            }

            supabase.auth = { accessToken: storedToken };

            const userId = getUserIdFromJWT(storedToken);
            if (!userId) {
                console.warn('Invalid token during init');
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('id', userId)
                .single();

            if (!error) {
                setToken(storedToken);
                setAuthUser(data);
            }

            setLoading(false);
        };

        init();
    }, []);

    const getUserIdFromJWT = (token) => {
        try {
            const payload = token.split('.')[1];
            const decoded = JSON.parse(atob(payload));
            return decoded.sub;
        } catch {
            return null;
        }
    };

    const signIn = async (accessToken, codename = null) => {
        console.log("🔑 Saving access token...");
        await SecureStore.setItemAsync('access_token', accessToken);
        setToken(accessToken);

        const userId = getUserIdFromJWT(accessToken);
        console.log("🧠 Decoded user ID:", userId);
        if (!userId) {
            console.warn("⚠️ Failed to decode user ID from JWT");
            return;
        }

        const { data, error } = await supabase
            .from('players')
            .select('*')
            .eq('id', userId)
            .single();

        if (error && error.code === 'PGRST116') {
            console.log("ℹ️ No player found, creating one...");
            const { error: insertError } = await supabase
                .from('players')
                .insert({ id: userId, codename: codename || 'Agent' });

            if (insertError) {
                console.error("Failed to insert new player:", insertError);
            } else {
                console.log("New player created");
                setAuthUser({ id: userId, codename });
            }
        } else if (error) {
            console.error("Failed to fetch player:", error);
        } else {
            console.log("Player fetched:", data);
            setAuthUser(data);
        }
    };

    const signOut = async () => {
        await SecureStore.deleteItemAsync('access_token');
        setToken(null);
        setAuthUser(null);
    };

    return (
        <UserContext.Provider value={{ token, authUser, loading, signIn, signOut }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);

