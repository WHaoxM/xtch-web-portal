export type MediaMapEntry = {
  sourcePath: string;
  sourceTag: string;
  sha256: string;
  objectKey: string;
  publicUrl: string;
  mediaId: string;
  contentType: string;
  mediaType: 'image' | 'video';
  bytes: number;
  skippedUpload: boolean;
  localPublicUrl: string | null;
};

export type MediaMapFile = {
  version: 1;
  generatedAt: string;
  keyEnv: 'dev' | 'prod';
  publicBaseUrl: string;
  bucket: string;
  counts: {
    scanned: number;
    uniqueHashes: number;
    uploaded: number;
    skippedUpload: number;
    upserted: number;
  };
  entries: MediaMapEntry[];
};
