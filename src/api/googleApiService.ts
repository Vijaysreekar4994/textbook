export class GoogleApiError extends Error {
  readonly status: number;
  readonly responseText: string;

  constructor(message: string, status: number, responseText: string) {
    super(message);

    this.name = 'GoogleApiError';
    this.status = status;
    this.responseText = responseText;
  }
}

export interface GoogleApiServiceOptions {
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
}

export interface GoogleApiService {
  request: (url: string, init?: RequestInit) => Promise<Response>;
  requestJson: <T>(
    url: string,
    init: RequestInit | undefined,
    validate: (value: unknown) => value is T
  ) => Promise<T>;
}

export const createGoogleApiService = ({
  getAccessToken,
  onUnauthorized,
}: GoogleApiServiceOptions): GoogleApiService => {
  const request = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      onUnauthorized();
      throw new GoogleApiError('Google authorization is required.', 401, '');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    const response = await fetch(url, { ...init, headers });

    if (response.status === 401) {
      onUnauthorized();
    }

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      throw new GoogleApiError(
        `Google API request failed (${response.status}).`,
        response.status,
        responseText
      );
    }

    return response;
  };

  const requestJson = async <T>(
    url: string,
    init: RequestInit | undefined,
    validate: (value: unknown) => value is T
  ): Promise<T> => {
    const response = await request(url, init);
    const value: unknown = await response.json();

    if (!validate(value)) {
      throw new Error('Google API returned an unexpected response.');
    }

    return value;
  };

  return { request, requestJson };
};
