'use strict'

const fp = require('fastify-plugin')

function plugin (fastify, options, next) {
  const AWSXRay = options.AWSXRay || fastify.AWSXRay || require('aws-xray-sdk-core')

  const mwUtils = AWSXRay.middleware
  const IncomingRequestData = mwUtils.IncomingRequestData
  const Segment = AWSXRay.Segment

  function fastifyXrayOnRequest (request, reply, done) {
    const req = request.raw
    const res = reply.raw
    res.req = req
    res.header = {}

    const amznTraceHeader = mwUtils.processHeaders(req)
    const name = mwUtils.resolveName(req.headers.host)
    const segment = new Segment(
      name,
      amznTraceHeader.Root || amznTraceHeader.root,
      amznTraceHeader.Parent || amznTraceHeader.parent
    )

    mwUtils.resolveSampling(amznTraceHeader, segment, res)
    segment.addIncomingRequestData(new IncomingRequestData(req))

    for (const headerKey in res.header) {
      reply.header(headerKey, res.header[headerKey])
    }

    AWSXRay.getLogger().debug(
      'Starting Fastify segment: { url: ' +
      req.url +
      ', name: ' +
      segment.name +
      ', trace_id: ' +
      segment.trace_id +
      ', id: ' +
      segment.id +
      ', sampled: ' +
      !segment.notTraced +
      ' }'
    )

    if (AWSXRay.isAutomaticMode()) {
      const ns = AWSXRay.getNamespace()
      ns.bindEmitter(req)
      ns.bindEmitter(res)

      ns.run(function () {
        AWSXRay.setSegment(segment)

        done()
      })
    } else {
      request.segment = segment

      done()
    }
  }

  function fastifyXrayOnError (request, reply, error, done) {
    const segment = AWSXRay.resolveSegment(request.segment)

    if (segment && error) {
      segment.addError(error)
    }

    done()
  }

  function fastifyXrayOnResponse (request, reply, done) {
    const segment = AWSXRay.resolveSegment(request.segment)
    if (!segment || segment.isClosed()) {
      return done()
    }

    const statusCode = reply.statusCode || reply.res.statusCode

    if (statusCode === 429) {
      segment.addThrottleFlag()
    }

    const cause = AWSXRay.utils.getCauseTypeFromHttpStatus(statusCode)
    if (cause) {
      segment[cause] = true
    }

    if (segment.http && reply.raw) {
      segment.http.close(reply.raw)
    }
    segment.close()

    AWSXRay.getLogger().debug(
      'Closed Fastify segment successfully: { url: ' +
      request.raw.url +
      ', name: ' +
      segment.name +
      ', trace_id: ' +
      segment.trace_id +
      ', id: ' +
      segment.id +
      ', sampled: ' +
      !segment.notTraced +
      ' }'
    )

    done()
  }

  const { defaultName } = options

  if (!defaultName || typeof defaultName !== 'string') {
    return next(
      new Error(
        'Default segment name was not supplied. Please provide a string.'
      )
    )
  }

  mwUtils.setDefaultName(defaultName)
  AWSXRay.getLogger().debug('Enabling AWS X-Ray for Fastify.')

  fastify.decorateRequest('XRaySegment', null)
  fastify.addHook('onRequest', fastifyXrayOnRequest)
  fastify.addHook('onError', fastifyXrayOnError)
  fastify.addHook('onResponse', fastifyXrayOnResponse)

  next()
}

module.exports = fp(plugin, {
  fastify: '>=3.0.0',
  name: 'fastify-xray'
})
