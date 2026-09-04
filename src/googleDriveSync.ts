import type { GoogleApiService } from './api/googleApiService';
import type { AppDocument, DriveFileMetadata, DriveUser } from './types';
import { isAppDocument, migrateDocument } from './utils/documentUtils';

const DRIVE_FILE_NAME = 'textbook-data.json';
const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3';

interface DriveFileListResponse {
  files: DriveFileMetadata[];
}

interface DriveAboutResponse {
  user: {
    permissionId: string;
    displayName?: string;
    emailAddress?: string;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isDriveFileMetadata = (value: unknown): value is DriveFileMetadata => {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.version === 'string' &&
    typeof value.modifiedTime === 'string'
  );
};

const isDriveFileListResponse = (value: unknown): value is DriveFileListResponse =>
  isRecord(value) && Array.isArray(value.files) && value.files.every(isDriveFileMetadata);

const isDriveAboutResponse = (value: unknown): value is DriveAboutResponse => {
  if (!isRecord(value) || !isRecord(value.user)) return false;
  return typeof value.user.permissionId === 'string';
};

export interface GoogleDriveSyncService {
  getCurrentUser: () => Promise<DriveUser>;
  findFiles: () => Promise<DriveFileMetadata[]>;
  getFileMetadata: (fileId: string) => Promise<DriveFileMetadata>;
  downloadFile: (fileId: string) => Promise<AppDocument>;
  uploadFile: (document: AppDocument, fileId: string | null) => Promise<DriveFileMetadata>;
}

export const createGoogleDriveSyncService = (apiService: GoogleApiService): GoogleDriveSyncService => {
  const getCurrentUser = async (): Promise<DriveUser> => {
    const params = new URLSearchParams({ fields: 'user(permissionId,displayName,emailAddress)' });
    const response = await apiService.requestJson(
      `${DRIVE_API_BASE_URL}/about?${params.toString()}`,
      undefined,
      isDriveAboutResponse
    );

    return {
      id: response.user.permissionId,
      displayName: response.user.displayName ?? '',
      emailAddress: response.user.emailAddress ?? '',
    };
  };

  const findFiles = async (): Promise<DriveFileMetadata[]> => {
    const params = new URLSearchParams({
      q: `name = '${DRIVE_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`,
      spaces: 'appDataFolder',
      orderBy: 'modifiedTime desc',
      pageSize: '100',
      fields: 'files(id,version,modifiedTime)',
    });

    const response = await apiService.requestJson(
      `${DRIVE_API_BASE_URL}/files?${params.toString()}`,
      undefined,
      isDriveFileListResponse
    );

    return response.files;
  };

  const getFileMetadata = async (fileId: string): Promise<DriveFileMetadata> => {
    const params = new URLSearchParams({ fields: 'id,version,modifiedTime' });
    return apiService.requestJson(
      `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
      undefined,
      isDriveFileMetadata
    );
  };

  const downloadFile = async (fileId: string): Promise<AppDocument> => {
    const response = await apiService.request(
      `${DRIVE_API_BASE_URL}/files/${encodeURIComponent(fileId)}?alt=media`
    );
    const value: unknown = await response.json();

    if (!isAppDocument(value)) {
      throw new Error('The Google Drive data file is invalid or corrupted. Local data was not replaced.');
    }

    return migrateDocument(value);
  };

  const uploadFile = async (
    document: AppDocument,
    fileId: string | null
  ): Promise<DriveFileMetadata> => {
    const boundary = `textbook_${crypto.randomUUID()}`;
    const metadata = fileId
      ? { name: DRIVE_FILE_NAME }
      : { name: DRIVE_FILE_NAME, parents: ['appDataFolder'] };

    const requestBody = new Blob([
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(document),
      `\r\n--${boundary}--`,
    ]);

    const params = new URLSearchParams({
      uploadType: 'multipart',
      fields: 'id,version,modifiedTime',
    });

    const url = fileId
      ? `${DRIVE_UPLOAD_BASE_URL}/files/${encodeURIComponent(fileId)}?${params.toString()}`
      : `${DRIVE_UPLOAD_BASE_URL}/files?${params.toString()}`;

    return apiService.requestJson(
      url,
      {
        method: fileId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body: requestBody,
      },
      isDriveFileMetadata
    );
  };

  return {
    getCurrentUser,
    findFiles,
    getFileMetadata,
    downloadFile,
    uploadFile,
  };
};
