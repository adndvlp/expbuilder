import fs from 'fs'
import path from 'path'
import { tool } from 'ai'
import { z } from 'zod'
import { db, readDb, userDataRoot } from './state.js'

export const fileTools = {
  // ── File Upload ─────────────────────────────────────────────────────────────

  upload_file: tool({
    description:
      'Upload a media file (image, audio, or video) to an experiment. ' +
      'The file is stored on disk in {experimentName}/{type}/ and served via URL like "img/filename.jpg". ' +
      'Use the returned url in trial columnMapping (source: "typed", value: "img/filename.jpg") for stimuli. ' +
      'Supports: .png, .jpg, .jpeg, .gif, .svg, .webp, .bmp (img), .mp3, .wav, .ogg, .m4a, .flac, .aac (aud), .mp4, .webm, .mov, .avi, .mkv (vid).',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      filename: z.string().describe('Desired filename, e.g. "cat.jpg" or "sound.mp3". Extension determines type.'),
      base64Content: z.string().describe('Base64-encoded file content (without data URI prefix)'),
    }),
    execute: async ({ experimentID, filename, base64Content }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const experimentName = exp.name || experimentID
      const ext = path.extname(filename).toLowerCase()
      let type
      if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(ext)) type = 'img'
      else if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) type = 'aud'
      else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(ext)) type = 'vid'
      else if (/\.(txt|csv|json|pdf|zip)$/i.test(ext)) type = 'others'
      else return { error: `Unsupported file type: ${ext}` }
      const targetDir = path.join(userDataRoot, experimentName, type)
      fs.mkdirSync(targetDir, { recursive: true })
      const filePath = path.join(targetDir, filename)
      fs.writeFileSync(filePath, Buffer.from(base64Content, 'base64'))
      const url = `${type}/${encodeURIComponent(filename)}`
      return { success: true, url, type, filename, sizeBytes: Buffer.byteLength(Buffer.from(base64Content, 'base64')) }
    },
  }),

  delete_file: tool({
    description:
      'Delete a previously uploaded file from an experiment. Provide the file URL as returned by upload_file (e.g. "img/cat.jpg").',
    parameters: z.object({
      experimentID: z.string().describe('Experiment UUID'),
      fileUrl: z.string().describe('File URL like "img/cat.jpg" or "aud/sound.mp3" as returned by upload_file or list_files'),
    }),
    execute: async ({ experimentID, fileUrl }) => {
      await readDb()
      const exp = db.data.experiments.find(e => e.experimentID === experimentID)
      if (!exp) return { error: `Experiment ${experimentID} not found` }
      const experimentName = exp.name || experimentID
      const parts = fileUrl.split('/')
      if (parts.length !== 2) return { error: `Invalid fileUrl format. Expected "type/filename", got "${fileUrl}"` }
      const [type, encodedFilename] = parts
      const filename = decodeURIComponent(encodedFilename)
      if (!['img', 'aud', 'vid', 'others'].includes(type)) return { error: `Invalid type: ${type}` }
      const filePath = path.join(userDataRoot, experimentName, type, filename)
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` }
      fs.unlinkSync(filePath)
      return { success: true, deleted: fileUrl }
    },
  }),
}
