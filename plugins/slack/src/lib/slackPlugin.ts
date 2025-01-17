import Redis from 'ioredis'
import { Job } from 'bullmq'
import { ActionPayload, CoreEventsPlugin, EventPayload } from 'server/plugin'
import { SLACK_ACTIONS, SLACK_EVENTS, SLACK_KEY } from './constants'
import { SlackEmitter } from './dependencies/slackEmitter'
import SlackEventClient from './services/slackEventClient'
import { RedisPubSub } from 'packages/server/redis-pubsub/src'
import { pluginName, pluginCredentials } from './constants'
import { SlackClient } from './services/slack'
import { SlackCredentials, SlackState } from './types'
import {
  sendSlackImage,
  sendSlackMessage,
  onSlackMessageNodes,
  sendSlackAudio,
} from './nodes'
import { CorePluginEvents } from 'plugin/core'
export class SlackPlugin extends CoreEventsPlugin<
  CorePluginEvents,
  EventPayload,
  Record<string, unknown>,
  Record<string, unknown>,
  SlackState
> {
  override enabled = true
  client: SlackEventClient
  nodes = [
    ...onSlackMessageNodes,
    sendSlackMessage,
    sendSlackImage,
    sendSlackAudio,
  ]
  values = []
  slack: SlackClient | undefined = undefined

  constructor({
    connection,
    agentId,
    pubSub,
    projectId,
  }: {
    connection: Redis
    agentId: string
    pubSub: RedisPubSub
    projectId: string
  }) {
    super({ name: pluginName, connection, agentId, projectId })
    this.client = new SlackEventClient(pubSub, agentId)
    // this.meterManager.initializeMeters({})
    this.setCredentials(pluginCredentials)
    this.initalizeSlack().catch(error =>
      this.logger.error(
        `Failed to initialize Slack Plugin for agent ${agentId}: ${error}`
      )
    )
  }

  defineEvents(): void {
    for (const [messageType, eventName] of Object.entries(SLACK_EVENTS)) {
      this.registerEvent({
        eventName,
        displayName: `Slack ${messageType}`,
      })
    }
  }

  defineActions(): void {
    for (const [actionName] of Object.entries(SLACK_ACTIONS)) {
      this.registerAction({
        actionName,
        displayName: `Slack ${actionName}`,
        handler: this.handleSendMessage.bind(this),
      })
    }
  }

  getDependencies() {
    return {
      [pluginName]: SlackEmitter,
      [SLACK_KEY]: this.slack,
    }
  }

  private async initalizeSlack() {
    try {
      const credentials = await this.getCredentials()
      this.slack = new SlackClient(
        credentials,
        this.agentId,
        this.emitEvent.bind(this)
      )

      await this.slack.init()

      this.updateDependency(SLACK_KEY, this.slack)
    } catch (error) {
      this.logger.error(error, 'Failed during initialization:')
    }
  }

  private async getCredentials(): Promise<SlackCredentials> {
    try {
      const tokens = Object.values(pluginCredentials).map(c => c.name)
      const [token, signingSecret, appToken] = await Promise.all(
        tokens.map(t =>
          this.credentialsManager.retrieveAgentCredentials(this.agentId, t)
        )
      )

      return { token, signingSecret, appToken }
    } catch (error) {
      this.logger.error('Failed to retrieve credentials:', error)
      throw error
    }
  }

  initializeFunctionalities(): void {}
  handleOnMessage() {}

  handleSendMessage(actionPayload: Job<ActionPayload>) {
    const { actionName, event } = actionPayload.data
    const { plugin } = event
    const eventName = `${plugin}:${actionName}`

    if (plugin === 'Slack') {
      this.client.sendMessage(actionPayload.data)
    } else {
      this.centralEventBus.emit(eventName, actionPayload.data)
    }
  }

  formatPayload(event, payload) {
    return payload
  }
}
