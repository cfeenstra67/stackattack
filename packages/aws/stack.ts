import * as saws from './src/index.js';

const ctx = saws.context();

const bucket = saws.bucket(ctx);
const vpc = saws.vpc(ctx);
const vpn = saws.vpn(ctx, vpc);

const domain = 'sa-test.singlesock.co';

const certificate = saws.certificate(ctx, { domain });
const loadBalancer = saws.loadBalancer(ctx, {
  network: vpc.network('public'),
  certificate,
});

const cluster = saws.cluster(ctx, {
  network: vpc.network('private'),
  instanceType: 'a1.medium',
});
const database = saws.database(ctx, { network: vpc.network('private') });

const nginx = saws.service(ctx, {
  name: 'nginx',
  image: 'nginx:latest',
  memory: 256,
  cpu: 256,
  replicas: 1,
  env: {
    DATABASE_URL: database.url
  },
  healthcheck: {
    path: '/'
  },
  domain,
  loadBalancer,
  network: vpc.network('private'),
  cluster
});

export const bucketName = bucket.bucket;

export const clientConfig = vpn.clientConfig;

export const clusterOutput = saws.clusterToIds(cluster);

export const databaseUrl = database.url;

export const loadBalancerOutput = saws.loadBalancerToIds(loadBalancer);
