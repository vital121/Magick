// DOCUMENTED
import checkPermissions from 'feathers-permissions'
import { parse, stringify } from 'flatted'
import { authenticate } from '@feathersjs/authentication'
import { NotAuthenticated } from '@feathersjs/errors/lib'
import { HookContext } from '@feathersjs/feathers'
import { feathers } from '@feathersjs/feathers/lib'
import {
  bodyParser,
  cors,
  errorHandler,
  koa,
  parseAuthentication,
  rest,
} from '@feathersjs/koa'
import socketio from '@feathersjs/socketio'
import pino from 'pino'
import Redis from 'ioredis'
import { RedisPubSub } from 'server/redis-pubsub'
import sync from 'feathers-sync'
import { globalsManager } from 'shared/core'

import { REDIS_URL, API_ACCESS_KEY } from 'shared/config'
import { createPosthogClient } from 'server/event-tracker'

import { dbClient } from './dbClient'
import type { Application } from './declarations'
import type { AgentCommander } from 'server/agents'
import { logError } from './hooks'
import channels from './sockets/channels'
import { authentication } from './auth/authentication'
import { services } from './services'
import handleSockets from './sockets/sockets'

import { getLogger } from 'server/logger'
import { authenticateApiKey } from './hooks/authenticateApiKey'
import { CredentialsManager } from 'server/credentials'

// @ts-ignore
BigInt.prototype.toJSON = function () {
  return this.toString()
}

// Initialize the Feathers Koa app
export const app: Application = koa(feathers())

export type Environment = 'default' | 'server' | 'agent'

declare module './declarations' {
  interface Configuration {
    pubsub: RedisPubSub
    redis: Redis
    isAgent?: boolean
    agentCommander: AgentCommander
    logger: pino.Logger
    environment: Environment
    posthog: ReturnType<typeof createPosthogClient>
    credentialsManager: CredentialsManager
  }
}

export async function initApp(environment: Environment = 'default') {
  const logger = getLogger()
  logger.info('Initializing feathers app...')
  app.set('logger', logger)

  const credentialsManager = new CredentialsManager()
  app.set('credentialsManager', credentialsManager)

  app.set('posthog', createPosthogClient(app))

  globalsManager.register('feathers', app)

  const port = parseInt(process.env.PORT || '3030', 10)
  app.set('port', port)

  const host = process.env.HOST || 'localhost'
  app.set('host', host)

  const paginateDefault = parseInt(process.env.PAGINATE_DEFAULT || '10', 10)
  const paginateMax = parseInt(process.env.PAGINATE_MAX || '50', 10)
  const paginate = {
    default: paginateDefault,
    max: paginateMax,
  }

  app.set('paginate', paginate)
  app.set('environment', environment)

  // Koa middleware
  app.use(cors({ origin: '*' }))
  app.use(errorHandler())
  app.use(parseAuthentication())
  app.use(
    bodyParser({ jsonLimit: '200mb', formLimit: '256mb', multipart: true })
  )
  app.use(async (ctx, next) => {
    if (ctx.request.files?.files) {
      if (ctx.request.files?.files instanceof Array) {
        ctx.request.body.files = ctx.request.files?.files
      } else {
        ctx.request.body.files = [ctx.request.files?.files]
      }
    }
    await next()
  })

  // sync up messages between the app and the runner
  logger.info('SETTING UP REDIS')
  app.configure(
    sync({
      uri: REDIS_URL,
      serialize: stringify,
      deserialize: parse,
    })
  )

  // Initialize pubsub redis client
  const pubsub = new RedisPubSub()
  await pubsub.initialize(REDIS_URL)

  app.set('pubsub', pubsub)

  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
  })
  app.set('redis', redis)

  // Configure authentication
  app.set('authentication', {
    secret: process.env.JWT_SECRET || 'secret',
    entity: null,
    authStrategies: ['jwt'],
    jwtOptions: {
      header: { type: 'access' },
      audience: 'https://yourdomain.com',
      issuer: 'feathers',
      algorithm: 'A256GCM',
      expiresIn: '1d',
    },
  })

  app.configure(authentication)

  // Configure WebSocket for the app
  app.configure(
    socketio(
      {
        cors: {
          origin: '*',
          methods: ['GET', 'POST', 'OPTIONS'],
          allowedHeaders: ['Authorization'],
        },
        transports: ['websocket'],
      },
      handleSockets(app)
    )
  )

  // Configure services and transports
  app.configure(rest())

  app.configure(dbClient)
  app.configure(services)
  app.configure(channels)

  // Register hooks
  app.hooks({
    around: {
      all: [
        logError,
        authenticateApiKey([API_ACCESS_KEY]),
        async (context: HookContext, next) => {
          // if the route is to the api service, skip auth
          if (context.path === 'api') {
            context.params.user = {
              id: 'api',
              permissions: ['admin', 'owner'],
            }

            return next()
          }

          // if we are authenticated with the API key, skip auth
          if (context.params.authenticated && context.params.apiKey) {
            // set the user to the api user for all permissions here
            context.params.user = {
              id: 'api',
              permissions: ['admin', 'owner'],
            }
            return next()
          }

          const socket = context.params.connection
          // if we are on a socket and there is a user, skip auth
          if (socket && socket.user) {
            context.params.user = socket.user
            return next()
          }

          if (context.path !== 'authentication') {
            return authenticate('jwt')(context, next)
          }
        },
        async (context: HookContext, next) => {
          const { params } = context

          // if we are authenticated with the API key, skip auth for full access
          if (context.params.authenticated && context.params.apiKey) {
            return next()
          }

          const { authentication, authenticated } = params

          if (authenticated) {
            context.params.user = authentication.payload.user
            context.params.projectId = authentication.payload.project

            const queryProjectId = context.params.query.projectId
            const bodyProjectId = context.params.body?.projectId

            if (!queryProjectId && !bodyProjectId) {
              console.error('No project id provided.')
              throw new NotAuthenticated('No project id provided.')
            }

            const providedProjectId = queryProjectId || bodyProjectId

            if (authentication.payload.project !== providedProjectId) {
              console.error(
                'User not authorized to access project',
                authentication.payload.project,
                providedProjectId
              )
              throw new NotAuthenticated(
                'User not authorized to access project'
              )
            }
          }

          return next()
        },
      ],
    },
    before: {
      all: [
        checkPermissions({
          roles: ['admin', 'owner', 'public'],
        }),
      ],
    },
    after: {},
    error: {},
  })

  // Register setup and teardown hooks
  app.hooks({
    setup: [],
    teardown: [],
  })
  logger.info('Feathers app initialized')

  return app
}

declare module '@feathersjs/feathers' {
  interface Params {
    user?: any // Replace 'any' with a more specific type if you have a user model
    projectId?: string
  }
}
