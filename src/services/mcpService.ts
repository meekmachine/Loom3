/**
 * MCP (Model Context Protocol) Service
 * Client-side implementation for calling MCP tools on the backend
 */

export interface MCPTool {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

export interface MCPToolCall {
  tool: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  result: any;
  error?: string;
}

export class MCPService {
  private baseUrl: string;
  private tools: MCPTool[] = [];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * List available MCP tools
   */
  async listTools(): Promise<MCPTool[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/tools`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to list MCP tools: ${response.statusText}`);
      }

      this.tools = await response.json();
      return this.tools;
    } catch (error) {
      console.error('[MCPService] Error listing tools:', error);
      throw error;
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tool: toolName,
          arguments: args,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to call MCP tool: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[MCPService] Error calling tool:', error);
      throw error;
    }
  }

  /**
   * Get cached tools
   */
  getCachedTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Check if a tool is available
   */
  hasTool(toolName: string): boolean {
    return this.tools.some((tool) => tool.name === toolName);
  }
}

/**
 * Factory function to create MCP service
 */
export function createMCPService(baseUrl: string): MCPService {
  return new MCPService(baseUrl);
}
