import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type MediaBrowseFilterOption = {
  value: string;
  label: string;
};

type MediaBrowseFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit?: () => void;
  destinationSlug: string;
  onDestinationChange: (value: string) => void;
  routeSlug: string;
  onRouteChange: (value: string) => void;
  destinations: MediaBrowseFilterOption[];
  routes: MediaBrowseFilterOption[];
  disabled?: boolean;
  /** When true, destination/route selects are disabled (e.g. linked-only mode). */
  associationSelectsDisabled?: boolean;
  linkedOnly?: boolean;
  onLinkedOnlyChange?: (value: boolean) => void;
  linkedOnlyLabel?: string;
  showSearchButton?: boolean;
  searchLoading?: boolean;
};

export function MediaBrowseFilters({
  search,
  onSearchChange,
  onSearchSubmit,
  destinationSlug,
  onDestinationChange,
  routeSlug,
  onRouteChange,
  destinations,
  routes,
  disabled,
  associationSelectsDisabled,
  linkedOnly,
  onLinkedOnlyChange,
  linkedOnlyLabel,
  showSearchButton = true,
  searchLoading,
}: MediaBrowseFiltersProps) {
  const selectsDisabled = Boolean(disabled || associationSelectsDisabled);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        placeholder="搜索标题或标签"
        value={search}
        disabled={disabled}
        onChange={(event) => onSearchChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSearchSubmit?.();
        }}
        className="sm:max-w-xs"
      />
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[12rem]"
        value={destinationSlug}
        disabled={selectsDisabled}
        onChange={(event) => onDestinationChange(event.target.value)}
      >
        <option value="">全部目的地</option>
        {destinations.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <select
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm sm:max-w-[14rem]"
        value={routeSlug}
        disabled={selectsDisabled}
        onChange={(event) => onRouteChange(event.target.value)}
      >
        <option value="">全部路线</option>
        {routes.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      {onLinkedOnlyChange && linkedOnlyLabel ? (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={Boolean(linkedOnly)}
            disabled={disabled}
            onChange={(event) => onLinkedOnlyChange(event.target.checked)}
          />
          {linkedOnlyLabel}
        </label>
      ) : null}
      {showSearchButton ? (
        <Button type="button" disabled={disabled || searchLoading} onClick={() => onSearchSubmit?.()}>
          {searchLoading ? '加载中...' : '搜索'}
        </Button>
      ) : null}
    </div>
  );
}
