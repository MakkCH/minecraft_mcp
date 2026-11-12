#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcp.mjs';
import { readConfig } from './config.mjs';

try {
  const {values} = parseArgs({options:{
    help:{type:'boolean', short:'h'}
  }});
  if (values.help) {
    console.log(`Minecraft MCP — local stdio server for a local or remote game bridge

Usage: minecraft-mcp [--help]

MINECRAFT_MCP_TOKEN       Token from the Minecraft mod settings (F8)
MINECRAFT_MCP_PORT        Local mod port (default: 28473)
MINECRAFT_MCP_URL         Bridge base URL; overrides the local mod port

Run this process alongside your agent. execute(file=...) reads files here
and sends their contents to the game bridge. Enable Allow remote in F8
for direct network access, or use a tunnel to the default loopback listener.`);
  } else {
    await createMcpServer(readConfig()).connect(new StdioServerTransport());
  }
} catch (error) {
  console.error(`Minecraft MCP: ${error.message}`);
  process.exitCode = 1;
}
