# Vite Static Site

This is the default vite starter app with React + Typescript selected. This example deploys this app to cloudfront; the final result is a static site at a custom domain served over HTTPS, with appropriate caching headers set for static resources.

To deploy:

**Note: in order to actually deploy this you must have a Route53 zone with a custom domain in AWS**

1. Build the app
```bash
pnpm build
```

3. Modify the domain name to be your custom domain or a subdomain:
```bash
pulumi config set domain www.yourdomain.com
```

4. Deploy the stack
```bash
pulumi up
```

After deployment, you should be able to access the site at https://www.yourdomain.com.
