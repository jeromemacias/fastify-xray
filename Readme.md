# fastify-xray

[![Build Status](https://travis-ci.org/jeromemacias/fastify-xray.svg?branch=master)](https://travis-ci.org/jeromemacias/fastify-xray)

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
const segment = req.segment;

// If the restify context plugin is being used, it is placed under 'XRaySegment'
const segment = request.XRaySegment;
```

This plugin should be register as soon as possible after fastify initialisation.

## Automatic mode examples

For more automatic mode examples, see the [example code](https://github.com/aws/aws-xray-sdk-node/tree/master/packages/core#example-code).

```js
const fastify = require("fastify")();

fastify.register(require("fastify-xray"), {
  defaultName: "My App Name",
});

// Error capturing is attached to the fastify onError hook
```

## Manual mode examples

For more manual mode examples, see [manual mode examples for Express](https://github.com/aws/aws-xray-sdk-node/tree/master/packages/express#manual-mode-examples). The X-Ray SDK can be used identically inside Restify routes.

```js
const fastify = require("fastify")();

fastify.register(require("fastify-xray"), {
  defaultName: "My App Name",
});

//...

fastify.get("/", async function (request, reply) {
  const segment = request.XRaySegment;

  //...

  return "hello";
});

// Error capturing is attached to the fastify onError hook
```

## License

[MIT License](LICENSE.md)
