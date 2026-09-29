import type { IntelligenceRepository } from '../db/repository.ts';
import { hindsightAdapter } from '../hindsight/client.ts';
import {
  getAllServerGmailAccounts,
  getServerGmailAccount,
  sendGmailAlert,
  verifyGoogleTokenScopes,
} from '../gmail/delivery-service.ts';
import type { AlertAccountDelivery, IntelligenceAlert } from '../../types/intelligence.ts';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export function startOutboxWorker(repo: IntelligenceRepository, intervalMs = 10000) {
  if (workerInterval) return;

  workerInterval = setInterval(async () => {
    if (isProcessing) return;
    isProcessing = true;
    try {
      await processPendingMemoryOutbox(repo);
    } catch (err: any) {
      console.warn('[Outbox Worker] Error during run:', err.message);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);
}

function updateAccountDeliveryInAlert(
  alert: IntelligenceAlert,
  delivery: AlertAccountDelivery
) {
  if (!alert.gmailDeliveries) {
    alert.gmailDeliveries = [];
  }
  const idx = alert.gmailDeliveries.findIndex((d) => d.accountId === delivery.accountId);
  if (idx >= 0) {
    alert.gmailDeliveries[idx] = { ...alert.gmailDeliveries[idx], ...delivery };
  } else {
    alert.gmailDeliveries.push(delivery);
  }
}

export async function processPendingMemoryOutbox(repo: IntelligenceRepository): Promise<number> {
  const pendingItems = await repo.getPendingOutboxItems(20);
  if (pendingItems.length === 0) return 0;

  let confirmed = 0;
  for (const item of pendingItems) {
    try {
      // 1. Alert Outbox Delivery (Requirement 8 & 9)
      if (item.eventType === 'alert_dispatch') {
        const rawEntityId = item.entityId;
        const alertId = item.payload.alertId || (rawEntityId.includes('__') ? rawEntityId.split('__')[0] : rawEntityId);
        const targetAccountId: string | null =
          item.payload.accountId || (rawEntityId.includes('__') ? rawEntityId.split('__')[1] : null);

        const alert = await repo.getAlert(item.workspaceId, alertId);
        if (!alert) {
          console.error(`[OUTBOX] Alert ${alertId} not found in database`);
          await repo.updateOutboxStatus(item.id, 'failed', 'Alert record not found in database');
          continue;
        }

        // Case A: Specific target account (e.g. alert-101__gmail_account_1)
        if (targetAccountId) {
          // Requirement 16: Duplicate protection using alert_id + gmail_account_id
          const existingDelivery = alert.gmailDeliveries?.find((d) => d.accountId === targetAccountId);
          if (existingDelivery?.status === 'sent') {
            console.log(`[OUTBOX] Alert ${alertId} already delivered to ${targetAccountId}. Skipping duplicate.`);
            await repo.updateOutboxStatus(item.id, 'confirmed');
            confirmed++;
            continue;
          }

          const account = getServerGmailAccount(targetAccountId);
          if (!account || !account.accessToken || !account.hasSendPermission) {
            console.log(
              `[OUTBOX] Alert ${alertId} for ${targetAccountId} queued: awaiting authenticated Gmail account with gmail.send permission`
            );
            updateAccountDeliveryInAlert(alert, {
              accountId: targetAccountId,
              email: account?.email || item.payload.email || 'pending@gmail.com',
              status: 'reauth_required',
              error: 'Gmail permission needs to be reauthorized',
            });
            await repo.updateAlert(item.workspaceId, alert.id, { gmailDeliveries: alert.gmailDeliveries });
            await repo.updateOutboxStatus(item.id, 'pending', 'Awaiting Gmail account authorization');
            continue;
          }

          // Requirement 9: Verify gmail.send scope before calling Gmail API
          const scopeCheck = await verifyGoogleTokenScopes(account.accessToken);
          if (!scopeCheck.valid || !scopeCheck.hasGmailSend) {
            account.hasSendPermission = false;
            account.status = 'reauth_required';
            console.warn(`[GMAIL] Account ${targetAccountId} lacks gmail.send permission. Marked as REAUTH_REQUIRED.`);
            updateAccountDeliveryInAlert(alert, {
              accountId: targetAccountId,
              email: account.email,
              status: 'reauth_required',
              error: 'Gmail permission needs to be reauthorized',
            });
            await repo.updateAlert(item.workspaceId, alert.id, { gmailDeliveries: alert.gmailDeliveries });
            await repo.updateOutboxStatus(item.id, 'pending', 'Gmail permission needs to be reauthorized');
            continue;
          }

          console.log(`[OUTBOX] Processing\nalertId=${alertId}\naccountId=${targetAccountId}`);
          console.log(`[GMAIL] Preparing delivery for ${targetAccountId} (${account.email})`);
          console.log(`[GMAIL] gmail.send scope verified`);
          console.log(`[GMAIL] Sending alert\nalertId=${alertId}\naccountId=${targetAccountId}`);

          const sendResult = await sendGmailAlert(
            account.accessToken,
            {
              competitorName: alert.competitorName || item.payload.competitorName || 'Competitor',
              whatChanged: item.payload.whatChanged || alert.message,
              historicalContext: item.payload.historicalContext || alert.historicalContext || '',
              detectedPattern: item.payload.detectedPattern || alert.detectedPattern || '',
              whyItMatters: item.payload.whyItMatters || alert.whyItMatters || '',
              recentTimeline: item.payload.recentTimeline || alert.recentTimeline || [],
            },
            account.email
          );

          if (sendResult.success) {
            console.log(`[GMAIL] Send successful for ${targetAccountId}\nmessageId=${sendResult.messageId}`);
            account.lastUsedAt = new Date().toISOString();
            account.totalDelivered = (account.totalDelivered || 0) + 1;
            account.lastDeliveryStatus = `Delivered to ${account.email} at ${new Date().toLocaleTimeString()}`;

            updateAccountDeliveryInAlert(alert, {
              accountId: targetAccountId,
              email: account.email,
              status: 'sent',
              sentAt: sendResult.sentAt,
            });

            await repo.updateAlert(item.workspaceId, alert.id, {
              gmailDeliveries: alert.gmailDeliveries,
              gmailDeliveryStatus: 'delivered',
              gmailDeliveredTo: account.email,
              gmailSentAt: sendResult.sentAt,
            });

            await repo.updateOutboxStatus(item.id, 'confirmed');
            console.log(`[OUTBOX] Delivery completed\nalertId=${alertId}\naccountId=${targetAccountId}`);
            confirmed++;
          } else {
            console.error(`[GMAIL] Account ${targetAccountId} delivery failed: ${sendResult.error}`);
            updateAccountDeliveryInAlert(alert, {
              accountId: targetAccountId,
              email: account.email,
              status: sendResult.needsReauthorization ? 'reauth_required' : 'failed',
              error: sendResult.error,
            });
            await repo.updateAlert(item.workspaceId, alert.id, { gmailDeliveries: alert.gmailDeliveries });

            if (sendResult.needsReauthorization) {
              account.hasSendPermission = false;
              account.status = 'reauth_required';
              await repo.updateOutboxStatus(item.id, 'pending', 'Gmail permission needs to be reauthorized');
            } else {
              await repo.updateOutboxStatus(item.id, 'failed', sendResult.error);
            }
          }
          continue;
        }

        // Case B: General alert delivery item (broadcast to all connected accounts)
        const connectedAccounts = getAllServerGmailAccounts().filter(
          (a) => a.hasSendPermission && a.status === 'connected'
        );

        if (connectedAccounts.length === 0) {
          console.log(`[OUTBOX] Alert ${alertId} queued: awaiting authenticated Gmail account with gmail.send permission`);
          await repo.updateOutboxStatus(item.id, 'pending', 'Awaiting Gmail authentication with gmail.send permission');
          continue;
        }

        let anySuccess = false;
        for (const account of connectedAccounts) {
          // Requirement 16: Check duplicate
          const existing = alert.gmailDeliveries?.find((d) => d.accountId === account.id);
          if (existing?.status === 'sent') continue;

          console.log(`[OUTBOX] Processing\nalertId=${alertId}\naccountId=${account.id}`);
          console.log(`[GMAIL] Preparing delivery for ${account.id} (${account.email})`);
          console.log(`[GMAIL] gmail.send scope verified`);
          console.log(`[GMAIL] Sending alert\nalertId=${alertId}\naccountId=${account.id}`);

          const sendResult = await sendGmailAlert(
            account.accessToken,
            {
              competitorName: alert.competitorName || 'Competitor',
              whatChanged: alert.message,
              historicalContext: alert.historicalContext || '',
              detectedPattern: alert.detectedPattern || '',
              whyItMatters: alert.whyItMatters || '',
              recentTimeline: alert.recentTimeline || [],
            },
            account.email
          );

          if (sendResult.success) {
            console.log(`[GMAIL] Send successful for ${account.id}\nmessageId=${sendResult.messageId}`);
            account.totalDelivered = (account.totalDelivered || 0) + 1;
            account.lastUsedAt = new Date().toISOString();
            updateAccountDeliveryInAlert(alert, {
              accountId: account.id,
              email: account.email,
              status: 'sent',
              sentAt: sendResult.sentAt,
            });
            anySuccess = true;
          } else {
            console.error(`[GMAIL] Account ${account.id} send failed: ${sendResult.error}`);
            updateAccountDeliveryInAlert(alert, {
              accountId: account.id,
              email: account.email,
              status: sendResult.needsReauthorization ? 'reauth_required' : 'failed',
              error: sendResult.error,
            });
          }
        }

        await repo.updateAlert(item.workspaceId, alert.id, {
          gmailDeliveries: alert.gmailDeliveries,
          gmailDeliveryStatus: anySuccess ? 'delivered' : 'failed',
        });

        if (anySuccess) {
          await repo.updateOutboxStatus(item.id, 'confirmed');
          confirmed++;
        } else {
          await repo.updateOutboxStatus(item.id, 'pending', 'Retrying delivery for accounts');
        }
        continue;
      }

      // 2. Memory Ingestion Confirmation for Hindsight
      const bankId = item.payload.bankId || hindsightAdapter.getBankId(item.workspaceId, item.workspaceId.includes('demo'));
      const docId = item.payload.documentId || `event:${item.entityId}`;

      if (hindsightAdapter.isConfigured()) {
        const checkStatus = await hindsightAdapter.checkIngestion(bankId, docId);
        if (checkStatus === 'confirmed') {
          await repo.updateOutboxStatus(item.id, 'confirmed');
          confirmed++;
        } else if (item.retryCount >= 4) {
          await repo.updateOutboxStatus(item.id, 'failed', 'Max retries exceeded');
        } else {
          await repo.updateOutboxStatus(item.id, 'processing');
        }
      } else {
        if (item.retryCount < 2) {
          await repo.updateOutboxStatus(item.id, 'pending', 'Hindsight API key not set');
        }
      }
    } catch (err: any) {
      console.error(`[OUTBOX] Error processing item ${item.id}:`, err?.message || err);
      await repo.updateOutboxStatus(item.id, 'failed', err?.message || 'Unknown error');
    }
  }

  return confirmed;
}
