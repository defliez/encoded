// authApi.js
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_AUTH_URL = `${SUPABASE_URL}/auth/v1`;

// const REDIRECT_TO = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;

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
        body: JSON.stringify({
            email,
            password,
            data: { codename },
            // email_redirect_to: REDIRECT_TO,
        }),
    });

    const data = await response.json();
    console.log("Supabase signup response:", response.status, data);

    if (!response.ok) throw new Error(data.error_description || 'Signup failed');
    return data;
}

export async function resendConfirmation(email) {
    const res = await fetch(`${SUPABASE_AUTH_URL}/resend`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            type: 'signup',
            email,
            // email_redirect_to: REDIRECT_TO,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || 'Could not resend email');
    return true;
}

export async function requestPasswordReset(email) {
    const res = await fetch(`${SUPABASE_AUTH_URL}/recover`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
            email,
            // redirect_to: REDIRECT_TO,
        }),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error_description || 'Could not start password reset');
    }
    return true;
}
