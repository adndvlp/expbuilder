import fs from 'fs'
import path from 'path'
import { tool } from 'ai'
import { z } from 'zod'
import { __dirname } from '../../../utils/paths.js'
import { db, ensureDbData, readDb, userDataRoot } from './state.js'

export const pluginTools = {
  // ── Custom Plugin ────────────────────────────────────────────────────────────

  create_custom_plugin: tool({
    description: '',
    parameters: z.object({
      index: z.number().int().min(0).describe('Plugin slot index (0+)'),
      name: z.string().min(1, 'name is required').describe('Plugin name'),
      pluginCode: z.string().min(1).describe('Plugin JS source code'),
    }),
    execute: async ({ index, name, pluginCode }) => {
      await readDb()
      const trimmed = (name ?? '').trim()
      if (!trimmed || /^undefined$/i.test(trimmed) || /^null$/i.test(trimmed)) {
        return { error: 'Plugin name required. Cannot be empty, "undefined", or "null".' }
      }
      ensureDbData()

      const scripTag = `/plugins/${name}.js`

      let pluginConfig = db.data.pluginConfigs[0]
      if (!pluginConfig) {
        pluginConfig = { plugins: [], config: {} }
        db.data.pluginConfigs.push(pluginConfig)
      }

      const existingIdx = pluginConfig.plugins.findIndex(p => p.index === index)

      // Clean up old files if overwriting
      if (existingIdx >= 0) {
        const old = pluginConfig.plugins[existingIdx]
        if (old.scripTag && old.name !== name) {
          const oldFile = path.join(userDataRoot, 'plugins', path.basename(old.scripTag))
          if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
          const oldMeta = path.join(__dirname, 'metadata', `${old.name}.json`)
          if (fs.existsSync(oldMeta)) fs.unlinkSync(oldMeta)
        }
      }

      const plugin = { name, scripTag, pluginCode, index }

      if (existingIdx >= 0) {
        pluginConfig.plugins[existingIdx] = plugin
      } else {
        pluginConfig.plugins.push(plugin)
      }

      // Write plugin file to disk
      const pluginsDir = path.join(userDataRoot, 'plugins')
      fs.mkdirSync(pluginsDir, { recursive: true })
      const filePath = path.join(pluginsDir, `${name}.js`)
      fs.writeFileSync(filePath, pluginCode, 'utf8')

      await db.write()

      return { success: true, plugin: { name, index, scripTag } }
    },
  }),

  delete_custom_plugin: tool({
    description:
      'Delete a custom plugin by its index. Removes the plugin file from disk and its metadata. This is irreversible.',
    parameters: z.object({
      index: z.number().int().min(0).describe('Plugin slot index to delete'),
    }),
    execute: async ({ index }) => {
      await readDb()
      const pluginConfig = db.data.pluginConfigs[0]
      if (!pluginConfig) return { error: 'No custom plugins configured' }

      const plugin = pluginConfig.plugins.find(p => p.index === index)
      if (!plugin) return { error: `Plugin at index ${index} not found` }

      // Remove from DB
      pluginConfig.plugins = pluginConfig.plugins.filter(p => p.index !== index)

      // Remove plugin file
      if (plugin.scripTag) {
        const filePath = path.join(userDataRoot, 'plugins', path.basename(plugin.scripTag))
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      }

      // Remove metadata
      if (plugin.name) {
        const metaPath = path.join(__dirname, 'metadata', `${plugin.name}.json`)
        if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath)
      }

      await db.write()
      return { success: true, deleted: plugin.name }
    },
  }),
}
