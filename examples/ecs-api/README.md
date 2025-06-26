# ECS API Example

This example deploys two stacks: an environment and an API service. The final result is an express app running in a docker container on an EC2 instance in an ECS cluster. It uses an RDS Postgres instance to store data, and applies its migrations before the app starts up (in a separate "init" container).

To deploy:

**Note: in order to actually deploy this you must have a Route53 zone with a custom domain in AWS**

1. Create the stacks:
```bash
pulumi stack init api
pulumi stack init env
```

2. Modify the domain names to be subdomains of your custom API:
```bash
pulumi -s env config set domain ecs-api.yourdomain.com
pulumi -s api config set domain api.ecs-api.yourdomain.com
```

3. Deploy the `env` stack:
```bash
pulumi up -s env
```
That will deploy most of the infrastructure resources like the ECS cluster, the RDS instance, and the load balancer.

4. Build and push the API container:
```bash
./scripts/build-and-push.sh
```
That will build the API container and push it to the ECR repository that was created as part of the `env` stack. The `api` stack will deploy this image.

5. Deploy the `api` stack:
```bash
pulumi up -s api
```
That will deploy the API; the service w/ the current configuration will be available at https://api.ecs-api.yourdomain.com.
