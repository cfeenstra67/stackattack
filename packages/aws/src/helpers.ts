import * as pulumi from '@pulumi/pulumi';

export type ResourceInput<R extends { id: pulumi.Input<string> }, G extends { id: pulumi.Input<string> }> = pulumi.Input<string> | pulumi.Input<R> | pulumi.Input<G>;

export interface ResourceIdGetter<R extends { id: pulumi.Input<string> }, G extends { id: pulumi.Input<string> }> {
  (input: ResourceInput<R, G>): pulumi.Output<string>;
  $input: ResourceInput<R, G>;
}

export function resourceIdGetter<R extends { id: pulumi.Input<string> }, G extends { id: pulumi.Input<string> }>(): ResourceIdGetter<R, G> {
  return ((input) => pulumi.output(input).apply((value) => {
    if (typeof value === 'string') {
      return pulumi.output(value);
    }
    return pulumi.output(value.id);
  })) as ResourceIdGetter<R, G>;
}
