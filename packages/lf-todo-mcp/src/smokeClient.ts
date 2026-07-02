import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'url'

async function main(): Promise<void> {
  const serverPath = fileURLToPath(new URL('./server.js', import.meta.url))
  const client = new Client({
    name: 'lf-todo-smoke-client',
    version: '1.0.0'
  })
  const transport = new StdioClientTransport({
    command: 'node',
    args: [serverPath],
    stderr: 'pipe'
  })

  await client.connect(transport)
  const tools = await client.listTools()
  const context = await client.callTool({ name: 'get_lf_todo_context', arguments: {} })
  const categories = await client.callTool({ name: 'list_categories', arguments: {} })

  console.log(
    JSON.stringify(
      {
        toolNames: tools.tools.map((tool) => tool.name),
        context: context.structuredContent,
        categories: categories.structuredContent
      },
      null,
      2
    )
  )

  await client.close()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
})
