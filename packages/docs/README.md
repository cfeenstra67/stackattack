Should start w/ implementing a few basic things:
- email domain (all the fiddly bits; gmail, maybe some other email provider(s)?)
- vpn
- static s3 bucket CDN
- integrations? sumo, honeycomb, etc.
- s3 bucket? w/ some best practices (encryption, etc.)
- basic server w/ an ssh key?
- app runner?
- ecs cluster?
- examples vs. tutorials?
- redis/rds cluster?
- opennext infra?
- certificate?
- ssl termination/load balancer?
- how high-level should components be? how much should I value things being decoupled vs reusing code--e.g. should I have a "domain" component that other components rely on? if not I'll end up reimplementing a bunch of things--consider my `s3Bucket` component in the Anze infra stuff
- "complete examples" -- full e2e working examples using combinations of the other components?
Need some basic docs about how to set up pulumi in a typical JS/TS project structure--stuff like the `infra` package + shared entry point aren't necessarily obvious.
    - Can use the lmk infra as one example--may as well open source that.
I'm sticking w/ minimal abstractions--just functions. However, I could still return still w/ methods--that would be an interesting idea
- Try to figure out sagemaker or EMR?
- Self-hosting common things?
    - Metabase?
- But I guess the ideal would be that all of this has _good defaults_--so the minimal code is actually really clean/small
- Github actions setup!!
- Zod for config/input?
```ts
interface ECSClusterArgs {

}

interface ECSClusterOutput {
    cluster: aws.ecs.Cluster;

}
```
