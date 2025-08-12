var jsPsychConsent = (function(jspsych){        
  "use strict";

  
  const info = {
    name: "consent",                            
    parameters: {
      consent_text: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "<p>¿Consientes participar en este estudio?</p>"
      },
      yes_label: {
        type: jspsych.ParameterType.STRING,
        default: "Sí"
      },
      no_label: {
        type: jspsych.ParameterType.STRING,
        default: "No"
      },
      goodbye_text: {
        type: jspsych.ParameterType.HTML_STRING,
        default: "<p>Gracias por tu tiempo. Puedes cerrar esta ventana.</p>"
      }
    }
  };

  class ConsentPlugin {
    static info = info;                          

    constructor(jsPsych){
      this.jsPsych = jsPsych;                    
    }

    trial(display_element, trial){
      display_element.innerHTML = `
        <div id="consent-container">
          ${trial.consent_text}
          <div style="margin-top:20px;">
            <button id="btn-yes">${trial.yes_label}</button>
            <button id="btn-no">${trial.no_label}</button>
          </div>
        </div>`;

      /* — botón “Sí” — */
      document.getElementById("btn-yes")
        .addEventListener("click", () => {
          this.jsPsych.finishTrial({ consent:true });
        });

      /* — botón “No” — */
      document.getElementById("btn-no")
        .addEventListener("click", () => {
          display_element.innerHTML = trial.goodbye_text;
          setTimeout(() => {
            this.jsPsych.endExperiment(
              "El participante no otorgó su consentimiento."
            );
          }, 2000);
        });
    }
  }

  return ConsentPlugin;                          // ¡ahora sí es un constructor!
})(jsPsychModule);
