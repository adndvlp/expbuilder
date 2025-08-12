/**
 * jsPsych Plugin: Probabilistic Selection Task – v2.7.0
 * ------------------------------------------------------
 * This plugin implements a probabilistic selection task where participants choose
 * between two stimuli and receive feedback that may be probabilistic.
 * Feedback can be textual, visual (image), or auditory. The plugin is fully responsive
 * and allows for high visual and functional customization.
 *  
 * Key features include:
 * - Responsive design using vh/vw units
 * - Centralized feedback display
 * - Unified feedback handling (positive/negative/warning)
 * - Reward probability manipulation
 * - Multiple feedback modes (text, image, audio)
 * - Score tracking and display
 * 
 * The task follows this trial structure:
 * 1. Fixation cross (random duration)
 * 2. Stimulus presentation (two images)
 * 3. Selection feedback (highlight chosen option)
 * 4. Outcome feedback (reward/punishment)
 *
 * MAIN PARAMETERS:
 * ------------------------
 * Stimuli:
 * - img_left, img_right: image paths for left/right options.
 * - correct_key: key representing the correct response ("left" or "right").
 * - pair: label to identify unique pairs (useful in learning/test phases).
 * - reward_prob: reinforcement probability for correct responses.
 *
 * Reinforcement configuration:
 * - pool_size: size of the random reinforcement sample (default: 10).
 * - probabilistic: if true, uses probabilistic reinforcement; if false, deterministic.
 * - symmetrical_feedback: if true, inverts reinforcement for incorrect responses.
 * - show_feedback: shows feedback if true.
 * - omit_is_error: if true, omissions are not considered errors.
 *
 * Timing (in ms):
 * - fixation_min, fixation_max: random interval for fixation cross.
 * - stimulus_duration: maximum time to respond to the stimulus.
 * - selection_duration: highlight duration after responding.
 * - feedback_duration: feedback display duration.
 *
 * Central feedback:
 * - pos_feedback, neg_feedback, warning_feedback: functions or strings for positive, negative, or omission feedback.
 * - feedback_mode: 'text', 'image' or 'audio'.
 * - feedback_color_pos/neg/warn: colors for textual feedback.
 * - feedback_size: size of central feedback ("auto" or px/vh).
 *
 * Top counters:
 * - show_remain, show_total_score: shows remaining trials or total score.
 * - info_color, info_font_size, info_position_top/side: visual customization.
 *
 * Visual:
 * - border_color_selected: border color when selected.
 * - fixation_color: fixation point color.
 *
 * Input:
 * - choices: valid response keys (e.g., ["ArrowLeft", "ArrowRight"]).
 * - total_trials: total number of trials (for counter).
 *
 * TRIAL OUTPUT:
 * ------------------
 * Response data:
 * - key_press: pressed key
 * - side_press: "left" or "right" based on key
 * - rt: reaction time
 * - correct: whether response was correct
 * - rewarded: whether reinforcement was received
 * - trial_score: current trial score
 * - total_score: cumulative score
 *
 * Included parameters:
 * - img_left, img_right, correct_key, reward_prob, pair, pool_size, probabilistic...
 * - All relevant configuration parameters are saved per trial.
 */

var jsPsychProbabilisticSelectionTask = (function(jspsych) {
  "use strict";

  // Plugin information and parameter definitions
  const info = {
    name: "probabilistic-selection-task",
    version: "2.7.0",
    parameters: {
      // Stimulus parameters
      img_left:              { type: jspsych.ParameterType.IMAGE,    default: undefined },  // Left option image
      img_right:             { type: jspsych.ParameterType.IMAGE,    default: undefined },  // Right option image
      correct_key:           { type: jspsych.ParameterType.STRING,   default: "right" },   // Which side is "correct" ("left"/"right")
      pair:                  { type: jspsych.ParameterType.STRING,   default: "default" }, // Identifier for stimulus pair
      reward_prob:           { type: jspsych.ParameterType.FLOAT,    default: 1.0 },      // Reward probability for correct choice (0.0-1.0)
      
      // Task configuration
      pool_size:             { type: jspsych.ParameterType.INT,      default: null },      // Size of reward probability pool
      probabilistic:         { type: jspsych.ParameterType.BOOL,     default: true },      // Whether to use probabilistic rewards
      symmetrical_feedback:  { type: jspsych.ParameterType.BOOL,     default: false },     // Whether incorrect choices can be rewarded
      show_feedback:         { type: jspsych.ParameterType.BOOL,     default: true },      // Whether to show feedback
      omit_is_error:         { type: jspsych.ParameterType.BOOL,     default: true },      // Whether no response counts as error
      
      // Timing parameters
      fixation_min:          { type: jspsych.ParameterType.INT,      default: 300 },       // Min fixation duration (ms)
      fixation_max:          { type: jspsych.ParameterType.INT,      default: 800 },       // Max fixation duration (ms)
      fixation_color:        { type: jspsych.ParameterType.STRING,   default: "#fff" },    // Fixation cross color
      stimulus_duration:     { type: jspsych.ParameterType.INT,      default: 3500 },      // Max time to respond (ms)
      selection_duration:    { type: jspsych.ParameterType.INT,      default: 500 },       // Duration of selection highlight (ms)
      feedback_duration:     { type: jspsych.ParameterType.INT,      default: 1500 },      // Feedback display duration (ms)
      
      // Feedback content
      pos_feedback:          { type: jspsych.ParameterType.FUNCTION, default: resp => "+10" },  // Positive feedback generator
      neg_feedback:          { type: jspsych.ParameterType.FUNCTION, default: resp => "-10" }, // Negative feedback generator
      warning_feedback:      { type: jspsych.ParameterType.FUNCTION, default: resp => "Responde más rápido." }, // No-response feedback
      
      // Feedback styling
      feedback_color_pos:    { type: jspsych.ParameterType.STRING,   default: "#00AA00" }, // Color for positive feedback
      feedback_color_neg:    { type: jspsych.ParameterType.STRING,   default: "#AA0000" }, // Color for negative feedback
      feedback_color_warn:   { type: jspsych.ParameterType.STRING,   default: "#FFFFFF" }, // Color for warning feedback
      
      // Display options
      show_remain:           { type: jspsych.ParameterType.BOOL,     default: true },      // Show remaining trials counter
      show_total_score:      { type: jspsych.ParameterType.BOOL,     default: true },      // Show cumulative score
      border_color_selected: { type: jspsych.ParameterType.STRING,   default: "#2196F3" }, // Border color for selected option
      info_color:            { type: jspsych.ParameterType.STRING,   default: "#fff" },    // Color for info text
      feedback_mode:         { type: jspsych.ParameterType.STRING,   default: "text" },    // Feedback type ("text"/"image"/"audio")
      feedback_size:         { type: jspsych.ParameterType.STRING,   default: "auto" },    // Feedback display size
      
      // Layout parameters
      info_font_size:        { type: jspsych.ParameterType.STRING,   default: "2.5vh" },   // Font size for info text
      info_position_top:     { type: jspsych.ParameterType.STRING,   default: "5vh" },     // Top position for info text
      info_position_side:    { type: jspsych.ParameterType.STRING,   default: "5vw" },     // Side position for info text
      
      // Response options
      choices:               { type: jspsych.ParameterType.KEYS,     default: ["ArrowLeft","ArrowRight"] }, // Valid response keys
      total_trials:          { type: jspsych.ParameterType.INT,      default: null }       // Total number of trials
    },
    
    // Data collected on each trial
    data: {
      key_press:   { type: jspsych.ParameterType.STRING },  // Key pressed
      side_press:  { type: jspsych.ParameterType.STRING },  // Side chosen ("left"/"right")
      rt:          { type: jspsych.ParameterType.FLOAT  },  // Response time (ms)
      correct:     { type: jspsych.ParameterType.BOOL   },  // Whether correct choice was made
      rewarded:    { type: jspsych.ParameterType.BOOL   },  // Whether trial was rewarded
      trial_score: { type: jspsych.ParameterType.INT    },  // Points earned this trial
      total_score: { type: jspsych.ParameterType.INT    }   // Cumulative points
    }
  };

  // Reward probability pools management
  const rewardPools = {};  // Stores reward pools for each stimulus pair
  const poolPtr = {};      // Current position in each reward pool

  /**
   * Maps keyboard input to side selection
   * @param {string} key - The pressed key
   * @returns {string|null} "left", "right", or null if invalid
   */
  const keyToSide = key => {
    if (!key) return null;
    const k = key.toLowerCase();
    if (k.includes("left")) return "left";
    if (k.includes("right")) return "right";
    if (["a","q","4"].includes(k)) return "left";  // Common left-hand keys
    if (["l","p","6"].includes(k)) return "right"; // Common right-hand keys
    return null;
  };

  /**
   * Creates a reward probability pool
   * @param {number} prob - Reward probability (0.0-1.0)
   * @param {number} size - Pool size
   * @returns {boolean[]} Shuffled array of rewards (true) and punishments (false)
   */
  const makePool = (prob, size) => {
    const wins = Math.round(prob * size);
    const losses = size - wins;
    const arr = Array(wins).fill(true).concat(Array(losses).fill(false));
    return jspsych.randomization?.shuffle ? jspsych.randomization.shuffle(arr)
      : arr.sort(() => Math.random() - 0.5);  // Fallback shuffle
  };

  /**
   * Main plugin class implementing the probabilistic selection task
   */
  class ProbSelTaskPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    /**
     * Runs a single trial of the task
     * @param {HTMLElement} display_element - Where to render the trial
     * @param {object} trial - Trial parameters
     */
    trial(display_element, trial) {
      const jsPsych = this.jsPsych;
      
      // Trial response data
      let resp = { 
        key: null,         // Pressed key
        side: null,        // Selected side
        rt: null,          // Response time
        correct: false,    // Whether correct choice was made
        rewarded: false,   // Whether trial was rewarded
        trial_score: 0,    // Points this trial (+10/-10)
        total_score: 0     // Cumulative points
      };
      
      let kb = null;       // Keyboard listener reference
      let timer = null;    // Timeout reference
      let finished = false; // Whether trial is complete

      // Helper function to cancel keyboard response
      const cancelResp = () => {
        if (kb) {
          jsPsych.pluginAPI.cancelKeyboardResponse(kb);
          kb = null;
        }
      };

      /**
       * Gets the next outcome from the reward pool for current stimulus pair
       * @returns {boolean} true for reward, false for punishment
       */
      const poolOutcome = () => {
        const pr = trial.pair || "default";
        // Create new pool if none exists or current pool is exhausted
        if (!rewardPools[pr] || poolPtr[pr] >= rewardPools[pr].length) {
          rewardPools[pr] = makePool(trial.reward_prob, trial.pool_size || 10);
          poolPtr[pr] = 0;
        }
        return rewardPools[pr][poolPtr[pr]++];
      };

      /**
       * Shows fixation cross with random duration
       */
      const showFix = () => {
        const randInt = jspsych.randomization?.randomInt
          || ((min,max) => Math.floor(Math.random()*(max-min+1))+min); // Fallback random
        const dur = randInt(trial.fixation_min, trial.fixation_max);
        
        display_element.innerHTML = `
          <div style='font-size:20vh; display:flex;justify-content:center;align-items:center;
                     width:100vw;height:100vh; color:${trial.fixation_color};'>
            +
          </div>`;
        
        jsPsych.pluginAPI.setTimeout(showStim, dur);
      };

      /**
       * Shows the stimulus (two images) and sets up response collection
       */
      const showStim = () => {
        display_element.innerHTML = `
          <div style='display:flex;justify-content:center;align-items:center;
                     width:100vw;height:100vh;column-gap:10vw;'>
            <img id='pst-left'  src='${trial.img_left}'  
                 style='max-height:50vh; margin-right:5vw;' />
            <img id='pst-right' src='${trial.img_right}' 
                 style='max-height:50vh; margin-left:5vw;' />
          </div>`;
        
        // Set up keyboard response
        kb = jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: onResp,
          valid_responses: trial.choices,
          rt_method: "performance",  // High-precision timing
          persist: false,
          allow_held_key: false
        });
        
        // Set timeout for no response
        timer = setTimeout(() => { 
          if (!finished) { 
            cancelResp(); 
            endStim(null,null);
          } 
        }, trial.stimulus_duration);
      };

      /**
       * Handles keyboard response
       * @param {object} info - Response info (key and RT)
       */
      const onResp = info => {
        if (finished) return;
        clearTimeout(timer);
        cancelResp();
        endStim(info.key, info.rt);
      };

      /**
       * Processes the response and determines outcome
       * @param {string} key - Pressed key
       * @param {number} rt - Response time
       */
      const endStim = (key, rt) => {
        resp.key = key;
        resp.side = keyToSide(key);
        resp.rt = rt;
        resp.correct = resp.side === trial.correct_key;

        // Determine reward based on task parameters
        if (resp.key === null && !trial.omit_is_error) {
          // No response and omissions not counted as errors
          resp.rewarded = false;
        } else if (!trial.probabilistic) {
          // Deterministic reward (correct = reward)
          resp.rewarded = resp.correct;
        } else {
          // Probabilistic reward
          const oc = poolOutcome();
          resp.rewarded = trial.symmetrical_feedback 
            ? (resp.correct ? oc : !oc)  // Incorrect choices can be rewarded
            : (resp.correct ? oc : false); // Only correct choices can be rewarded
        }

        // Calculate scores
        resp.trial_score = resp.rewarded ? 10 : -10;
        const prev = jsPsych.data.get().filter({trial_type:info.name}).select("trial_score").sum();
        resp.total_score = prev + resp.trial_score;
        
        highlightChoice();
      };

      /**
       * Highlights the selected option
       */
      const highlightChoice = () => {
        if (resp.side) {
          const img = document.getElementById(`pst-${resp.side}`);
          if (img) img.style.border = `0.5vh solid ${trial.border_color_selected}`;
        }
        jsPsych.pluginAPI.setTimeout(
          trial.show_feedback ? showFeedback : endTrial,
          trial.selection_duration
        );
      };

      /**
       * Shows feedback based on response
       */
      const showFeedback = () => {
        let centralHtml = "";
        const autoSize = resp.key === null ? '6vh' : '10vh';
        
        // Handle different feedback modes
        if (trial.feedback_mode === 'image') {
          // Image feedback mode
          let sizePx = trial.feedback_size === 'auto' ? autoSize
            : typeof trial.feedback_size === 'number' ? trial.feedback_size+'px'
            : trial.feedback_size;
          const src = resp.key === null ? trial.warning_feedback
            : (resp.rewarded ? trial.pos_feedback : trial.neg_feedback);
          centralHtml = `<img src='${src}' style='height:${sizePx}; max-width:80vw; max-height:80vh; object-fit:contain;'/>`;
        } 
        else if (trial.feedback_mode === 'audio') {
          // Audio feedback mode
          const aud = resp.key === null ? trial.warning_feedback
            : (resp.rewarded ? trial.pos_feedback : trial.neg_feedback);
          if (aud) new Audio(aud).play();
        } 
        else {
          // Default text feedback mode
          let txt;
          if (typeof trial.pos_feedback === 'function' && resp.rewarded) 
            txt = trial.pos_feedback(resp);
          else if (typeof trial.neg_feedback === 'function' && !resp.rewarded && resp.key !== null) 
            txt = trial.neg_feedback(resp);
          else if (typeof trial.warning_feedback === 'function' && resp.key === null) 
            txt = trial.warning_feedback(resp);
          else 
            txt = resp.key === null ? trial.warning_feedback 
                  : (resp.rewarded ? trial.pos_feedback : trial.neg_feedback);
          
          const color = resp.key === null ?
            trial.feedback_color_warn :
            resp.rewarded ? trial.feedback_color_pos : trial.feedback_color_neg;
          const fontSize = trial.feedback_size === 'auto' ? autoSize : trial.feedback_size;
          
          centralHtml = `
            <div style='font-size:${fontSize};font-weight:700;color:${color};
                        text-align:center;white-space:pre-line;'>
              ${txt}
            </div>`;
        }

        // Build feedback display HTML
        let html = `
          <div style='position:absolute;top:0;left:0;width:100vw;height:100vh;
                      display:flex;justify-content:center;align-items:center;'>
            ${centralHtml}
          </div>`;
        
        // Add trial counter and score display if enabled
        if (trial.show_remain || trial.show_total_score) {
          const done = jsPsych.data.get().filter({trial_type:info.name}).count() + 1;
          const rem = trial.show_remain ? `Quedan ${trial.total_trials-done}` : '';
          const tot = trial.show_total_score ? `Puntaje: ${resp.total_score}` : '';
          
          html += `
            <div style='position:absolute;left:${trial.info_position_side};
                        top:${trial.info_position_top};font-size:${trial.info_font_size};
                        color:${trial.info_color};'>
              ${rem}
            </div>`;
          html += `
            <div style='position:absolute;right:${trial.info_position_side};
                        top:${trial.info_position_top};font-size:${trial.info_font_size};
                        color:${trial.info_color};'>
              ${tot}
            </div>`;
        }
        
        display_element.innerHTML = html;
        jsPsych.pluginAPI.setTimeout(endTrial, trial.feedback_duration);
      };

      /**
       * Ends the trial and saves data
       */
      const endTrial = () => {
        if (finished) return;
        finished = true;
        
        // Save trial data
        jsPsych.finishTrial({
          // Response data
          key_press: resp.key,
          side_press: resp.side,
          rt: resp.rt,
          correct: resp.correct,
          rewarded: resp.rewarded,
          trial_score: resp.trial_score,
          total_score: resp.total_score,

          // Trial stimuli
          img_left: trial.img_left,
          img_right: trial.img_right,
          correct_key: trial.correct_key,
          pair: trial.pair,
          reward_prob: trial.reward_prob,

          // Experiment parameters
          pool_size: trial.pool_size,
          probabilistic: trial.probabilistic,
          symmetrical_feedback: trial.symmetrical_feedback,
          show_feedback: trial.show_feedback,
          omit_is_error: trial.omit_is_error,

          // Timing parameters
          fixation_min: trial.fixation_min,
          fixation_max: trial.fixation_max,
          stimulus_duration: trial.stimulus_duration,
          selection_duration: trial.selection_duration,
          feedback_duration: trial.feedback_duration,

          // Display options
          show_remain: trial.show_remain,
          show_total_score: trial.show_total_score
        });
      };

      // Start the trial with fixation cross
      showFix();
    }
  }

  // Attach plugin info to class
  ProbSelTaskPlugin.info = info;
  return ProbSelTaskPlugin;
})(jsPsychModule);

// Global alias for the plugin
var probabilisticSelectionTaskPlugin = jsPsychProbabilisticSelectionTask;