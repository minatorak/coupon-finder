declare module "playwright-core/lib/coreBundle" {
  interface RegistryExecutable {
    browserVersion?: string;
    directory?: string;
    downloadURLs: string[];
    executablePath(): string | undefined;
    name: string;
    title?: string;
  }

  export const registry: {
    registry: {
      findExecutable(name: string): RegistryExecutable | undefined;
    };
  };

  export const utils: {
    extractZip(archivePath: string, options: { dir: string }): Promise<void>;
  };
}
