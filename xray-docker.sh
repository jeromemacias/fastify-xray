#!/bin/bash

# run this file to get a working XRay deamon
# for running the test locally

exec docker run \
  --rm \
  -e AWS_REGION=us-east-2 \
  -e AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE \
  -e AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  -p 2000:2000/udp \
  -p 2000:2000/tcp \
  amazon/aws-xray-daemon:3.2.0 -o
