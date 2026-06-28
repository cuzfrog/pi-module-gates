
export type Signature = {
  modifier?: string;
  name: string;
  path?: string;
};

export type SignatureLockEntry = {
  filePath: string;
  name: string;
};

export type ModuleContract = {
  modulePath: string;
  visible: Signature[] | null;
  readonly: string[];
  sealed: string[];
  signatureLock: SignatureLockEntry[];
  prose: string;
};

export type ModuleIndex = {
  contracts: ModuleContract[];
  dirToModule: Map<string, string>;
};
