export type Signature = {
  modifier?: string;
  name: string;
};

export type ModuleContract = {
  modulePath: string;
  visible: Signature[] | null;
  readonly: string[];
  prose: string;
};

export type ModuleIndex = {
  contracts: ModuleContract[];
  dirToModule: Map<string, string>;
};
