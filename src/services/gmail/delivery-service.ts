import type { AlertEmailPayload, GmailAccount } from '../../types/intelligence.ts';

export type { AlertEmailPayload };

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
  deliveredTo?: string;
  sentAt?: string;
  needsReauthorization?: boolean;
  accountId?: string;
}

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

export const MAX_GMAIL_ACCOUNTS = 3;
export const GMAIL_ACCOUNT_SLOTS = ['gmail_account_1', 'gmail_account_2', 'gmail_account_3'] as const;

export interface ServerGmailAccountSession {
  id: string; // 'gmail_account_1', 'gmail_account_2', 'gmail_account_3'
  email: string;
  provider: 'google';
  status: 'connected' | 'reauth_required';
  scopes: string[];
  accessToken: string;
  hasSendPermission: boolean;
  connectedAt: string;
  lastUsedAt: string | null;
  totalDelivered: number;
  lastDeliveryStatus?: string;
}

// In-memory server-side storage of independent Gmail accounts (up to 3)
const serverGmailAccounts = new Map<string, ServerGmailAccountSession>();

/**
 * Verify whether an access token has the required gmail.send scope.
 * Uses Google's official OAuth2 tokeninfo endpoint.
 */
export async function verifyGoogleTokenScopes(token: string): Promise<{
  valid: boolean;
  email?: string;
  hasGmailSend: boolean;
  scopes: string[];
}> {
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
    console.warn('[Gmail Delivery] Scope verification error:', err?.message || 'Network error');
    return { valid: false, hasGmailSend: false, scopes: [] };
  }
}

/**
 * Get all server account sessions (internal only - contains tokens).
 */
export function getAllServerGmailAccounts(): ServerGmailAccountSession[] {
  return Array.from(serverGmailAccounts.values());
}

/**
 * Get a specific server account session by ID.
 */
export function getServerGmailAccount(id: string): ServerGmailAccountSession | null {
  return serverGmailAccounts.get(id) || null;
}

/**
 * Secure public representation of all 3 Gmail account slots (Requirement 18: Never expose tokens).
 */
export function getPublicGmailAccounts(): GmailAccount[] {
  return GMAIL_ACCOUNT_SLOTS.map((slotId) => {
    const session = serverGmailAccounts.get(slotId);
    if (!session) {
      return {
        id: slotId,
        email: '',
        provider: 'google',
        status: 'not_connected',
        scopes: [],
        totalDelivered: 0,
        hasSendPermission: false,
      };
    }
    return {
      id: session.id,
      email: session.email,
      provider: session.provider,
      status: session.status,
      scopes: session.scopes,
      connectedAt: session.connectedAt,
      lastUsedAt: session.lastUsedAt,
      totalDelivered: session.totalDelivered,
      lastDeliveryStatus: session.lastDeliveryStatus,
      hasSendPermission: session.hasSendPermission,
    };
  });
}

/**
 * Set or update a specific Gmail account session.
 * Supports up to 3 independent accounts.
 */
export function setServerGmailAccount(options: {
  id?: string;
  email: string;
  accessToken: string;
  hasSendPermission?: boolean;
  scopes?: string[];
}): ServerGmailAccountSession {
  let targetId = options.id;

  // If ID not provided or doesn't exist, find first empty slot
  if (!targetId || !GMAIL_ACCOUNT_SLOTS.includes(targetId as any)) {
    // Check if account with this email already exists in a slot
    for (const [slotId, existing] of serverGmailAccounts.entries()) {
      if (existing.email.toLowerCase() === options.email.toLowerCase()) {
        targetId = slotId;
        break;
      }
    }

    if (!targetId) {
      for (const slotId of GMAIL_ACCOUNT_SLOTS) {
        if (!serverGmailAccounts.has(slotId)) {
          targetId = slotId;
          break;
        }
      }
    }
  }

  if (!targetId) {
    throw new Error('Maximum of 3 Gmail accounts allowed. Please disconnect an existing account first.');
  }

  const existing = serverGmailAccounts.get(targetId);
  const session: ServerGmailAccountSession = {
    id: targetId,
    email: options.email,
    provider: 'google',
    status: options.hasSendPermission ? 'connected' : 'reauth_required',
    scopes: options.scopes || [GMAIL_SEND_SCOPE],
    accessToken: options.accessToken,
    hasSendPermission: options.hasSendPermission ?? true,
    connectedAt: existing?.connectedAt || new Date().toISOString(),
    lastUsedAt: existing?.lastUsedAt || null,
    totalDelivered: existing?.totalDelivered || 0,
    lastDeliveryStatus: 'Connected — Send permission granted',
  };

  serverGmailAccounts.set(targetId, session);
  return session;
}

/**
 * Remove an account from active Gmail delivery (Requirement 11).
 * Preserves all other accounts.
 */
export function removeServerGmailAccount(id: string): boolean {
  return serverGmailAccounts.delete(id);
}

export function clearAllServerGmailAccounts() {
  serverGmailAccounts.clear();
}

/**
 * Backward-compatibility helpers for single-session callers
 */
export function getServerGmailSession(): ServerGmailAccountSession | null {
  // Returns first connected account with send permission, or first available session
  const accounts = getAllServerGmailAccounts();
  return accounts.find((a) => a.hasSendPermission) || accounts[0] || null;
}

export function setServerGmailSession(session: {
  accessToken: string;
  email: string;
  hasSendPermission?: boolean;
}) {
  setServerGmailAccount({
    id: 'gmail_account_1',
    email: session.email,
    accessToken: session.accessToken,
    hasSendPermission: session.hasSendPermission,
  });
}

export function clearServerGmailSession() {
  removeServerGmailAccount('gmail_account_1');
}

export function formatAlertEmail(payload: AlertEmailPayload): { subject: string; body: string } {
  const subject = `CompetitorLens Alert — ${payload.competitorName}`;

  const recentTimelineFormatted =
    payload.recentTimeline && payload.recentTimeline.length > 0
      ? payload.recentTimeline.map((item) => `• ${item}`).join('\n')
      : '• Baseline monitoring established for competitor.';

  const body = [
    'New Competitive Update',
    '',
    'Competitor:',
    payload.competitorName,
    '',
    'What changed:',
    payload.whatChanged,
    '',
    'Historical Context:',
    payload.historicalContext || 'Accumulated timeline maintained in Hindsight persistent memory.',
    '',
    'Detected Pattern:',
    payload.detectedPattern || 'Progressive competitive capability expansion detected.',
    '',
    'Why it matters:',
    payload.whyItMatters || 'Alters market dynamics and competitive positioning.',
    '',
    'Recent Timeline:',
    recentTimelineFormatted,
    '',
    'Generated by:',
    'CompetitorLens',
  ].join('\n');

  return { subject, body };
}

function createMimeMessage(to: string, subject: string, bodyText: string, from?: string): string {
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`;

  const emailLines: string[] = [];
  if (from && from.includes('@')) {
    emailLines.push(`From: ${from}`);
  }
  emailLines.push(`To: ${to}`);
  emailLines.push(`Subject: ${utf8Subject}`);
  emailLines.push('MIME-Version: 1.0');
  emailLines.push('Content-Type: text/plain; charset=UTF-8');
  emailLines.push('Content-Transfer-Encoding: base64');
  emailLines.push('');
  emailLines.push(Buffer.from(bodyText, 'utf-8').toString('base64'));

  const rawMessage = emailLines.join('\r\n');
  return Buffer.from(rawMessage, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Requirement 11: Call Gmail API using users.messages.send.
 * Requirement 12: Verify that the credential being used has gmail.send scope before calling Gmail API.
 * Requirement 13: If scope is missing, do NOT call Gmail API.
 */
export async function sendGmailAlert(
  accessToken: string,
  payload: AlertEmailPayload,
  recipientEmail?: string
): Promise<GmailSendResult> {
  if (!accessToken) {
    return {
      success: false,
      error: 'Gmail permission needs to be reauthorized.',
      needsReauthorization: true,
    };
  }

  // Requirement 12 & 13: Verify scope BEFORE calling Gmail API
  const tokenCheck = await verifyGoogleTokenScopes(accessToken);
  if (!tokenCheck.valid || !tokenCheck.hasGmailSend) {
    return {
      success: false,
      error: 'Gmail permission needs to be reauthorized.',
      needsReauthorization: true,
    };
  }

  try {
    const targetTo = recipientEmail || tokenCheck.email;

    if (!targetTo || !targetTo.includes('@')) {
      return {
        success: false,
        error: 'Unable to determine target recipient email. Please reconnect your Gmail account.',
      };
    }

    const { subject, body } = formatAlertEmail(payload);
    const rawEncoded = createMimeMessage(targetTo, subject, body, targetTo);

    // users.messages.send endpoint
    const sendResp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawEncoded }),
      signal: AbortSignal.timeout(12000),
    });

    if (!sendResp.ok) {
      const errText = await sendResp.text();
      let parsedMessage = errText;
      let isScopeError = false;
      try {
        const errJson = JSON.parse(errText);
        parsedMessage = errJson?.error?.message || errText;
        if (
          errJson?.error?.status === 'PERMISSION_DENIED' ||
          errJson?.error?.errors?.some((e: any) => e.reason === 'insufficientPermissions' || e.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT')
        ) {
          isScopeError = true;
        }
      } catch {
        // use raw text
      }

      console.warn('[Gmail Delivery] API error status:', sendResp.status);

      if (sendResp.status === 403 || isScopeError) {
        return {
          success: false,
          error: 'Gmail permission needs to be reauthorized.',
          needsReauthorization: true,
        };
      }

      return {
        success: false,
        error: `Gmail API error (${sendResp.status}): ${parsedMessage}`,
      };
    }

    const sendData = await sendResp.json();
    const sentAt = new Date().toISOString();

    console.log(`[Gmail Delivery] Successfully sent message ${sendData.id} to ${targetTo}`);

    return {
      success: true,
      messageId: sendData.id,
      threadId: sendData.threadId,
      deliveredTo: targetTo,
      sentAt,
    };
  } catch (err: any) {
    console.error('[Gmail Delivery] Execution error:', err?.message || err);
    return {
      success: false,
      error: err.message,
    };
  }
}
