declare module 'refractor' {
  import { Root } from 'hast';

  interface RefractorSyntax {
    aliases?: string[];
    displayName?: string;
    [key: string]: unknown;
  }

  interface Refractor {
    highlight(value: string, language: string): Root;
    register(syntax: RefractorSyntax): void;
    registered(language: string): boolean;
    alias(name: string, alias: string | string[]): void;
    listLanguages(): string[];
  }

  const refractor: Refractor;
  export default refractor;
}
