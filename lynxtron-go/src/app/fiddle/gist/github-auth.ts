export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

/**
 * Validate a Personal Access Token against api.github.com/user.
 * Returns the authenticated user on success, throws on any HTTP failure.
 */
export async function validateGitHubToken(token: string): Promise<GitHubUser> {
  const r = await fetch('https://api.github.com/user', {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `token ${token}`,
    },
  });
  if (!r.ok) {
    if (r.status === 401) throw new Error('Token rejected — check that it has the "gist" scope.');
    throw new Error(`GitHub /user HTTP ${r.status}`);
  }
  return await r.json() as GitHubUser;
}

/**
 * URL that opens GitHub's token-creation page pre-filled with the scopes we need.
 * The Sign-in flow opens this in the OS browser via the deep-link bridge, then
 * the user pastes the token back into Settings.
 */
export const TOKEN_CREATION_URL =
  'https://github.com/settings/tokens/new?scopes=gist&description=Lynxtron+Fiddle';
