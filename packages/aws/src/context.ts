
type ContextWithPrefix<S extends string, P extends string> =
  S extends ''
  ? Context<P>
  : Context<`${S}-${P}`>;

type ContextId<S extends string, P extends string> =
  S extends ''
  ? P
  : P extends ''
  ? S
  : `${S}-${P}`;

export class Context<S extends string = ''> {
  private readonly currentPrefix: S;
  private readonly currentTags: Record<string, string>;

  constructor(
    prefix?: S,
    tags?: Record<string, string>
  ) {
    this.currentPrefix = prefix ?? '' as S;
    this.currentTags = tags ?? {};
  }

  withPrefix<P extends string>(prefix: P): ContextWithPrefix<S, P> {
    if (this.currentPrefix) {
      return new Context(`${this.currentPrefix}-${prefix}`) as ContextWithPrefix<S, P>;
    }
    return new Context(prefix) as ContextWithPrefix<S, P>;
  }

  withTags(tags: Record<string, string>): Context<S> {
    return new Context(
      this.currentPrefix,
      { ...this.currentTags, ...tags }
    );
  }

  tags(tags?: Record<string, string>): Record<string, string> {
    return { ...this.currentTags, ...tags };
  }

  id<N extends string = ''>(name?: N): ContextId<S, N> {
    if (!this.currentPrefix) {
      return (name ?? '') as ContextId<S, N>;
    }
    if (!name) {
      return this.currentPrefix as ContextId<S, N>;
    }
    return [this.currentPrefix, name].join('-') as ContextId<S, N>;
  }
}
