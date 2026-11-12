function port(value, name) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1024 || Number(value) > 65535) {
    throw new Error(`${name} must be an integer from 1024 to 65535`);
  }
  return Number(value);
}

export function readConfig(env = process.env) {
  let url;
  if (env.MINECRAFT_MCP_URL !== undefined) {
    // Never echo a malformed URL: it may contain credentials.
    url = URL.canParse(env.MINECRAFT_MCP_URL) ? new URL(env.MINECRAFT_MCP_URL) : null;
    if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('MINECRAFT_MCP_URL must be an http(s) base URL without credentials, query or fragment');
    }
  } else {
    url = new URL(`http://127.0.0.1:${port(env.MINECRAFT_MCP_PORT ?? 28473, 'MINECRAFT_MCP_PORT')}/`);
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return {url, token:env.MINECRAFT_MCP_TOKEN};
}
