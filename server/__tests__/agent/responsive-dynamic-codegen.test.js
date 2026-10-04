import { generateTrialCode } from '../../agent/codegen/trial.js'

test('dynamic generation preserves structural geometry and appearance', () => {
  const code = generateTrialCode({
    id: 9, name: 'responsive', plugin: 'plugin-dynamic',
    columnMapping: {
      __canvasStyles: { source: 'typed', value: { backgroundColor: '#abcdef', fullScreen: false, progressBar: false } },
      components: { source: 'typed', value: [{
        type: 'ImageComponent', coordinates: { x: -20, y: 40 }, width: 25,
        stimulus: { source: 'csv', value: 'picture' },
      }] },
      response_components: { source: 'typed', value: [{
        type: 'ButtonResponseComponent', component_id: 'finish',
        choices: { source: 'typed', value: ['Continue'] },
      }] },
    }, csvJson: [{ picture: 'red.png' }],
  }, false).code
  expect(code).toContain('ImageComponent')
  expect(code).toContain('"coordinates":{"x":-20,"y":40}')
  expect(code).toContain('"width":25')
  expect(code).toContain('red.png')
  expect(code).toContain('"component_id":"finish"')
  expect(code).toContain('"backgroundColor":"#abcdef"')
  expect(code).not.toContain('1440')
  expect(code).not.toContain('900')
})
