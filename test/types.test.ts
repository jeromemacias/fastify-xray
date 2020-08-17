import fastify = require("fastify");
import http2 = require("http2");
import xray = require("../");

const appWithImplicitHttp = fastify();

appWithImplicitHttp
  .register(xray, {
    defaultName: "May App",
  })
  .after(() => {
    appWithImplicitHttp.get("/", (request) => {
      const segment = request.XRaySegment;

      segment && segment.addMetadata("test", "meta");
    });
  });

const appWithHttp2: fastify.FastifyInstance<
  http2.Http2Server,
  http2.Http2ServerRequest,
  http2.Http2ServerResponse
> = fastify();

appWithHttp2.register(xray).after(() => {
  appWithHttp2.get("/", (request) => {
    const segment = request.XRaySegment;

    segment && segment.addMetadata("test", "meta");
  });
});
