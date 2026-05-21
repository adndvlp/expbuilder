export const lastTrial = `   const test_stimuli_Last_Trial = [{stimulus: '<div id="ibuj" style="box-sizing: border-box;">Ya puedes cerrar esta ventana</div>'}];
    const Last_Trial_timeline = {
    type: jsPsychHtmlKeyboardResponse, stimulus: jsPsych.timelineVariable("stimulus"),
      data: {
        response: "response",
rt: "rt",
stimulus: "stimulus",
        trial_id: 1778798102194,
        builder_id: 1778798102194,
        trial_name: "Last Trial",
        
        
      },
    
    on_start: function(trial) {
      // Then apply custom parameters from branching conditions (higher priority)
      // For trials outside loops, use window.branchCustomParameters
      if (window.branchCustomParameters && typeof window.branchCustomParameters === 'object') {
        Object.entries(window.branchCustomParameters).forEach(([key, param]) => {
          if (param && param.source !== 'none') {
            // Parse key to check if it's a nested survey question
            const parts = key.split('::');
            
            if (parts.length === 4) {
              // Format: fieldType::componentName::survey_json::questionName
              const [fieldType, componentName, propName, questionName] = parts;
              
              if (fieldType && componentName && propName === 'survey_json' && questionName) {
                // Find the component by name in the field array
                const fieldArray = trial[fieldType];
                if (Array.isArray(fieldArray)) {
                  const compIndex = fieldArray.findIndex(c => c.name === componentName);
                  if (compIndex !== -1 && fieldArray[compIndex].survey_json) {
                    // Find the question in survey_json.elements
                    const elements = fieldArray[compIndex].survey_json.elements || [];
                    const questionIndex = elements.findIndex(q => q.name === questionName);
                    
                    if (questionIndex !== -1) {
                      // Apply the override value (from typed or csv)
                      let valueToSet;
                      if (param.source === 'typed') {
                        valueToSet = String(param.value); // Convert to string for SurveyJS
                      } else if (param.source === 'csv') {
                        valueToSet = String(trial[param.value]); // Get from CSV column and convert to string
                      }
                      
                      if (valueToSet !== undefined && valueToSet !== null) {
                        fieldArray[compIndex].survey_json.elements[questionIndex].defaultValue = valueToSet;
                      }
                    }
                  }
                }
              }
            } else if (parts.length === 3) {
              // Format: fieldType::componentName::property (for DynamicPlugin components)
              const [fieldType, componentName, propName] = parts;
              
              if (fieldType && componentName && propName) {
                // Find the component by name in the field array
                const fieldArray = trial[fieldType];
                if (Array.isArray(fieldArray)) {
                  const compIndex = fieldArray.findIndex(c => c.name === componentName);
                  if (compIndex !== -1) {
                    // Apply the override value (from typed or csv)
                    let valueToSet;
                    if (param.source === 'typed') {
                      valueToSet = param.value;
                    } else if (param.source === 'csv') {
                      valueToSet = trial[param.value];
                    }
                    
                    if (valueToSet !== undefined && valueToSet !== null) {
                      fieldArray[compIndex][propName] = valueToSet;
                    }
                  }
                }
              }
            } else {
              // Normal parameter (not nested survey question)
              if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
                trial[key] = param.value;
              } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
                trial[key] = trial[param.value];
              }
            }
          }
        });
        // Clear the custom parameters after applying them
        window.branchCustomParameters = null;
      }
      
    },
    
    on_finish: function(data) {
      if (window.branchingActive) {
        jsPsych.abortExperiment('', {});
      }
    },};
    console.log("=== PROCEDURE SETUP Last_Trial ===");
    console.log("test_stimuli_Last_Trial before procedure:", test_stimuli_Last_Trial);
    console.log("test_stimuli_Last_Trial.length:", test_stimuli_Last_Trial ? test_stimuli_Last_Trial.length : 'undefined');
    
    const Last_Trial_procedure = {
    timeline: 
    [Last_Trial_timeline],
    timeline_variables: test_stimuli_Last_Trial,
    
    conditional_function: function() {
      const currentId = 1778798102194;
      
      // Verificar si hay un trial objetivo guardado en localStorage (para repeat/jump)
      const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
      if (jumpToTrial) {
        if (String(currentId) === String(jumpToTrial)) {
          // Encontramos el trial objetivo para repeat/jump
          console.log('🔁 [REPEAT/JUMP] Found target trial', currentId);
          localStorage.removeItem('jsPsych_jumpToTrial');
          return true;
        }
        // No es el objetivo, saltar
        console.log('⏭️ [REPEAT/JUMP] Skipping trial', currentId);
        return false;
      }
      
      // Si skipRemaining está activo (branching normal), verificar si este es el trial objetivo
      if (window.skipRemaining) {
        console.log('🔍 [SKIP CHECK] Trial', currentId, '| Target:', window.nextTrialId, '| Match:', String(currentId) === String(window.nextTrialId));
        if (String(currentId) === String(window.nextTrialId)) {
          // Encontramos el trial objetivo
          console.log('✅ [SKIP CHECK] Found target trial! Disabling skip mode');
          window.skipRemaining = false;
          window.nextTrialId = null;
          return true;
        }
        // No es el objetivo, saltar
        console.log('⏭️ [SKIP CHECK] Skipping trial', currentId);
        return false;
      }
      
      return true;
    },
  
    
    };
    timeline.push(Last_Trial_procedure);`;
