export function readConfig(env = process.env) {
  const address = env.MINECRAFT_MCP_URL ?? 'http://127.0.0.1:28473/';
  // Never echo a malformed URL: it may contain credentials.
  const url = URL.canParse(address) ? new URL(address) : null;
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('MINECRAFT_MCP_URL must be an http(s) base URL without credentials, query or fragment');
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return {url, token:env.MINECRAFT_MCP_TOKEN};
}
