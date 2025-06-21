import * as pulumi from '@pulumi/pulumi';
import * as saws from '@stackattack/aws';

export default () => {
  const ctx = saws.context();
  const config = new pulumi.Config();

  const domainName = config.require('domain-name');

  const bucket = saws.bucket(ctx);
  
  saws.bucketDirectory(ctx, {
    bucket,
    directory: './dist',
  });

  saws.staticSite(ctx, {
    bucket,
    domain: domainName,
    adapter: saws.astroAdapter()
  });

  return { url: `https://${domainName}` };
};
