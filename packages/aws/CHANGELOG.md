# @stackattack/aws

## 0.3.0

### Minor Changes

- 20c4a6b: Move google site verification to separate component from gmail domain
- 3a6ed82: Add twingate component

### Patch Changes

- d961b2d: Docs update
- 5860fa7: Add missing exports
- 3a6ed82: Rename twingate to twingate-connector
- 6b91c77: Fix log analytics env var for twingate
- b154d1a: Added CJS build

## 0.3.0-dev.3

### Patch Changes

- Docs update

## 0.3.0-dev.2

### Patch Changes

- Fix log analytics env var for twingate

## 0.3.0-dev.1

### Patch Changes

- 5860fa7: Add missing exports

## 0.3.0-dev.0

### Minor Changes

- 20c4a6b: Move google site verification to separate component from gmail domain
- 3a6ed82: Add twingate component

### Patch Changes

- 3a6ed82: Rename twingate to twingate-connector
- b154d1a: Added CJS build

## 0.2.2

### Patch Changes

- df2ae54: Tweak defaults
- 0eb729f: Fix vpc
- 87e3ba4: Change vpc defaults

## 0.2.1

### Patch Changes

- Update npm README

## 0.2.0

### Minor Changes

- 6a00ce2: Allow passing openIdProvider: null to github role to lookup provider

### Patch Changes

- c68d3a9: Improve package.json + make dependencies looser

## 0.1.0

### Minor Changes

- 10e33a8: Removed BucketOutput
- 130889c: Initial release
- 9ac7147: Added way to share resources between stacks
- 60d6cea: Added ability to use spot instances w/ mixed instances policy to cluster, including auto-excluding instance types that do not support ENI trunking

### Patch Changes

- ab17c84: Make bucketFiles part of bucket component
- 82643fd: Security group-based auth for load balancer egress
- d8b46c1: Export serviceAssumeRolePolicy
- cebed40: Fix build
- 257484b: Fix ttl value
- afbaf62: Default to no explicit security groups for service
- 953a21b: Added docs to new components
- 094143f: Added static site component + bucket directory
- 5479fac: Fix redis instance id
- 3c9d61b: Added email domain resource
- 05d9ac3: Docs fixes
- 123802c: Add provider arg to certificate component
- fa859d6: Fix BucketInput -> pulumi.Input<BucketInput>
- 5610339: service default security group
- b5be757: Fix email domain noVerify
- 5d6bfc3: Fix stackRef for stack functions that take arguments, fix output coercion
- 3120390: Improve google domain
- 8053a34: Added vercel domain
- bf0db2d: Fix cluster instances security group
- 4b536eb: Adding more infra from lmk
- 58e886a: Add default group rule for load balancer group
- 2b2c8dc: Added github role component
- 46428ec: Initial working ECS setup
- 07348c2: Spot instance draining
- 435b3e7: Fix ARN parsing in s3 firehose code
- 12e0886: Fix static site component, deploy docs
- 17af4a8: Fixed securityGroups arg in service component
- 05d9ac3: Docs improvements
- 094143f: Bucket directory resource
- eca39bd: Working on docs; formatting
- 3b5b8fc: Add deployment check and fix excluded families for ENI trunking
- 2dbc4ab: Fixed exports
- 521042c: Fix stackRef type
- 5ed1776: Limit what's in the bundle to relevant things
- b0bd620: headerBehavior: none w/ no lambda function in static site
- 8b62b7f: Vercel domain
- 4c5bc94: Added ec2 instance connect endpoint per subnet to vpc
- a84b5b4: Added s3 firehose resource
- f0ad98e: Make static site component more general
- 8f2279a: Add loadBalancerListenerCertificate
- 3f61818: bucketDirectory -> bucketFiles
- 65af758: Create static site certificate in us-east-1
- 127663e: Added essential: false to init container
- 69bc860: Added typedoc comments
- 44e1b53: Docs improvements
- 5afe431: Fix MX record
- b3e48e1: Protect VPN certificate + do not recreate if command changes
- b333a0d: Add more email domain options
- 84e12a4: Export gmail domain
- 418bb3e: Include compiled JS in bundle
- 1b5abb0: Fix type issue
- e7cdccc: Allow no prefix in context
- a22d86c: Add loadBalancerListenerToIds function
- 3e80558: Added noValidate option for certificate
- b39f6ee: Use security-group based ingress for services
- 2dbc4ab: export new components

## 0.1.0-dev.48

### Minor Changes

- 10e33a8: Removed BucketOutput

### Patch Changes

- 05d9ac3: Docs fixes
- 05d9ac3: Docs improvements
- 44e1b53: Docs improvements

## 0.1.0-dev.47

### Patch Changes

- Allow no prefix in context

## 0.1.0-dev.46

### Patch Changes

- Fix cluster instances security group

## 0.1.0-dev.45

### Patch Changes

- Added ec2 instance connect endpoint per subnet to vpc

## 0.1.0-dev.44

### Patch Changes

- Make bucketFiles part of bucket component

## 0.1.0-dev.43

### Patch Changes

- headerBehavior: none w/ no lambda function in static site

## 0.1.0-dev.42

### Patch Changes

- Create static site certificate in us-east-1

## 0.1.0-dev.41

### Patch Changes

- Added github role component

## 0.1.0-dev.40

### Patch Changes

- Make static site component more general

## 0.1.0-dev.39

### Patch Changes

- 3f61818: bucketDirectory -> bucketFiles

## 0.1.0-dev.38

### Patch Changes

- Fix BucketInput -> pulumi.Input<BucketInput>

## 0.1.0-dev.37

### Patch Changes

- Fix static site component, deploy docs

## 0.1.0-dev.36

### Patch Changes

- Add provider arg to certificate component

## 0.1.0-dev.35

### Patch Changes

- 953a21b: Added docs to new components

## 0.1.0-dev.34

### Patch Changes

- Fix type issue

## 0.1.0-dev.33

### Patch Changes

- Added static site component + bucket directory
- 3120390: Improve google domain
- Bucket directory resource

## 0.1.0-dev.32

### Patch Changes

- Vercel domain

## 0.1.0-dev.31

### Patch Changes

- Added vercel domain
- eca39bd: Working on docs; formatting
- 69bc860: Added typedoc comments

## 0.1.0-dev.30

### Patch Changes

- Export serviceAssumeRolePolicy

## 0.1.0-dev.29

### Patch Changes

- Fix MX record

## 0.1.0-dev.28

### Patch Changes

- Fix ttl value

## 0.1.0-dev.27

### Patch Changes

- Fix build

## 0.1.0-dev.26

### Patch Changes

- Export gmail domain

## 0.1.0-dev.25

### Patch Changes

- Adding more infra from lmk

## 0.1.0-dev.24

### Patch Changes

- Fix ARN parsing in s3 firehose code

## 0.1.0-dev.23

### Patch Changes

- Fix email domain noVerify

## 0.1.0-dev.22

### Patch Changes

- Add more email domain options

## 0.1.0-dev.21

### Patch Changes

- Add default group rule for load balancer group

## 0.1.0-dev.20

### Patch Changes

- Fixed securityGroups arg in service component

## 0.1.0-dev.19

### Patch Changes

- service default security group

## 0.1.0-dev.18

### Patch Changes

- Security group-based auth for load balancer egress

## 0.1.0-dev.17

### Patch Changes

- Spot instance draining

## 0.1.0-dev.16

### Patch Changes

- Add deployment check and fix excluded families for ENI trunking

## 0.1.0-dev.15

### Patch Changes

- Default to no explicit security groups for service

## 0.1.0-dev.14

### Patch Changes

- b39f6ee: Use security-group based ingress for services

## 0.1.0-dev.13

### Patch Changes

- 127663e: Added essential: false to init container

## 0.1.0-dev.12

### Patch Changes

- 8f2279a: Add loadBalancerListenerCertificate

## 0.1.0-dev.11

### Patch Changes

- 3e80558: Added noValidate option for certificate

## 0.1.0-dev.10

### Patch Changes

- a22d86c: Add loadBalancerListenerToIds function

## 0.1.0-dev.9

### Patch Changes

- 521042c: Fix stackRef type

## 0.1.0-dev.8

### Patch Changes

- 5d6bfc3: Fix stackRef for stack functions that take arguments, fix output coercion

## 0.1.0-dev.7

### Patch Changes

- 5479fac: Fix redis instance id

## 0.1.0-dev.6

### Patch Changes

- 2dbc4ab: Fixed exports
- 2dbc4ab: export new components

## 0.1.0-dev.5

### Patch Changes

- 3c9d61b: Added email domain resource
- a84b5b4: Added s3 firehose resource
- b3e48e1: Protect VPN certificate + do not recreate if command changes

## 0.1.0-dev.4

### Minor Changes

- 60d6cea: Added ability to use spot instances w/ mixed instances policy to cluster, including auto-excluding instance types that do not support ENI trunking

## 0.1.0-dev.3

### Minor Changes

- 9ac7147: Added way to share resources between stacks

## 0.0.2-dev.2

### Patch Changes

- 5ed1776: Limit what's in the bundle to relevant things

## 0.0.2-dev.1

### Patch Changes

- 418bb3e: Include compiled JS in bundle

## 0.0.2-dev.0

### Patch Changes

- 46428ec: Initial working ECS setup

## 0.0.1

### Patch Changes

- Initial version

## 0.0.1-next.0

### Patch Changes

- Initial version
