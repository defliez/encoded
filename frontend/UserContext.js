import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from './supabaseClient';

const UserContext = createContext();

const MOCK_PLAYER_ID = '00000000-0000-0000-0000-000000000000';

export const UserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // To handle loading state
    const [error, setError] = useState(null); // To handle errors

    const fetchUser = async () => {
        try {
            const { data, error } = await supabase
                .from('players')
                .select('*')
                .eq('id', MOCK_PLAYER_ID)
                .single();

            if (error) {
                throw error; // Throw error to be caught in the catch block
            }

            setUser(data); // Set the user data
        } catch (err) {
            console.error('Error fetching user:', err);
            setError(err); // Set the error state
        } finally {
            setLoading(false); // Set loading to false after fetching
        }
    };

    useEffect(() => {
        fetchUser(); // Call fetchUser when the component mounts
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, loading, error }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => useContext(UserContext);
