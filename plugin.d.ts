import * as AWSXRay from "aws-xray-sdk-core";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * AWSXRay custom instance
     */
    AWSXRay?: any;
  }

  interface FastifyRequest {
    /**
     * Request XRay Segment
     */
    segment?: AWSXRay.Segment;
  }
}

declare function fastifyXray(): void;

declare namespace fastifyXray {
  interface FastifyXrayOptions {
    defaultName: string;
    AWSXRay?: any;
  }
}

export = fastifyXray;
