import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const USER_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

/**
 * Configure GoogleAuthProvider with the required scopes and parameters.
 * Explicitly requests offline access and consent to force issuance of a new
 * credential containing gmail.send permission rather than reusing an old grant.
 */
export function createGoogleProvider(forceConsent = true): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  // Requirement 2 & 8: Explicitly add gmail.send and userinfo.email scopes
  provider.addScope(GMAIL_SEND_SCOPE);
  provider.addScope(USER_EMAIL_SCOPE);

  // Requirement 5 & 7: access_type=offline and prompt=consent
  provider.setCustomParameters({
    access_type: 'offline',
    prompt: forceConsent ? 'consent select_account' : 'select_account',
    include_granted_scopes: 'true',
  });

  return provider;
}

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedUser: User | null = null;
let cachedHasSendPermission = false;

export interface TokenScopeVerification {
  valid: boolean;
  email?: string;
  hasGmailSend: boolean;
  scopes: string[];
}

/**
 * Requirement 3: Detect when the currently stored credential/token does not have gmail.send permission.
 * Validates token against Google's OAuth2 tokeninfo endpoint.
 * Note: Never logs token value.
 */
export async function verifyGoogleTokenScopes(token: string): Promise<TokenScopeVerification> {
  if (!token) {
    return { valid: false, hasGmailSend: false, scopes: [] };
  }
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return { valid: false, hasGmailSend: false, scopes: [] };
    }
    const data = await res.json();
    const scopeStr = typeof data.scope === 'string' ? data.scope : '';
    const scopes = scopeStr.split(/\s+/).filter(Boolean);
    const hasGmailSend =
      scopes.includes(GMAIL_SEND_SCOPE) ||
      scopes.includes('https://mail.google.com/');

    return {
      valid: true,
      email: data.email,
      hasGmailSend,
      scopes,
    };
  } catch (err: any) {
    console.warn('[Gmail Auth] Token verification error:', err?.message || 'Network error');
    return { valid: false, hasGmailSend: false, scopes: [] };
  }
}

/**
 * Initialize auth listener and verify that any active credential holds gmail.send scope.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string, hasSendPermission: boolean) => void,
  onAuthFailure?: () => void,
  onScopeMissing?: (user: User) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      cachedUser = user;
      if (cachedAccessToken) {
        // Requirement 3: Check currently stored token
        const check = await verifyGoogleTokenScopes(cachedAccessToken);
        if (check.valid && check.hasGmailSend) {
          cachedHasSendPermission = true;
          await syncSessionWithServer(cachedAccessToken, user.email || 'user@gmail.com');
          if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken, true);
          return;
        } else {
          // Requirement 4: Do NOT continue using the old insufficient token
          cachedAccessToken = null;
          cachedHasSendPermission = false;
          await syncSessionWithServer('', user.email || '');
          if (onScopeMissing) onScopeMissing(user);
          return;
        }
      }

      // If user is logged into Firebase but no valid access token in memory, check server session
      try {
        const sRes = await fetch('/api/gmail/status');
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.connected && sData.hasSendPermission) {
            cachedHasSendPermission = true;
            if (onAuthSuccess) onAuthSuccess(user, '', true);
            return;
          }
        }
      } catch {}

      // Scope is missing or needs reauthorization
      cachedHasSendPermission = false;
      if (onScopeMissing) onScopeMissing(user);
    } else {
      cachedAccessToken = null;
      cachedUser = null;
      cachedHasSendPermission = false;
      syncSessionWithServer('', '');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Requirement 5 & 6: Force a fresh Google OAuth authorization/reauthorization flow
 * and verify that the credential produced actually contains gmail.send.
 */
export const googleSignIn = async (forceConsent = true): Promise<{
  user: User;
  accessToken: string;
  hasSendPermission: boolean;
} | null> => {
  try {
    isSigningIn = true;
    const provider = createGoogleProvider(forceConsent);
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('Failed to retrieve Google OAuth access token from Firebase credential.');
    }

    const freshToken = credential.accessToken;

    // Requirement 6: Make sure the new authorization actually produces a credential containing gmail.send
    const verification = await verifyGoogleTokenScopes(freshToken);

    if (!verification.valid || !verification.hasGmailSend) {
      // Requirement 4: Do NOT continue using the old insufficient token
      cachedAccessToken = null;
      cachedHasSendPermission = false;
      await syncSessionWithServer('', result.user.email || '');
      throw new Error('Gmail permission needs to be reauthorized. Please grant the email send permission.');
    }

    // Requirement 10: After successful reauthorization, obtain fresh credential and use it
    cachedAccessToken = freshToken;
    cachedUser = result.user;
    cachedHasSendPermission = true;

    // Sync fresh token with server-side alert delivery session
    await syncSessionWithServer(cachedAccessToken, result.user.email || '');

    return {
      user: result.user,
      accessToken: cachedAccessToken,
      hasSendPermission: true,
    };
  } catch (error: any) {
    console.error('Google Sign In / Reauthorization error:', error?.message || error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Convenience method to explicitly trigger reauthorization with prompt=consent
 */
export const reauthorizeGmail = async () => {
  return googleSignIn(true);
};

export const getAccessToken = async (): Promise<string | null> => {
  if (cachedAccessToken) {
    const check = await verifyGoogleTokenScopes(cachedAccessToken);
    if (!check.valid || !check.hasGmailSend) {
      cachedAccessToken = null;
      cachedHasSendPermission = false;
      return null;
    }
  }
  return cachedAccessToken;
};

export const hasSendPermission = (): boolean => {
  return cachedHasSendPermission;
};

export const getCurrentUser = (): User | null => {
  return cachedUser;
};

export const logoutGmail = async () => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
    cachedUser = null;
    cachedHasSendPermission = false;
    await fetch('/api/gmail/disconnect', { method: 'POST' }).catch(() => {});
  } catch (err) {
    console.error('Error signing out:', err);
  }
};

async function syncSessionWithServer(token: string, email: string) {
  if (!token) {
    await fetch('/api/gmail/disconnect', { method: 'POST' }).catch(() => {});
    return;
  }
  try {
    await fetch('/api/gmail/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email }),
    });
  } catch (err) {
    console.warn('Failed syncing Gmail session to server:', err);
  }
}
