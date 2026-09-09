import { useState } from 'react';
import { Icon } from '../components';
import { useDriveSync } from '../sync/DriveSyncContext';
import type { AppDocument } from '../types';

interface SyncPanelProps {
  document: AppDocument | null;
  isDbAvailable: boolean;
}

const STATUS_LABELS = {
  'local-only': 'Local only',
  connecting: 'Connecting',
  syncing: 'Syncing',
  synced: 'Synced',
  offline: 'Offline',
  'reauth-required': 'Reconnect required',
  error: 'Sync failed',
} as const;

const STATUS_CLASS_NAMES = {
  'local-only': 'state-local-only',
  connecting: 'state-signing-in',
  syncing: 'state-syncing',
  synced: 'state-synced',
  offline: 'state-local-only',
  'reauth-required': 'state-signed-out',
  error: 'state-sync-failed',
} as const;

export const SyncPanel = ({ document, isDbAvailable }: SyncPanelProps) => {
  const {
    status,
    errorMessage,
    currentUser,
    isConnected,
    connect,
    syncNow,
    logout,
  } = useDriveSync();
  const [isLogoutPending, setIsLogoutPending] = useState(false);

  const isBusy = status === 'connecting' || status === 'syncing' || isLogoutPending;
  const needsReconnect = isConnected && status === 'reauth-required';

  const canRetrySync =
    isConnected && (status === 'offline' || status === 'error');

  const canShowAutoSync =
    isConnected && (status === 'synced' || status === 'syncing');

  const handleConnect = () => {
    void connect();
  };
  
  const handleRetrySync = () => {
    void syncNow();
  };

  const handleLogout = async () => {
    setIsLogoutPending(true);
    try {
      await logout();
    } finally {
      setIsLogoutPending(false);
    }
  };

  return (
    <div className="sync-panel">
      <div className="sync-status" aria-live="polite">
        <span className="indicator-label">Cloud Sync:</span>
        <span className={`status-badge ${STATUS_CLASS_NAMES[status]}`}>{STATUS_LABELS[status]}</span>

        {currentUser?.emailAddress && <span className="sync-user">{currentUser.emailAddress}</span>}

        {document?.syncMetadata.lastSyncedAt && (
          <span className="timestamp">
            Last synced: {new Date(document.syncMetadata.lastSyncedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="sync-controls">
        {!isConnected && (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isBusy}
            type="button"
          >
            <Icon name="ri-plug-line" /> Connect Google Drive
          </button>
        )}

        {needsReconnect && (
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={isBusy}
            type="button"
          >
            <Icon name="ri-refresh-line" /> Reconnect Google Drive
          </button>
        )}

        {canRetrySync && (
          <button
            className="btn btn-primary"
            onClick={handleRetrySync}
            disabled={isBusy}
            type="button"
          >
            <Icon name="ri-refresh-line" /> Retry Sync
          </button>
        )}

        {status === 'offline' && isConnected && (
          <span className="auto-sync-indicator">
            <Icon name="ri-cloud-off-line" /> Changes saved locally
          </span>
        )}

        {canShowAutoSync && (
          <span className="auto-sync-indicator">
            <Icon name="ri-checkbox-circle-fill" /> Auto-sync enabled
          </span>
        )}

        {isConnected && (
          <button
            className="btn btn-outline"
            onClick={handleLogout}
            disabled={
              isBusy ||
              status === 'offline' ||
              status === 'reauth-required' ||
              status === 'error'
            }
            type="button"
          >
            <Icon name="ri-logout-box-line" /> Sign Out
          </button>
        )}
      </div>

      {errorMessage && <div className="db-alert">{errorMessage}</div>}

      {!isDbAvailable && (
        <div className="db-alert">
          <Icon name="ri-alert-line" /> IndexedDB is unavailable. Changes only survive while this page stays open.
        </div>
      )}
    </div>
  );
};
