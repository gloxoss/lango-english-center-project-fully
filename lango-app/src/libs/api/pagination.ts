const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export type Pagination = { page: number; pageSize: number; limit: number; offset: number };

/**
 * Clamps page/pageSize from query params to sane bounds. Invalid or missing
 *  values fall back to defaults rather than throwing - pagination is a display
 *  concern, not something a malformed param should turn into a 400.
 */
export function parsePagination(searchParams: URLSearchParams): Pagination {
  const rawPage = Number.parseInt(searchParams.get('page') ?? '', 10);
  const rawPageSize = Number.parseInt(searchParams.get('pageSize') ?? '', 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(rawPageSize, MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;

  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}
