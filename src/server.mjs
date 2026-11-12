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
    console.log(`Minecraft MCP — control your local Minecraft client over stdio

Usage: minecraft-mcp [--help]

MINECRAFT_MCP_TOKEN       Token from the Minecraft mod settings (F8)
MINECRAFT_MCP_PORT        Local mod port (default: 28473)
MINECRAFT_MCP_URL         Bridge base URL; overrides the local mod port

Recommended: run the agent, MCP server and Minecraft on the same computer.
execute({file: "build.js"}) resolves paths from the MCP working directory.
MINECRAFT_MCP_URL optionally connects to a remote game; script dependencies
and filesystem access still use the game computer.`);
  } else {
    await createMcpServer(readConfig()).connect(new StdioServerTransport());
  }
} catch (error) {
  console.error(`Minecraft MCP: ${error.message}`);
  process.exitCode = 1;
}
