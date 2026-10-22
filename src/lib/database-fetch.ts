// Fresh deadlines are created for each database request. Never reuse an expired
// signal on a warm Worker, and never retry a write with an unknown outcome.
export function databaseFetch(input: RequestInfo | URL, init?: RequestInit, timeoutMs = 10000) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  return fetch(input, { ...init, cache: "no-store", signal });
}
