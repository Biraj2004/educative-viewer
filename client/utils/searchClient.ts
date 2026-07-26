import { getAuthToken, ApiError, authenticatedFetch } from "./authClient";
import { getBackendApiBase } from "./runtime-config";

export interface GlobalSearchResult {
  score: number;
  course_id: number;
  course_slug: string;
  course_title: string;
  topic_index: number;
  topic_slug: string;
  topic_name: string;
  api_url?: string;
  component_types?: string;
  snippet: string;
}

export interface GlobalSearchResponse {
  query: string;
  count: number;
  results: GlobalSearchResult[];
}

export async function searchCourseContent(query: string, limit = 25): Promise<GlobalSearchResponse> {
  const q = query.trim();
  if (q.length < 3) {
    return { query: q, count: 0, results: [] };
  }

  const token = getAuthToken();
  if (!token) throw new ApiError("Authentication required", 401);

  const params = new URLSearchParams({
    q,
    limit: String(limit),
  });
  const res = await authenticatedFetch(`${getBackendApiBase()}/api/search?${params.toString()}`);

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data?.error ?? `Search failed (${res.status})`, res.status);
  }

  return {
    query: String(data?.query ?? q),
    count: Number(data?.count ?? 0),
    results: Array.isArray(data?.results) ? (data.results as GlobalSearchResult[]) : [],
  };
}
