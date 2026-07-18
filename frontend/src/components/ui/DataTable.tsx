import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { Button, IconButton } from './Button';
import { EmptyState, ErrorState, TableSkeleton } from './Feedback';

export interface Column<T> {
  /** Stable id — also the sort key when the column is sortable. */
  id: string;
  header: ReactNode;
  /** How the cell renders. Given the whole row, so a cell can combine fields. */
  cell: (row: T) => ReactNode;
  /** Provide a comparable value to make the column sortable. */
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Columns marked secondary collapse away on small screens instead of squashing. */
  secondary?: boolean;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Server-side pagination. Omit for a plain list. */
  pagination?: {
    page: number;
    limit: number;
    total?: number;
    onPageChange: (page: number) => void;
  };
  className?: string;
}

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null;

/**
 * The one table in the product.
 *
 * Sorting is client-side over the page you're looking at, which is honest: the header
 * only offers to sort what it can actually see. Anything larger paginates on the server.
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  isLoading,
  error,
  onRetry,
  onRowClick,
  empty,
  pagination,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    if (!sort) return data;
    const column = columns.find((c) => c.id === sort.columnId);
    if (!column?.sortValue) return data;

    return [...data].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      if (left === right) return 0;
      const result = left < right ? -1 : 1;
      return sort.direction === 'asc' ? result : -result;
    });
  }, [data, sort, columns]);

  const toggleSort = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((current) => {
      if (current?.columnId !== column.id) return { columnId: column.id, direction: 'asc' };
      if (current.direction === 'asc') return { columnId: column.id, direction: 'desc' };
      return null; // third click clears the sort and restores the server's order
    });
  };

  if (error) {
    return (
      <div className={cn('rounded-surface border-hair border-line bg-surface', className)}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('rounded-surface border-hair border-line bg-surface', className)}>
        <TableSkeleton columns={Math.min(columns.length, 6)} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={cn('rounded-surface border-hair border-line bg-surface', className)}>
        <EmptyState
          title={empty?.title ?? 'Nothing here yet'}
          description={empty?.description}
          action={empty?.action}
        />
      </div>
    );
  }

  const total = pagination?.total;
  const from = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const to = pagination ? from + rows.length - 1 : 0;
  const hasNext = pagination ? (total !== undefined ? to < total : rows.length === pagination.limit) : false;

  return (
    <div className={cn('overflow-hidden rounded-surface border-hair border-line bg-surface', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-step-0">
          <thead>
            <tr className="border-b border-line bg-surface-sunken">
              {columns.map((column) => {
                const isSorted = sort?.columnId === column.id;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    style={{ width: column.width }}
                    className={cn(
                      'px-4 py-3 text-step--1 font-medium uppercase tracking-wide text-ink-muted',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                      column.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column)}
                        className={cn(
                          'inline-flex items-center gap-1 transition-colors duration-motion hover:text-ink',
                          isSorted && 'text-ink',
                        )}
                        aria-sort={isSorted ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        {column.header}
                        {isSorted ? (
                          sort.direction === 'asc' ? (
                            <ChevronUp className="h-3 w-3" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3 w-3" aria-hidden />
                          )
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'border-b border-line last:border-0 transition-colors duration-motion',
                  onRowClick && 'cursor-pointer hover:bg-surface-sunken',
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      'px-4 py-row align-middle text-ink',
                      column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                      column.secondary && 'hidden lg:table-cell',
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <p className="text-step--1 text-ink-muted">
            {total !== undefined ? (
              <>
                <span className="tabular">{from}–{to}</span> of <span className="tabular">{total}</span>
              </>
            ) : (
              <>Page <span className="tabular">{pagination.page}</span></>
            )}
          </p>
          <div className="flex items-center gap-1">
            <IconButton
              label="Previous page"
              variant="outline"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <IconButton
              label="Next page"
              variant="outline"
              disabled={!hasNext}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      )}
    </div>
  );
}

/** A row action group that doesn't trigger the row's own click handler. */
export function RowActions({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-end gap-1"
      onClick={(event) => event.stopPropagation()}
      role="group"
    >
      {children}
    </div>
  );
}

export { Button as TableButton };
