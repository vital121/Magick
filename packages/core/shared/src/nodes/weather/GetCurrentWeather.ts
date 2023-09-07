// DOCUMENTED
import Rete from 'rete'
import { MagickComponent } from '../../engine'
import { pluginManager } from '../../plugin'
import { objectSocket, stringSocket, triggerSocket } from '../../sockets'
import {
  CompletionProvider,
  EngineContext,
  MagickNode,
  MagickWorkerInputs,
  MagickWorkerOutputs,
  WorkerData,
} from '../../types'

/** Information related to the GenerateText */
const info =
  'Takes a string input and generates an AI text completion which is output as a string. The Model Name property lets you select between the various text completion models that have been integrated into Magick. Changing the model name will provide relevant properties for the model such as Temperature and Top P (explanations of which can be found online). The GPT 3.5 Turbo and GPT-4 models have optional System Directive and Conversation properties. The System Directive is a string that describes how the chat completion model should behave and the Conversations property allows you to pass in an array of previous chat messages for the model to use as short-term memory. The conversation array can be generated by using the Events to Conversation node.'

/** Type definition for the worker return */
type WorkerReturn = {
  result?: object
}

/**
 * GenerateText component responsible for generating text using any providers
 * available in Magick.
 */
export class GetCurrentWeather extends MagickComponent<Promise<WorkerReturn>> {
  constructor() {
    super(
      'Get Current Weather',
      {
        outputs: {
          result: 'output',
          trigger: 'option',
        },
      },
      'Weather',
      info
    )
  }

  /**
   * Builder for generating text.
   * @param node - the MagickNode instance.
   * @returns a configured node with data generated from providers.
   */
  builder(node: MagickNode) {
    const triggerInput = new Rete.Input('trigger', 'Trigger', triggerSocket, true)
    const triggerOutput = new Rete.Output('trigger', 'Trigger', triggerSocket)
    const location = new Rete.Input('city', 'City', stringSocket)
    const stateCode = new Rete.Input('state', 'State Code', stringSocket)
    const countryCode = new Rete.Input('country', 'Country Code', stringSocket)
    const out = new Rete.Output('result', 'Result', objectSocket)
    node.addInput(triggerInput).addInput(location).addInput(stateCode).addInput(countryCode).addOutput(triggerOutput).addOutput(out)

    return node
  }

  /**
   * Worker for processing the generated text.
   * @param node - the worker data.
   * @param inputs - worker inputs.
   * @param outputs - worker outputs.
   * @param context - engine context.
   * @returns an object with the success status and result or error message.
   */
  async worker(
    node: WorkerData,
    inputs: MagickWorkerInputs,
    outputs: MagickWorkerOutputs,
    context: {
      module: unknown
      secrets: Record<string, string>
      projectId: string
      context: EngineContext
    }
  ) {
    // get completion providers for text and chat categories
    const completionProviders = pluginManager.getCompletionProviders('weather', [
      'current',
    ]) as CompletionProvider[]

    const provider = completionProviders[0]
    const completionHandler = provider.handler

    if (!completionHandler) {
      console.error('No completion handler found for provider', provider)
      throw new Error('ERROR: Completion handler undefined')
    }

    const { success, result, error } = await completionHandler({
      node,
      inputs,
      outputs,
      context,
    })
    console.log("result", result)
    if (!success) {
      throw new Error('ERROR: ' + error)
    }

    return {
      result: result as object,
    }
  }
}
