// ===============================================================
// Authentication Domain
// ===============================================================
import { supabase, checkAuthRateLimit } from './supabaseClient';
import { sendDirectEmailNotification } from './notifications';

export const signUp = async (email: string, password: string, fullName: string) => {
  checkAuthRateLimit('signUp');
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
  if (error) throw error;

  // Send welcome/verification email via our Resend-backed notification system.
  // Supabase Auth's built-in confirmation email may be disabled, so we send our own
  // to make sure the user always gets a welcome email regardless of auth config.
  if (data.user?.id) {
    sendDirectEmailNotification({
      recipient_email: email,
      user_id: data.user.id,
      title: `Welcome to Canopy, ${fullName}!`,
      body: `Thanks for creating your Canopy account! Sign in to set up your home profile, scan your equipment, and get personalized maintenance reminders.\n\nYour next step: Complete the onboarding walkthrough to unlock your dashboard.`,
      subject: `Welcome to Canopy, ${fullName}!`,
      category: 'onboarding',
      action_url: '/onboarding',
      action_label: 'Get Started',
    }).catch(() => {}); // Non-blocking
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  checkAuthRateLimit('signIn');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

export const resendVerificationEmail = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error('No user email found');
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: user.email,
    options: {
      emailRedirectTo: `${window.location.origin}/login?verified=true`,
    },
  });
  if (error) throw error;
};
