'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL_SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Supabase llama "publishable key" a la clave nueva y "anon key" a la vieja: sirve cualquiera de las dos.
const CLAVE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigurado = Boolean(URL_SUPABASE && CLAVE);

let cliente: SupabaseClient | null = null;

/** Cliente de Supabase Auth del navegador, o null si faltan las variables. */
export function supabase(): SupabaseClient | null {
  if (!supabaseConfigurado) return null;
  cliente ??= createClient(URL_SUPABASE!, CLAVE!, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return cliente;
}

/** Token de acceso de la sesión actual (Supabase lo renueva solo), para mandarlo a la API. */
export async function tokenActual(): Promise<string | null> {
  const s = supabase();
  if (!s) return null;
  const { data } = await s.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Adónde vuelve el usuario después de Google o del link del email. */
export function urlDeVuelta(volver?: string): string {
  const u = new URL('/auth/callback', window.location.origin);
  if (volver) u.searchParams.set('volver', volver);
  return u.toString();
}

/** Mensajes de Supabase Auth traducidos a algo que se entienda. */
export function mensajeAuth(error: { message: string; code?: string } | null): string {
  if (!error) return '';
  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'El email o la contraseña no coinciden.';
  if (m.includes('email not confirmed')) return 'Todavía no confirmaste tu email. Revisá tu bandeja de entrada.';
  if (m.includes('already registered') || error.code === 'user_already_exists') return 'Ya hay una cuenta con ese email. Iniciá sesión.';
  if (m.includes('password should be')) return 'La contraseña es muy corta o muy fácil. Probá con al menos 8 caracteres.';
  if (m.includes('rate limit')) return 'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.';
  if (m.includes('provider is not enabled')) return 'El inicio con Google todavía no está activado en Supabase.';
  return error.message;
}
