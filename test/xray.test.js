'use strict'

const test = require('tap').test
const xray = require('aws-xray-sdk-core')
const Fastify = require('fastify')
const sinon = require('sinon')
var EventEmitter = require('events')
var util = require('util')
const plugin = require('../plugin')

const SegmentEmitter = require('aws-xray-sdk-core/lib/segment_emitter')
const ServiceConnector = require('aws-xray-sdk-core/lib/middleware/sampling/service_connector')

const mwUtils = xray.middleware
// const IncomingRequestData = xray.middleware.IncomingRequestData
const Segment = xray.Segment

var TestUtils = {}

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
let newSegmentSpy, addReqDataSpy, processHeadersStub, resolveNameStub

function register () {
  const fastify = Fastify()
  fastify.addHook('onRequest', (request, reply, done) => {
    request.raw.emitter = new TestUtils.TestEmitter()
    request.raw.on = TestUtils.onEvent
    request.raw.headers = { host: hostName }

    reply.res.emitter = new TestUtils.TestEmitter()
    reply.res.on = TestUtils.onEvent

    done()
  })

  fastify.register(plugin, {
    defaultName: 'Test app'
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
  t.plan(2)

  t.beforeEach((done) => {
    // sinon.stub(xray, "isAutomaticMode").returns(false);
    sinon.stub(SegmentEmitter)
    sinon.stub(ServiceConnector)

    newSegmentSpy = sinon.spy(Segment.prototype, 'init')
    addReqDataSpy = sinon.spy(Segment.prototype, 'addIncomingRequestData')

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

  t.test('success tracing', (st) => {
    st.plan(6)

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

        st.ok(resolveNameStub.calledOnce)

        st.ok(newSegmentSpy.calledOnce)
        st.ok(newSegmentSpy.calledWithExactly(defaultName, traceId, parentId))
        // st.ok(processHeadersStub.calledWithExactly(res));
      }
    )
  })

  t.test('error tracing', (st) => {
    st.plan(1)

    const fastify = register()

    fastify.get('/', (request) => {
      request.segment.addMetadata('test', 'data')

      return Promise.reject(new Error('route error'))
    })

    fastify.inject(
      {
        method: 'GET',
        url: '/'
      },
      (err, res) => {
        st.error(err)
      }
    )
  })
})
