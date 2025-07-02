# Astro Static Site Example

This example deploys an astro static site to cloudfront. The final result is a static site served at a custom domain over HTTPs, with appropriate caching headers set for static resources.

The actual code is just the default starter Astro project; it was created with:
```sh
npm create astro@latest -- --template basics
```

To deploy:

**Note: in order to actually deploy this you must have a Route53 zone with a custom domain in AWS**

1. Create a stack
```bash
pulumi stack init prod
```

2. Modify the domain name to be your custom domain or a subdomain:
```bash
pulumi config set domain www.yourdomain.com
```

3. Deploy the stack
```bash
pulumi up
```

After deployment, you should be able to access the site at https://www.yourdomain.com.
