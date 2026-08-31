import type { AppDocument } from './types';

// Browser-based Google Drive Sync service using native fetch
// Requires Google Identity Services script in index.html:
// <script src="https://accounts.google.com/gsi/client" async defer></script>

const DRIVE_FILE_NAME = 'textbook-data.json';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';

export interface DriveSyncResult {
  success: boolean;
  document?: AppDocument;
  error?: string;
  fileId?: string;
}

export class GoogleDriveSyncService {
  private clientId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0; // timestamp

  constructor(clientId: string) {
    this.clientId = clientId;
    // Restore token from sessionStorage on initialization
    this.restoreTokenFromStorage();
  }

  private restoreTokenFromStorage() {
    try {
      const storedToken = sessionStorage.getItem('google_access_token');
      const storedExpiry = sessionStorage.getItem('google_token_expiry');
      if (storedToken && storedExpiry) {
        const expiry = parseInt(storedExpiry, 10);
        if (expiry && Date.now() < expiry) {
          this.accessToken = storedToken;
          this.tokenExpiry = expiry;
          console.log('Restored Google access token from sessionStorage');
        } else {
          // Token expired, clear it
          sessionStorage.removeItem('google_access_token');
          sessionStorage.removeItem('google_token_expiry');
        }
      }
    } catch (e) {
      console.error('Failed to restore token from storage:', e);
    }
  }

  private saveTokenToStorage() {
    try {
      if (this.accessToken && this.tokenExpiry) {
        sessionStorage.setItem('google_access_token', this.accessToken);
        sessionStorage.setItem('google_token_expiry', this.tokenExpiry.toString());
      }
    } catch (e) {
      console.error('Failed to save token to storage:', e);
    }
  }

  public setAccessToken(token: string, expiresInSeconds: number) {
    this.accessToken = token;
    this.tokenExpiry = Date.now() + expiresInSeconds * 1000;
    // Persist token to sessionStorage for page refresh survival
    this.saveTokenToStorage();
  }

  public isAuthorized(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiry;
  }

  public clearToken() {
    this.accessToken = null;
    this.tokenExpiry = 0;
    // Clear from sessionStorage as well
    sessionStorage.removeItem('google_access_token');
    sessionStorage.removeItem('google_token_expiry');
  }

  // Requests access token from Google Identity Services using the browser Client ID
  public authorize(onSuccess: (token: string) => void, onError: (err: Error | string) => void) {
    if (typeof window === 'undefined') {
      onError('Window object not available');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    if (!win.google) {
      onError('Google Client SDK not loaded. Check internet connection or index.html script tag.');
      return;
    }

    try {
      const client = win.google.accounts.oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: (response: { error_subtype?: string; error?: string; access_token?: string; expires_in?: number }) => {
          if (response.error_subtype) {
            onError(response.error || 'Authentication failed');
            return;
          }
          if (response.access_token) {
            this.setAccessToken(response.access_token, response.expires_in || 3600);
            onSuccess(response.access_token);
          } else {
            onError('Authentication failed: No access token returned');
          }
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (e) {
      onError(e instanceof Error ? e : 'Authorization failed');
    }
  }

  private getHeaders(): HeadersInit {
    if (!this.accessToken) {
      throw new Error('Access token not found. User is signed out.');
    }
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Searches for todo-data.json inside Google Drive's private appDataFolder
  public async findFile(): Promise<string | null> {
    const query = encodeURIComponent(`name = '${DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=appDataFolder&fields=files(id,name)`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Failed to query files: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.files && data.files.length > 0) {
        return data.files[0].id;
      }
      return null;
    } catch (error) {
      console.error('Error finding file on Drive:', error);
      throw error;
    }
  }

  // Downloads the JSON document from Google Drive using file ID
  public async downloadFile(fileId: string): Promise<AppDocument> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Failed to download file: ${res.statusText}`);
      }

      const doc = await res.json();
      return doc as AppDocument;
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  // Uploads or updates the todo-data.json file on Google Drive
  public async uploadFile(doc: AppDocument, fileId: string | null): Promise<string> {
    const metadata = {
      name: DRIVE_FILE_NAME,
      parents: fileId ? undefined : ['appDataFolder'],
    };

    const boundary = 'foo_bar_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(doc) +
      closeDelimiter;

    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const method = fileId ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status: ${res.statusText}`);
      }

      const result = await res.json();
      return result.id;
    } catch (error) {
      console.error('Error uploading file to Drive:', error);
      throw error;
    }
  }
}