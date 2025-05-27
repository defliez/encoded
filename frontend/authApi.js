// authApi.js
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_AUTH_URL = `${SUPABASE_URL}/auth/v1`;

export async function signInWithPassword(email, password) {
    const response = await fetch(`${SUPABASE_AUTH_URL}/token?grant_type=password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Supabase login response:", response.status, data);

    if (!response.ok) throw new Error(data.error_description || 'Login failed');
    return data;
}


export async function signUp(email, password, codename) {
    const response = await fetch(`${SUPABASE_AUTH_URL}/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Supabase signup response:", response.status, data);

    if (!response.ok) throw new Error(data.error_description || 'Signup failed');
    return data;
}


