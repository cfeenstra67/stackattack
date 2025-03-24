import { bucket } from '@/components/bucket.js';
import { cluster } from '@/components/cluster.js';
import { database } from '@/components/database.js';
import { service } from '@/components/service.js';
import { vpc } from '@/components/vpc.js';
import { vpn } from '@/components/vpn.js';
import { Context, context } from '@/context.js';

// type APIFunctions = Record<string, (ctx: Context, args: never) => unknown>;

const aws = {
  bucket,
  vpc,
  vpn,
  cluster,
  database,
  service,
};

// type API<F extends APIFunctions> = {
//   [key in keyof F]: 
//     undefined extends Parameters<F[key]>[1]
//     ? (args?: Parameters<F[key]>[1]) => ReturnType<F[key]>
//     : (args: Parameters<F[key]>[1]) => ReturnType<F[key]>
// };

// function api<F extends APIFunctions>(funcs: F): (ctx: Context) => API<F> {
//   return (ctx) => {
//     const out = {} as API<F>;
//     for (const [key, value] of Object.entries(funcs)) {
//       out[key as keyof F] = ((args) => value(ctx, args as never)) as never;
//     }
//     return out;
//   };
// }

// type B = API<typeof apiFunctions>;

// const apis = {
//   aws: api({
//     bucket,
//     vpc,
//     vpn,
//     cluster,
//     database,
//   })
// };

function main() {
  const ctx = context();

  const bucket = aws.bucket(ctx);
  const vpc = aws.vpc(ctx);
  const vpn = aws.vpn(ctx, vpc);
  const network = vpc.network();

  const cluster = aws.cluster(ctx, { network });
  const database = aws.database(ctx, { network });
  const service = aws.service(ctx, {
    name: 'my-nginx',
    image: 'nginx:latest',
    env: {
      DATABASE_URL: database.url
    },
    network,
    cluster
  });

  return {
    bucketName: bucket.bucket,
    clientConfig: vpn.clientConfig,
    clusterName: cluster.cluster.name,
  };
}

main();
