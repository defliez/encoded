// types.js
// BeatTemplate: reusable recipe
/**
 * @typedef {Object} BeatTemplate
 * @property {string} id                  // unique template id
 * @property {('brief'|'travel'|'recon'|'interact'|'debrief')} kind
 * @property {string[]} gates             // soft filters like ["area:park","landmark:bench"]
 * @property {string[]} pre               // facts required before this beat, e.g. ["has_briefing"]
 * @property {string[]} post              // facts added/removed after, e.g. ["has_package","!lead_cold"]
 * @property {Record<string,string>} vars // variable schema, e.g. { target:'landmark', drop:'landmark' }
 * @property {(binding:Record<string,any>) => string} title
 * @property {(binding:Record<string,any>) => string} description
 * @property {(binding:Record<string,any>) => string} npcPrompt
 */

// BeatInstance: concrete step stored in Supabase
/**
 * @typedef {Object} BeatInstance
 * @property {string} templateId
 * @property {string} kind
 * @property {string} title
 * @property {string} description
 * @property {string} npcPrompt
 * @property {Record<string,any>} vars
 * @property {Record<string,any>} meta     // e.g. coords, landmark ids, difficulty, timers
 */

