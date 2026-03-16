export interface ImportDef {
  source: string;
  specifiers: string[];
}

export interface FunctionDef {
  name: string;
  line: number;
  params: string[];
  body: string;
  isExported: boolean;
}

export interface CallDef {
  caller: string;
  callee: string;
  line: number;
}

export interface ParsedFile {
  filePath: string;
  imports: ImportDef[];
  exports: string[];
  functions: FunctionDef[];
  calls: CallDef[];
  loc: number;
}
