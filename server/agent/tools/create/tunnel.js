import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb } from './state.js'

export const tunnelTools = {
  // ── Tunnel ───────────────────────────────────────────────────────────────────

  update_tunnel_settings: tool({
    description:
      'Save Cloudflare tunnel settings for an experiment. Set hostname to a custom domain (must be in Cloudflare DNS) or leave empty for a random *.trycloudflare.com URL. Set persistent to true to auto-start the tunnel on server boot.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      hostname: z.string().optional().describe('Custom domain (e.g. "experiment.mydomain.com") or empty string for quick tunnel'),
      persistent: z.boolean().optional().describe('Keep tunnel running automatically on server start'),
    }),
    execute: async ({ experimentID, hostname, persistent }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const norm = (hostname || '').replace(/^https?:\/\//, '').replace(/\/$/, '').trim()
      exp.tunnelSettings = {
        ...(exp.tunnelSettings || { hostname: '', persistent: false }),
        ...(hostname !== undefined && { hostname: norm }),
        ...(persistent !== undefined && { persistent: !!persistent }),
      }
      exp.updatedAt = new Date().toISOString()
      await db.write()
      return { success: true, tunnelSettings: exp.tunnelSettings }
    },
  }),

  create_tunnel: tool({
    description:
      'Start a Cloudflare tunnel to share the experiment publicly. If hostname is set in tunnel settings, uses that custom domain (must be in Cloudflare DNS). Otherwise creates a random *.trycloudflare.com URL. Only one tunnel can be active at a time.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const hostname = exp.tunnelSettings?.hostname || ''
      // Tunnel creation requires cloudflared binary + spawn — delegate to existing API
      const apiUrl = process.env.API_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${apiUrl}/api/create-tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experimentID, hostname }),
        })
        const data = await res.json()
        return data
      } catch (err) {
        return { success: false, error: `Tunnel error: ${err.message}. Ensure cloudflared is installed.` }
      }
    },
  }),

  close_tunnel: tool({
    description: 'Close the currently active Cloudflare tunnel.',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
    }),
    execute: async ({ experimentID }) => {
      const apiUrl = process.env.API_URL || 'http://localhost:3000'
      try {
        const res = await fetch(`${apiUrl}/api/close-tunnel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ experimentID }),
        })
        const data = await res.json()
        return data
      } catch (err) {
        return { success: false, error: err.message }
      }
    },
  }),
}
