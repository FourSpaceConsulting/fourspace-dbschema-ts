import { TableDefinition, CodeDefinition } from "../../model";

export interface TableDaoBuilder {
    createModel(codeDef: CodeDefinition, d: TableDefinition, r: readonly TableDefinition[]): { modelNames: string[], code: string };
    createDaoInterface(codeDef: CodeDefinition, d: TableDefinition, r: readonly TableDefinition[]): string;
    createDaoImplementation(codeDef: CodeDefinition, d: TableDefinition, r: readonly TableDefinition[]): string;
}

