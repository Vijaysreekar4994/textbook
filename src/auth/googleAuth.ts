const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const TOKEN_EXPIRY_SAFETY_MS = 60_000;
const ACCESS_TOKEN_KEY = 'textbook_google_access_token';
const TOKEN_EXPIRY_KEY = 'textbook_google_token_expiry';

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  error_subtype?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: '' | 'none' | 'consent' | 'select_account' }) => void;
}

interface GoogleOauth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => GoogleTokenClient;
  revoke: (token: string, callback?: () => void) => void;
}

interface GoogleWindow extends Window {
  google?: {
    accounts?: {
      oauth2?: GoogleOauth2Api;
    };
  };
}

export interface GoogleAuthSession {
  getAccessToken: () => string | null;
  hasValidAccessToken: () => boolean;
  requestAccess: (forceAccountSelection?: boolean) => Promise<void>;
  clearAccessToken: () => void;
  revokeAccess: () => Promise<void>;
}

export const createGoogleAuthSession = (clientId: string): GoogleAuthSession => {
  const storedAccessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const storedExpiry = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY) ?? 0);

  let accessToken: string | null =
    storedAccessToken && storedExpiry > Date.now()
      ? storedAccessToken
      : null;

  let tokenExpiresAt = accessToken ? storedExpiry : 0;

  const getOauth2Api = (): GoogleOauth2Api => {
    const googleWindow = window as GoogleWindow;
    const oauth2 = googleWindow.google?.accounts?.oauth2;

    if (!oauth2) {
      throw new Error('Google Identity Services is unavailable. Check the network and GIS script.');
    }

    return oauth2;
  };

  const hasValidAccessToken = (): boolean =>
    Boolean(accessToken) && Date.now() < tokenExpiresAt - TOKEN_EXPIRY_SAFETY_MS;

  const getAccessToken = (): string | null => (hasValidAccessToken() ? accessToken : null);

  const requestAccess = async (forceAccountSelection = false): Promise<void> => {
    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID is missing.');
    }

    const oauth2 = getOauth2Api();

    await new Promise<void>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: (response) => {
          if (!response.access_token) {
            reject(new Error(response.error_description || response.error || 'Google authorization failed.'));
            return;
          }

          accessToken = response.access_token;
          tokenExpiresAt = Date.now() + (response.expires_in ?? 3600) * 1000;

          sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
          sessionStorage.setItem(TOKEN_EXPIRY_KEY, tokenExpiresAt.toString());

          resolve();
        },
        error_callback: (error) => {
          reject(new Error(error.message || error.type || 'Google authorization was interrupted.'));
        },
      });

      client.requestAccessToken({ prompt: forceAccountSelection ? 'select_account' : '' });
    });
  };

  const clearAccessToken = () => {
    accessToken = null;
    tokenExpiresAt = 0;

    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
  };

  const revokeAccess = async (): Promise<void> => {
    const tokenToRevoke = accessToken;
    clearAccessToken();

    if (!tokenToRevoke) return;

    const oauth2 = getOauth2Api();
    await new Promise<void>((resolve) => oauth2.revoke(tokenToRevoke, resolve));
  };

  return {
    getAccessToken,
    hasValidAccessToken,
    requestAccess,
    clearAccessToken,
    revokeAccess,
  };
};
