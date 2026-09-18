/** Keep Open and Run on the same artifact for this Go session. A channel
 * refresh may select a different snapshot on the next launch, not halfway
 * through editing an already opened showcase. Failed lookups remain retryable.
 */
export function createSessionSourceResolver(resolve: (url: string) => Promise<string>) {
  const selected = new Map<string, Promise<string>>();
  return (url: string): Promise<string> => {
    const existing = selected.get(url);
    if (existing) return existing;
    const pending = resolve(url).then(result => {
      selected.set(result, Promise.resolve(result));
      return result;
    }).catch(error => {
      selected.delete(url);
      throw error;
    });
    selected.set(url, pending);
    return pending;
  };
}
