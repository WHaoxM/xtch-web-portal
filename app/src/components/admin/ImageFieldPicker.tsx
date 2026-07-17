import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  fetchAdminMedia,
  postAdminMedia,
  presignMediaUpload,
  uploadFileToPresignedUrl,
  type MediaAsset,
} from '@/lib/mediaClient';

type ImageFieldPickerProps = {
  value: string;
  onChange: (url: string) => void;
  token: string;
  disabled?: boolean;
  /** When set, library dialog can filter to media linked to this route. */
  contextRouteSlug?: string;
  /** When set, library dialog can filter to media linked to this destination. */
  contextDestinationSlug?: string;
};

export function ImageFieldPicker({
  value,
  onChange,
  token,
  disabled,
  contextRouteSlug,
  contextDestinationSlug,
}: ImageFieldPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);

  async function uploadSelectedFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const contentType = file.type || 'application/octet-stream';
      const presigned = await presignMediaUpload(token, {
        filename: file.name,
        contentType,
      });
      await uploadFileToPresignedUrl(presigned.uploadUrl, file, presigned.contentType);
      await postAdminMedia(token, {
        action: 'create',
        type: 'image',
        publicUrl: presigned.publicUrl,
        title: file.name.replace(/\.[^.]+$/, ''),
        altText: '',
        destinationSlugs: contextDestinationSlug ? [contextDestinationSlug] : [],
        routeSlugs: contextRouteSlug ? [contextRouteSlug] : [],
        tags: [],
        status: 'published',
      });
      onChange(presigned.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败。');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      {value ? (
        <img
          src={value}
          alt="封面预览"
          className="h-32 w-full max-w-xs rounded-md border border-input object-cover"
        />
      ) : (
        <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-input text-xs text-muted-foreground">
          暂无图片
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        上传后立刻用作封面，同时进入素材库（可用）。在路线/目的地里上传不会增加「待审素材」。
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={
            disabled || uploading
              ? 'inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50 pointer-events-none'
              : 'inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90'
          }
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                void uploadSelectedFile(file);
              }
            }}
          />
          {uploading ? '上传中…' : '上传本地文件'}
        </label>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || uploading}
          onClick={() => setLibraryOpen(true)}
        >
          从素材库选择
        </Button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground">
          高级：手动填写链接
        </summary>
        <Input
          className="mt-2"
          value={value}
          placeholder="https://..."
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </details>

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        token={token}
        contextRouteSlug={contextRouteSlug}
        contextDestinationSlug={contextDestinationSlug}
        onSelect={(url) => {
          onChange(url);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

type MediaLibraryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  onSelect: (url: string) => void;
  contextRouteSlug?: string;
  contextDestinationSlug?: string;
};

function MediaLibraryDialog({
  open,
  onOpenChange,
  token,
  onSelect,
  contextRouteSlug,
  contextDestinationSlug,
}: MediaLibraryDialogProps) {
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [linkedOnly, setLinkedOnly] = useState(false);

  const hasContext = Boolean(contextRouteSlug || contextDestinationSlug);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void fetchAdminMedia(token, { status: 'published' })
      .then((items) => {
        if (!active) return;
        setMedia(items.filter((item) => item.type === 'image'));
        setLoadedFor(token);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : '加载素材库失败。');
        setLoadedFor(token);
      });
    return () => {
      active = false;
    };
  }, [open, token]);

  const loading = open && loadedFor !== token && !error;

  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    return media.filter((item) => {
      if (query && !item.title.toLowerCase().includes(query)) return false;
      if (!linkedOnly) return true;
      if (contextRouteSlug && item.routeSlugs.includes(contextRouteSlug)) return true;
      if (contextDestinationSlug && item.destinationSlugs.includes(contextDestinationSlug)) {
        return true;
      }
      return false;
    });
  }, [media, search, linkedOnly, contextRouteSlug, contextDestinationSlug]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setMedia([]);
      setError('');
      setLoadedFor(null);
      setSearch('');
      setLinkedOnly(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>从素材库选择</DialogTitle>
          <DialogDescription>
            仅显示已发布的图片。点选后立刻用作当前封面（不会自动改其它产品图）。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="按标题搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
          />
          {hasContext ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={linkedOnly}
                onChange={(event) => setLinkedOnly(event.target.checked)}
              />
              只看已关联
              {contextRouteSlug ? '当前路线' : ''}
              {contextDestinationSlug ? '当前目的地' : ''}
            </label>
          ) : null}
        </div>

        {loading && <p className="text-sm text-muted-foreground">加载中…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && visibleMedia.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {search.trim() || linkedOnly ? '无匹配图片。' : '素材库暂无已发布的图片。'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleMedia.map((item) => (
            <button
              key={item.id}
              type="button"
              className="group overflow-hidden rounded-md border border-input text-left transition hover:border-primary"
              onClick={() => onSelect(item.publicUrl)}
            >
              <img
                src={item.publicUrl}
                alt={item.altText || item.title}
                className="aspect-[4/3] h-auto w-full object-cover"
              />
              <span className="block truncate px-2 py-1.5 text-xs text-muted-foreground">
                {item.title || item.publicUrl}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
