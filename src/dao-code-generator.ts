import { SchemaDefinition } from './model';

export interface DaoCode {
    model: { modelNames: readonly string[], code: string };
    daoInterface: string;
    daoImplementation: string;
}

export interface DaoCodeGenerator {
    generateDaoCode(d: SchemaDefinition): Map<string, DaoCode>;
}