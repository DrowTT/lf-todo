#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  applyTaskOperations,
  closeTodoToolContext,
  createBackup,
  createTodoToolContext,
  describeContext,
  listCategories,
  listTasks,
  searchTasks
} from './lfTodoTools.js'

const taskPrioritySchema = z.enum(['low', 'medium', 'high'])
const duePrecisionSchema = z.enum(['date', 'datetime'])

const taskUpdateSchema = z
  .object({
    content: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().min(1).max(500).nullable().optional(),
    is_completed: z.boolean().optional(),
    order_index: z.number().int().min(0).optional(),
    due_at: z.number().int().min(0).nullable().optional(),
    due_precision: duePrecisionSchema.nullable().optional(),
    priority: taskPrioritySchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, '至少需要提供一个待更新字段')

const batchOperationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('create_category'),
    name: z.string().trim().min(1).max(64)
  }),
  z.object({
    type: z.literal('rename_category'),
    id: z.number().int().min(1),
    name: z.string().trim().min(1).max(64)
  }),
  z.object({
    type: z.literal('create_task'),
    content: z.string().trim().min(1).max(100),
    categoryId: z.number().int().min(1).optional(),
    categoryName: z.string().trim().min(1).max(64).optional(),
    priority: taskPrioritySchema.optional(),
    due_at: z.number().int().min(0).nullable().optional(),
    due_precision: duePrecisionSchema.nullable().optional()
  }),
  z.object({
    type: z.literal('update_task'),
    id: z.number().int().min(1),
    updates: taskUpdateSchema
  }),
  z.object({
    type: z.literal('complete_task'),
    id: z.number().int().min(1),
    completed: z.boolean().optional()
  }),
  z.object({
    type: z.literal('move_task'),
    id: z.number().int().min(1),
    targetCategoryId: z.number().int().min(1).optional(),
    targetCategoryName: z.string().trim().min(1).max(64).optional(),
    createCategoryIfMissing: z.boolean().optional()
  }),
  z.object({
    type: z.literal('archive_task'),
    id: z.number().int().min(1)
  }),
  z.object({
    type: z.literal('archive_completed'),
    categoryId: z.number().int().min(1).optional(),
    categoryName: z.string().trim().min(1).max(64).optional()
  })
])

type JsonObject = Record<string, unknown>

function asJsonText(value: JsonObject): {
  content: Array<{ type: 'text'; text: string }>
  structuredContent: JsonObject
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    structuredContent: value
  }
}

async function main(): Promise<void> {
  const context = createTodoToolContext()
  const server = new McpServer({
    name: 'lf-todo',
    version: '1.0.0'
  })

  server.registerTool(
    'get_lf_todo_context',
    {
      title: '读取 LF-Todo 连接信息',
      description: '返回当前 MCP 连接的 App 桥接信息和数据概览。'
    },
    async () => asJsonText(await describeContext(context))
  )

  server.registerTool(
    'list_categories',
    {
      title: '读取分类',
      description: '列出 LF-Todo 的全部分类。'
    },
    async () => asJsonText({ categories: await listCategories(context) })
  )

  server.registerTool(
    'list_tasks',
    {
      title: '读取待办',
      description: '按分类、完成状态、优先级、截止时间筛选根待办，可选返回子待办。',
      inputSchema: {
        categoryId: z.number().int().min(1).nullable().optional(),
        categoryName: z.string().trim().min(1).max(64).nullable().optional(),
        includeCompleted: z.boolean().optional(),
        onlyCompleted: z.boolean().optional(),
        priority: taskPrioritySchema.nullable().optional(),
        dueBefore: z.number().int().min(0).nullable().optional(),
        dueAfter: z.number().int().min(0).nullable().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        includeSubtasks: z.boolean().optional()
      }
    },
    async (input) => asJsonText({ tasks: await listTasks(context, input) })
  )

  server.registerTool(
    'search_tasks',
    {
      title: '搜索待办',
      description: '搜索待办内容、描述和子待办内容。',
      inputSchema: {
        query: z.string().trim().min(1).max(100),
        categoryId: z.number().int().min(1).nullable().optional(),
        categoryName: z.string().trim().min(1).max(64).nullable().optional(),
        limit: z.number().int().min(1).max(50).optional()
      }
    },
    async (input) => asJsonText({ tasks: await searchTasks(context, input) })
  )

  server.registerTool(
    'create_backup',
    {
      title: '创建备份',
      description: '通过正在运行的 LF-Todo App 创建 SQLite 数据库副本和 JSON 数据备份。'
    },
    async () => asJsonText({ backup: await createBackup(context) })
  )

  server.registerTool(
    'apply_task_operations',
    {
      title: '批量整理待办',
      description:
        '批量创建分类、创建待办、更新待办、完成待办、移动分类和归档。默认 dryRun=true 只返回计划；需要真实写入时显式传 dryRun=false。',
      inputSchema: {
        dryRun: z.boolean().optional(),
        createBackup: z.boolean().optional(),
        operations: z.array(batchOperationSchema).min(1).max(100)
      }
    },
    async (input) => asJsonText({ result: await applyTaskOperations(context, input) })
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)

  process.on('SIGINT', () => {
    closeTodoToolContext(context)
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    closeTodoToolContext(context)
    process.exit(0)
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error))
  closeTodoToolContext()
  process.exit(1)
})
