'use strict'

const test = require('tap').test
const xray = require('aws-xray-sdk-core')
const Fastify = require('fastify')
const sinon = require('sinon')
const EventEmitter = require('events')
const util = require('util')
const plugin = require('../plugin')

const SegmentEmitter = require('aws-xray-sdk-core/lib/segment_emitter')
const ServiceConnector = require('aws-xray-sdk-core/lib/middleware/sampling/service_connector')

const mwUtils = xray.middleware
const IncomingRequestData = xray.middleware.IncomingRequestData
const Segment = xray.Segment

const TestUtils = {}

TestUtils.TestEmitter = function TestEmitter () {
  EventEmitter.call(this)
}

util.inherits(TestUtils.TestEmitter, EventEmitter)

TestUtils.onEvent = function onEvent (event, fcn) {
  this.emitter.on(event, fcn.bind(this))
  return this
}

const defaultName = 'defaultName'
const hostName = 'expressMiddlewareTest'
const parentId = '2c7ad569f5d6ff149137be86'
const traceId = '1-f9194208-2c7ad569f5d6ff149137be86'
let newSegmentSpy, addReqDataSpy, addThrottleFlagSpy, addErrorSpy, segmentCloseSpy, processHeadersStub, resolveNameStub, segmentHttpCloseSpy, setSegmentSpy

function register (AWSXRay, giveInstanceAs) {
  const fastify = Fastify()
  fastify.addHook('onRequest', (request, reply, done) => {
    request.raw.emitter = new TestUtils.TestEmitter()
    request.raw.on = TestUtils.onEvent
    request.raw.headers = { host: hostName }

    reply.raw.emitter = new TestUtils.TestEmitter()
    reply.raw.on = TestUtils.onEvent

    done()
  })

  if (AWSXRay && giveInstanceAs === 'decorator') {
    fastify.decorate('AWSXRay', xray)
  }

  fastify.register(plugin, {
    defaultName: 'Test app',
    AWSXRay: AWSXRay && giveInstanceAs === 'option' ? AWSXRay : undefined
  })

  return fastify
}

test('should throw error if defaultName option is missing', async (t) => {
  t.plan(2)

  const fastify = Fastify()
  fastify.register(plugin)

  try {
    await fastify.ready()
    t.fail('should not boot successfully')
  } catch (err) {
    t.ok(err)
    t.equal(
      err.message,
      'Default segment name was not supplied. Please provide a string.'
    )

    await fastify.close()
  }
})

test('should initialized correctly', (t) => {
  t.plan(6)

  t.beforeEach((done) => {
    sinon.stub(SegmentEmitter)
    sinon.stub(ServiceConnector)

    setSegmentSpy = sinon.spy(xray, 'setSegment')

    newSegmentSpy = sinon.spy(Segment.prototype, 'init')
    addReqDataSpy = sinon.spy(Segment.prototype, 'addIncomingRequestData')
    addThrottleFlagSpy = sinon.spy(Segment.prototype, 'addThrottleFlag')
    addErrorSpy = sinon.spy(Segment.prototype, 'addError')
    segmentCloseSpy = sinon.spy(Segment.prototype, 'close')
    segmentHttpCloseSpy = sinon.spy(IncomingRequestData.prototype, 'close')

    processHeadersStub = sinon
      .stub(mwUtils, 'processHeaders')
      .returns({ root: traceId, parent: parentId, sampled: '1' })
    resolveNameStub = sinon.stub(mwUtils, 'resolveName').returns(defaultName)

    done()
  })

  t.afterEach((done) => {
    sinon.restore()
    delete process.env.AWS_XRAY_TRACING_NAME

    done()
  })

  t.test('success tracing in automatic mode', (st) => {
    st.plan(12)

    sinon.stub(xray, 'isAutomaticMode').returns(true)

    const fastify = register()

    fastify.get('/', (request) => {
      xray.getSegment().addMetadata('test', 'data')

      return Promise.resolve({})
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(processHeadersStub.calledOnce)

        st.ok(addReqDataSpy.calledOnce)
        st.ok(addReqDataSpy.calledWithExactly(sinon.match.instanceOf(IncomingRequestData)))

        st.ok(resolveNameStub.calledOnce)

        st.ok(newSegmentSpy.calledOnce)
        st.ok(newSegmentSpy.calledWithExactly(defaultName, traceId, parentId))

        st.ok(setSegmentSpy.calledOnce)

        st.ok(processHeadersStub.calledWithExactly(res.raw.req))
        st.ok(segmentHttpCloseSpy.calledOnce)
        st.ok(segmentCloseSpy.calledOnce)

        st.ok(addErrorSpy.notCalled)
      }
    )
  })

  t.test('segment available in request in manual mode', (st) => {
    st.plan(9)

    sinon.stub(xray, 'isAutomaticMode').returns(false)

    const fastify = register()

    fastify.get('/', (request) => {
      request.segment.addMetadata('test', 'data')

      return Promise.resolve({})
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(processHeadersStub.calledOnce)

        st.ok(addReqDataSpy.calledOnce)
        st.ok(addReqDataSpy.calledWithExactly(sinon.match.instanceOf(IncomingRequestData)))

        st.ok(resolveNameStub.calledOnce)

        st.ok(newSegmentSpy.calledOnce)
        st.ok(newSegmentSpy.calledWithExactly(defaultName, traceId, parentId))

        st.ok(setSegmentSpy.notCalled)
        st.ok(addErrorSpy.notCalled)
      }
    )
  })

  t.test('error tracing', (st) => {
    st.plan(5)

    sinon.stub(xray, 'isAutomaticMode').returns(true)

    const error = new Error('route error')
    const fastify = register()

    fastify.get('/', (request) => {
      xray.getSegment().addMetadata('test', 'data')

      return Promise.reject(error)
    })

    const getCauseStub = sinon.stub(xray.utils, 'getCauseTypeFromHttpStatus').returns('fault')

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(addErrorSpy.calledWithExactly(error))
        st.ok(getCauseStub.calledWith(500))
        st.ok(segmentHttpCloseSpy.calledOnce)
        st.ok(segmentCloseSpy.calledOnce)
      }
    )
  })

  t.test('throttle flag', (st) => {
    st.plan(4)

    sinon.stub(xray, 'isAutomaticMode').returns(true)

    const fastify = register()

    fastify.get('/', (request, reply) => {
      reply.code(429)

      return Promise.resolve({})
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(addThrottleFlagSpy.calledOnce)
        st.ok(segmentHttpCloseSpy.calledOnce)
        st.ok(segmentCloseSpy.calledOnce)
      }
    )
  })

  t.test('success tracing with custom AWSXRay as option', (st) => {
    st.plan(2)

    sinon.stub(xray, 'isAutomaticMode').returns(true)

    const fastify = register(xray, 'option')

    fastify.get('/', (request) => {
      xray.getSegment().addMetadata('test', 'data')

      return Promise.resolve({})
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(segmentCloseSpy.calledOnce)
      }
    )
  })

  t.test('success tracing with custom AWSXRay using fastify instance decorator', (st) => {
    st.plan(2)

    sinon.stub(xray, 'isAutomaticMode').returns(true)

    const fastify = register(xray, 'decorator')

    fastify.get('/', (request) => {
      xray.getSegment().addMetadata('test', 'data')

      return Promise.resolve({})
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)

        st.ok(segmentCloseSpy.calledOnce)
      }
    )
  })
})
