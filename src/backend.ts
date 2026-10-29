import { auth } from './firebase';

type CallableResult<T> = { data: T };

/** Calls the server actions through Supabase, authenticating users with Firebase Auth. */
export function callBackend<TRequest = any, TResponse = any>(name: string) {
  return async (data?: TRequest): Promise<CallableResult<TResponse>> => {
    if (!auth) throw Object.assign(new Error('Firebase Authentication is not configured.'), { code: 'functions/failed-precondition' });
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) throw Object.assign(new Error('Supabase is not configured for this deployment.'), { code: 'functions/failed-precondition' });
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Sign in to continue.'), { code: 'functions/unauthenticated' });
    const token = await user.getIdToken();
    const endpoint = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/skillbridge/${encodeURIComponent(name)}`;
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: data ?? {} }),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Network request failed.';
      throw Object.assign(new Error(`Could not reach the Supabase Edge Function “${name}”. Check that it is deployed and that this site has the correct Supabase project URL. (${reason})`), { code: 'functions/unavailable' });
    }
    const payload = await response.json() as { data?: TResponse; error?: { code?: string; message?: string } };
    if (!response.ok) {
      const code = payload.error?.code || 'internal';
      throw Object.assign(new Error(payload.error?.message || 'The server request failed.'), { code: `functions/${code}` });
    }
    return { data: payload.data as TResponse };
  };
}
