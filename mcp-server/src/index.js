#!/usr/bin/env node
/**
 * index.js — Outlook MCP Server entry point.
 *
 * A minimal MCP server (stdio transport) exposing two tools:
 *
 *   outlook_auth  — Check auth status, trigger login/reauth guidance
 *   outlook_api   — Proxy authenticated requests to Microsoft Graph API
 *
 * Designed to run on the Windows host machine where it can reach
 * graph.microsoft.com directly, bypassing the Cowork VM's network sandbox.
 *
 * Usage:
 *   node mcp-server/src/index.js
 *
 * Declared in .mcp.json as an stdio MCP server so Cowork launches it
 * automatically on the host when the plugin is installed.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { getToken, getSessionInfo, AuthRequiredError } from "./auth.js";
import { makeRequest } from "./graph.js";

// ── Server setup ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name:    "outlook",
  version: "1.0.0",
});

// ── Tool: outlook_auth ───────────────────────────────────────────────────────
//
// Lightweight auth management tool (~80 tokens context overhead).
// Actions:
//   "status" — check token health, session age, scopes
//   "login"  — guide user through initial auth setup
//   "reauth" — guide user to re-authenticate (expired session or revoked tokens)

server.tool(
  "outlook_auth",
  "Check Microsoft 365 authentication status or get login/reauth instructions",
  {
    action: z.enum(["status", "login", "reauth"])
      .describe("Action: 'status' to check, 'login' for first-time setup, 'reauth' to re-authenticate"),
  },
  async ({ action }) => {
    switch (action) {
      case "status": {
        const info = await getSessionInfo();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      }

      case "login": {
        // Attempt to get a token — if it works, we're already authenticated
        try {
          await getToken();
          const info = await getSessionInfo();
          return {
            content: [
              {
                type: "text",
                text: `Already authenticated as ${info.user_email} (${info.days_remaining} days remaining).\n` +
                      "No action needed.",
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: "text",
                text: "Not authenticated. To set up Microsoft 365 access:\n\n" +
                      "1. Open PowerShell on your Windows machine\n" +
                      "2. Navigate to the outlook-skills plugin directory\n" +
                      "3. Run: .\\outlook-skills\\auth.ps1\n" +
                      "4. Follow the browser-based sign-in flow\n" +
                      "5. Once complete, try outlook_auth with action 'status' to verify",
              },
            ],
          };
        }
      }

      case "reauth": {
        return {
          content: [
            {
              type: "text",
              text: "To re-authenticate your Microsoft 365 session:\n\n" +
                    "1. Open PowerShell on your Windows machine\n" +
                    "2. Navigate to the outlook-skills plugin directory\n" +
                    "3. Run: .\\outlook-skills\\auth.ps1 --reauth\n" +
                    "4. Follow the browser-based sign-in flow\n" +
                    "5. Once complete, try outlook_auth with action 'status' to verify",
            },
          ],
        };
      }
    }
  }
);

// ── Tool: outlook_api ────────────────────────────────────────────────────────
//
// Generic Graph API proxy (~120 tokens context overhead).
// Claude reads a skill's SKILL.md to learn which endpoint to call,
// then uses this tool to execute the request.

server.tool(
  "outlook_api",
  "Execute an authenticated Microsoft Graph API request (email, calendar, contacts)",
  {
    method: z.enum(["GET", "POST", "PATCH", "DELETE", "PUT"])
      .describe("HTTP method"),
    endpoint: z.string()
      .describe("Graph API endpoint, e.g. /me/messages or /me/calendarView?startDateTime=..."),
    body: z.string().optional()
      .describe("JSON request body (for POST/PATCH/PUT)"),
    headers: z.record(z.string()).optional()
      .describe("Additional HTTP headers as key-value pairs"),
  },
  async ({ method, endpoint, body, headers }) => {
    const result = await makeRequest(method, endpoint, body || null, headers || {});

    // Return as structured content for the LLM
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }
);

// ── Start server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running — stdio keeps it alive until the parent process closes
}

main().catch((err) => {
  console.error("MCP server failed to start:", err);
  process.exit(1);
});
