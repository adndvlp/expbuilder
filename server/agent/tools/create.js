import { trialTools } from './create/trials.js'
import { loopCreateTools } from './create/loop-create.js'
import { loopUpdateTools } from './create/loop-update.js'
import { loopDeleteTools } from './create/loop-delete.js'
import { timelineTools } from './create/timeline.js'
import { experimentTools } from './create/experiments.js'
import { fileTools } from './create/files.js'
import { pluginTools } from './create/plugins.js'
import { tunnelTools } from './create/tunnel.js'
import { buildTools } from './create/build.js'

export const createTrialTools = {
  ...trialTools,
  ...loopCreateTools,
  ...loopUpdateTools,
  ...loopDeleteTools,
  ...timelineTools,
  ...experimentTools,
  ...fileTools,
  ...pluginTools,
  ...tunnelTools,
  ...buildTools,
}
