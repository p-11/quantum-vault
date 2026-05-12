import { useRef } from 'react';
import { cn } from '@/lib/utils';

type TabsHeaderTab<T extends string> = {
  id: T;
  label: string;
};

type TabsHeaderProps<T extends string> = {
  tabs: ReadonlyArray<TabsHeaderTab<T>>;
  activeTabId: T;
  onChange(tabId: T): void;
  getTabPanelId?(tabId: T): string;
  className?: string;
};

type TabIndexResolverInput = {
  currentIndex: number;
  lastIndex: number;
};

const keyToTabIndexResolver: Partial<
  Record<string, (input: TabIndexResolverInput) => number>
> = {
  ArrowRight: ({ currentIndex, lastIndex }) =>
    currentIndex === lastIndex ? 0 : currentIndex + 1,
  ArrowLeft: ({ currentIndex, lastIndex }) =>
    currentIndex === 0 ? lastIndex : currentIndex - 1,
  Home: () => 0,
  End: ({ lastIndex }) => lastIndex
};

const getNextTabId = <T extends string>({
  key,
  currentIndex,
  tabs
}: {
  key: string;
  currentIndex: number;
  tabs: ReadonlyArray<TabsHeaderTab<T>>;
}): T | undefined => {
  const resolveIndex = keyToTabIndexResolver[key];

  if (!resolveIndex) {
    return undefined;
  }

  const nextIndex = resolveIndex({
    currentIndex,
    lastIndex: tabs.length - 1
  });

  return tabs[nextIndex]?.id;
};

/**
 * Underlined tab header used by Vault Detail Funds/Activity split
 * (Figma 32:1597, 44:5123, 44:12731, 44:13318).
 *
 * Uses ARIA tab semantics with keyboard navigation (left/right/home/end) and
 * roving tab focus.
 */
export const TabsHeader = <T extends string>({
  tabs,
  activeTabId,
  onChange,
  getTabPanelId,
  className
}: TabsHeaderProps<T>) => {
  const tabButtonByIdRef = useRef(new Map<T, HTMLButtonElement>());

  const focusTab = (tabId: T) => {
    const button = tabButtonByIdRef.current.get(tabId);
    if (!button) {
      return;
    }

    button.focus();
  };

  const handleTabKeyDown = ({
    key,
    currentTabId,
    preventDefault
  }: {
    key: string;
    currentTabId: T;
    preventDefault(): void;
  }) => {
    const currentIndex = tabs.findIndex(tab => tab.id === currentTabId);
    if (currentIndex === -1) {
      return;
    }

    const nextTabId = getNextTabId({
      key,
      currentIndex,
      tabs
    });

    if (!nextTabId) {
      return;
    }

    preventDefault();
    onChange(nextTabId);
    focusTab(nextTabId);
  };

  return (
    <div
      role='tablist'
      aria-orientation='horizontal'
      className={cn(
        '-mx-4 flex h-12 items-center gap-4 border-b border-popover px-4',
        className
      )}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeTabId;
        const tabId = `tab-${tab.id}`;

        return (
          <button
            key={tab.id}
            ref={button => {
              if (!button) {
                tabButtonByIdRef.current.delete(tab.id);
                return;
              }

              tabButtonByIdRef.current.set(tab.id, button);
            }}
            id={tabId}
            role='tab'
            type='button'
            tabIndex={isActive ? 0 : -1}
            aria-selected={isActive}
            aria-controls={getTabPanelId ? getTabPanelId(tab.id) : undefined}
            data-testid={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={event =>
              handleTabKeyDown({
                key: event.key,
                currentTabId: tab.id,
                preventDefault: () => event.preventDefault()
              })
            }
            className={cn(
              'type-body uppercase tracking-wide transition-colors',
              isActive ? 'text-foreground' : 'text-footer-muted'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
