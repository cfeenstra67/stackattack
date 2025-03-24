import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const ipRangesUrl = "https://ip-ranges.amazonaws.com/ip-ranges.json";

export function getEc2InstanceConnectCidr(
  region?: pulumi.Input<string>,
): pulumi.Output<string> {
  if (region === undefined) {
    region = aws.getRegionOutput().name;
  }

  return pulumi.output(region).apply(async (regionName) => {
    const response = await fetch(ipRangesUrl);
    const json = await response.json();
    const result = json.prefixes.find((prefix) => {
      if (prefix.service !== "EC2_INSTANCE_CONNECT") {
        return false;
      }
      if (prefix.region !== regionName) {
        return false;
      }

      return true;
    });
    if (!result) {
      throw new Error(`EC2 connect ip range for ${regionName} not found`);
    }

    return result.ip_prefix as string;
  });
}
