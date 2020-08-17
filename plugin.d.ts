/// <reference types="node" />
import * as fastify from "fastify";
import { FastifyRequest } from "fastify";
import { IncomingMessage } from "http";
import { Http2ServerRequest } from "http2";
import * as AWSXRay from "aws-xray-sdk-core";

type HttpRequest = IncomingMessage | Http2ServerRequest;

declare module "fastify" {
  interface FastifyRequest<
    HttpRequest,
    Query = fastify.DefaultQuery,
    Params = fastify.DefaultParams,
    Headers = fastify.DefaultHeaders,
    Body = any
  > {
    /**
     * Request XRay Segment
     */
    XRaySegment?: AWSXRay.Segment;
  }
}

declare function fastifyXray(): void;

declare namespace fastifyXray {
  interface FastifyXrayOptions {
    defaultName: string;
  }
}

export = fastifyXray;
