# fastify-xray

[![Build Status](https://travis-ci.org/jeromemacias/fastify-xray.svg?branch=master)](https://travis-ci.org/jeromemacias/fastify-xray)

## Requirements

* AWS X-Ray SDK Core (aws-xray-sdk-core)
* Fastify 2.0.0 or greater

## AWS X-Ray and Fastify

The AWS X-Ray [Fastify](http://fastify.io/) package automatically records information
for incoming and outgoing requests and responses, via the 'enable' function in this
package. To configure sampling, dynamic naming, and more see the [set up section](https://github.com/aws/aws-xray-sdk-node/tree/master/packages/core#setup).

The AWS X-Ray SDK Core has two modes - `manual` and `automatic`.
Automatic mode uses the `cls-hooked` package and automatically
tracks the current segment and subsegment. This is the default mode.
Manual mode requires that you pass around the segment reference.

In automatic mode, you can get the current segment or subsegment at any time:

```js
const segment = AWSXRay.getSegment();
```

In manual mode, you can get the base segment off of the request object:

```js
const segment = request.segment;
```

This plugin should be register as soon as possible after Fastify initialisation.

## Plugin usage

### Automatic mode examples

For more automatic mode examples, see the [example code](https://github.com/aws/aws-xray-sdk-node/tree/master/packages/core#example-code).

```js
const fastify = require("fastify")();

fastify.register(require("fastify-xray"), {
  defaultName: "My App Name",
});

// Error capturing is attached to the fastify onError hook
```

### Manual mode examples

For more manual mode examples, see [manual mode examples](https://github.com/aws/aws-xray-sdk-node/tree/master/packages/core#Manual-Mode-Examples). The X-Ray SDK can be used identically inside Restify routes. Note that you don't have to manually start or close the segments since that is handled by the X-Ray middleware.

```js
const fastify = require("fastify")();

fastify.register(require("fastify-xray"), {
  defaultName: "My App Name",
});

//...

fastify.get("/", async function (request, reply) {
  const segment = request.segment;

  //...

  return "hello";
});

// Error capturing is attached to the fastify onError hook
```

## License

[MIT License](LICENSE.md)
