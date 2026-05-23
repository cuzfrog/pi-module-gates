export type ModuleContract = {
  modulePath: string;
  visible: string[] | null;
  readonly: string[];
  prose: string;
};

export type ModuleIndex = {
  contracts: ModuleContract[];
  dirToModule: Map<string, string>;
};
