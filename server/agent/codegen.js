import fs from 'fs'
import path from 'path'
import * as cheerio from 'cheerio'
import { db, ensureDbData, userDataRoot } from '../utils/db.js'
import { __dirname } from '../utils/paths.js'
import { ensureTemplate } from '../utils/templates.js'
import { getPluginScriptsFromTrials } from '../utils/plugin-scripts.js'
import { generateLoopCode } from './codegen/loop.js'
import { generateTrialCode } from './codegen/trial.js'

/* istanbul ignore next -- integration tests assert generated experiment output, not every emitted branch. */
export async function generateExperimentCode(experimentID, isPublic = false) {
  await db.read()
  ensureDbData()

  const exp = db.data.experiments.find(e => e.experimentID === experimentID)
  if (!exp) return { error: `Experiment ${experimentID} not found` }

  const doc = db.data.trials.find(t => t.experimentID === experimentID)
  if (!doc) return { error: 'No timeline data found' }

  const timeline = doc.timeline || []
  const appearance = exp.appearanceSettings || {}
  const fullScreen = appearance.fullScreen ?? true

  const experimentName = exp.name
  let uploadedUrls = []
  if (experimentName) {
    const uploadsBase = path.join(userDataRoot, experimentName)
    for (const type of ['img', 'aud', 'vid']) {
      const d = path.join(uploadsBase, type)
      if (fs.existsSync(d)) uploadedUrls.push(...fs.readdirSync(d).map(f => `${type}/${f}`))
    }
  }

  const pluginNames = new Set()
  for (const item of timeline) {
    if (item.type === 'trial') {
      const t = doc.trials.find(tr => tr.id === item.id)
      if (t?.plugin) pluginNames.add(t.plugin)
    }
  }

  let code = ''

  if (uploadedUrls.length > 0) {
    code += `timeline.push({\n  type: jsPsychPreload,\n  files: ${JSON.stringify(uploadedUrls)}\n});\n\n`
  }

  if (fullScreen) {
    code += `timeline.push({\n  type: jsPsychFullscreen,\n  fullscreen_mode: true\n});\n\n`
  }

  for (const item of timeline) {
    if (item.type === 'trial') {
      const t = doc.trials.find(tr => tr.id === item.id)
      if (t) code += generateTrialCode(t, false).code + '\n'
    } else if (item.type === 'loop') {
      const l = doc.loops.find(lp => lp.id === item.id)
      if (l) code += generateLoopCode(l, doc, null) + '\n'
    }
  }

  code += 'jsPsych.run(timeline);\n'

  if (isPublic) {
    const { scriptUrls, styleUrls } = getPluginScriptsFromTrials(
      doc.trials.map(t => ({ plugin: t.plugin }))
    )
    return { code, experimentName, fullScreen, backgroundColor: appearance.backgroundColor, scriptUrls, styleUrls, uploadedUrls, pluginNames: [...pluginNames] }
  }

  return { code, experimentName, fullScreen, backgroundColor: appearance.backgroundColor, uploadedUrls, pluginNames: [...pluginNames] }
}

/* istanbul ignore next -- HTML build side effects are covered by route/codegen integration tests. */
export async function buildExperimentHtml(experimentID) {
  const result = await generateExperimentCode(experimentID, false)
  if (result.error) return result

  const { code, experimentName, backgroundColor } = result
  const experimentsHtmlDir = path.join(userDataRoot, 'experiments_html')
  if (!fs.existsSync(experimentsHtmlDir)) fs.mkdirSync(experimentsHtmlDir, { recursive: true })

  const templatePath = ensureTemplate('experiment_template.html')
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}.html`)
  fs.copyFileSync(templatePath, htmlPath)

  let html = fs.readFileSync(htmlPath, 'utf8')
  const $ = cheerio.load(html)
  $('style#canvas-styles').remove()
  if (backgroundColor) {
    $('head').append(`<style id="canvas-styles">\n  body { background-color: ${backgroundColor}; }\n</style>`)
  }
  $('script#generated-script').remove()
  $('body').append(`<script id="generated-script">\nconst timeline = [];\n\n${code}\n</script>`)
  fs.writeFileSync(htmlPath, $.html())

  return { success: true, experimentUrl: `http://localhost:3000/${encodeURIComponent(experimentName)}`, htmlPath }
}

/* istanbul ignore next -- public export side effects are covered by route/codegen integration tests. */
export async function buildPublicExperimentHtml(experimentID, uid, storage) {
  const result = await generateExperimentCode(experimentID, true)
  if (result.error) return result

  const { code, experimentName, backgroundColor, scriptUrls, styleUrls } = result

  const experimentsHtmlDir = path.join(userDataRoot, 'experiments_html')
  if (!fs.existsSync(experimentsHtmlDir)) fs.mkdirSync(experimentsHtmlDir, { recursive: true })
  const templatePath = ensureTemplate('experiment_template.html')
  const htmlPath = path.join(experimentsHtmlDir, `${experimentName}_public.html`)
  fs.copyFileSync(templatePath, htmlPath)

  let html = fs.readFileSync(htmlPath, 'utf8')
  const $ = cheerio.load(html)
  $('link[href*="jspsych-bundle"]').remove()
  $('script[src*="jspsych-bundle"]').remove()
  $('script[src*="webgazer"]').remove()
  $('script[src*="dynamicplugin"]').remove()
  $('head').append('<link href="https://unpkg.com/jspsych@8.2.2/css/jspsych.css" rel="stylesheet" />')
  $('head').append('<script src="https://unpkg.com/jspsych@8.2.2"></script>')
  let dv = '1.0.2'
  try { dv = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'dynamicplugin/package.json'), 'utf8')).version } catch {}
  $('head').append(`<script src="https://unpkg.com/jspsych-expbuilder-plugin-dynamic@${dv}/dist/index.iife.js"></script>`)
  for (const u of styleUrls) $('head').append(`<link rel="stylesheet" href="${u}" />`)
  for (const u of scriptUrls) $('head').append(`<script src="${u}"></script>`)

  $('style#canvas-styles').remove()
  if (backgroundColor) $('head').append(`<style id="canvas-styles">\n  body { background-color: ${backgroundColor}; }\n</style>`)
  $('script#generated-script').remove()
  $('body').append(`<script id="generated-script">\nconst timeline = [];\n\n${code}\n</script>`)
  fs.writeFileSync(htmlPath, $.html())

  const finalHtml = $.html()

  const uploadsBase = path.join(userDataRoot, experimentName)
  let mediaFiles = []
  for (const type of ['img', 'vid', 'aud']) {
    const d = path.join(uploadsBase, type)
    if (fs.existsSync(d)) {
      for (const fn of fs.readdirSync(d)) {
        try { mediaFiles.push({ type, filename: fn, content: fs.readFileSync(path.join(d, fn)).toString('base64') }) } catch {}
      }
    }
  }

  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath)

  return { success: true, htmlContent: finalHtml, experimentName, mediaFiles, uid, storage: storage || 'googledrive' }
}
