import { readFileSync } from 'fs';
import { SchemaDefinition, ColumnDefinition, ColumnType, TableDefinition, PrimaryKeyDefinition, PrimaryKeyType, ForeignKeyDefinition, ColumnReference, ConstraintDefinition, ConstraintType, AuditDefinition, AuditType } from './model';
import { emptyArray, emptyString, toKeysBySample } from './util';

// Property testing
const tableProperties = new Set(toKeysBySample<TableDefinition>({ name: null, audit: null, columns: null, primaryKey: null, foreignKeys: null, constraints: null, relationship: null }));
const pkProperties = new Set(toKeysBySample<PrimaryKeyDefinition>({ type: null, columns: null }));
const fkProperties = new Set(toKeysBySample<ForeignKeyDefinition>({ column: null, reference: null }));
const constraintProperties = new Set(toKeysBySample<ConstraintDefinition>({ type: null, columns: null }));
const colRefProperties = new Set(toKeysBySample<ColumnReference>({ column: null, table: null }));
const auditProperties = new Set(toKeysBySample<AuditDefinition>({ type: null }));
function invalidPrimaryKeyProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !pkProperties.has(p));
}
function invalidForeignKeyProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !fkProperties.has(p));
}
function invalidAuditProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !auditProperties.has(p));
}
function invalidConstraintProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !constraintProperties.has(p));
}
function invalidForeignKeyReferenceProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !colRefProperties.has(p));
}
type errorTester<T> = (d: T) => string[];
function testProperties<T>(typeName: string, d: T, test: errorTester<T>): string[] {
    const errors = [];
    const props = test(d);
    if (props.length > 0) {
        errors.push(`${typeName} has invalid properties: ${props.join(',')}`);
    }
    return errors;
}
//

interface ErrorMap { [key: string]: TableErrors };
interface TableErrors {
    attributes: ReadonlyArray<string>;
    auditErrors: ReadonlyArray<string>;
    columns: ReadonlyArray<string>;
    pkErrors: ReadonlyArray<string>;
    fkErrors: ReadonlyArray<string>;
    constraintErrors: ReadonlyArray<string>;
}
interface ValidationData {
    isError: boolean;
    definitionErrors: ReadonlyArray<string>;
    tableErrors: ErrorMap;
}

export function parseDefinition(path: string): SchemaDefinition {
    // Read the file, and pass it to your callback
    let definition: SchemaDefinition = JSON.parse(readFileSync(path, 'utf-8'));
    const errors = validateDefinition(definition);
    if (errors.isError) {
        throw new Error('-- ERROR: Invalid schema: --\n' + formatErrors(errors));
    }
    return definition;
}

export function formatErrors(vd: ValidationData): string {
    if (!vd.isError) {
        return 'Schema is valid';
    }
    const msg: string[] = ['This schema has the following errors'];
    if (vd.definitionErrors != null && vd.definitionErrors.length > 0) {
        msg.push('--- Definition Errors: ---');
        msg.push(...vd.definitionErrors);
    }
    if (vd.tableErrors != null && Object.keys(vd.tableErrors).length > 0) {
        msg.push('--- Table Errors: ---');
        msg.push(...Object.entries(vd.tableErrors).reduce((m, [name, errors]) => {
            m.push('Table: ' + name);
            m.push(...extractErrors(errors?.attributes));
            m.push(...extractErrors(errors?.columns));
            m.push(...extractErrors(errors?.pkErrors));
            m.push(...extractErrors(errors?.fkErrors));
            m.push(...extractErrors(errors?.constraintErrors));
            m.push(...extractErrors(errors?.auditErrors));
            return m;
        }, []));
    }
    return msg.join('\n');
}

function extractErrors(e: readonly string[]) {
    return (e != null && e.length > 0) ? [...e.map(s => '  ' + s)] : [];
}


export function validateDefinition(definition: SchemaDefinition): ValidationData {
    // validate
    let tableErrors: ErrorMap = null;
    let definitionErrors: string[] = [];

    if (definition?.tables == null) {
        definitionErrors.push('No tables defined');
    } else {
        tableErrors = validateTables(definition.tables);
    }
    // return validation
    return {
        isError: hasErrorEntry(definitionErrors) || hasErrorSubentry(tableErrors),
        definitionErrors,
        tableErrors
    };
}

// Helpers
function hasErrorEntry(m: ReadonlyArray<string>): boolean {
    return !emptyArray(m);
}
function hasErrorSubentry(e: ErrorMap): boolean {
    const foundErrors = Object.entries(e).find(([name, errors]) => {
        return Object.entries(errors).find(([_, errorMsgs]) => {
            return errorMsgs != null && errorMsgs.length > 0;
        })
    })
    return foundErrors != null;
}
// Tables
function invalidTableDefinitionProperties(obj: any): string[] {
    return Object.keys(obj).filter(p => !tableProperties.has(p));
}

function validateTables(tables: ReadonlyArray<TableDefinition>): ErrorMap {
    return tables.reduce((m: ErrorMap, t, i) => {
        let tableName = t.name ?? 'Table-' + (i + 1);
        const colNames = t.columns == null ? new Set<string>() : new Set(t.columns.filter(c => c?.name != null).map(cs => cs.name));
        //
        const attributeErrors = validateTableAttributes(t);
        const columnErrors = validateColumns(t.columns);
        const pkErrors = validatePrimaryKey(t.primaryKey, colNames);
        const fkErrors = t.foreignKeys?.reduce((e, fk, i) => e.concat(validateForeignKey(fk, i, colNames)), []);
        const constraintErrors = t.constraints?.reduce((e, fk, i) => e.concat(validateConstraints(fk, i, colNames)), []);
        const auditErrors = validateAudit(t.audit)
        // check errors
        const hasAttributesError = hasErrorEntry(attributeErrors);
        const hasColumnError = hasErrorEntry(columnErrors);
        const hasPkErrors = hasErrorEntry(pkErrors);
        const hasFkErrors = hasErrorEntry(fkErrors);
        const hasConstraintErrors = hasErrorEntry(constraintErrors);
        const hasAuditErrors = hasErrorEntry(auditErrors);
        const hasError = hasAuditErrors || hasColumnError || hasAttributesError || hasPkErrors || hasFkErrors || hasConstraintErrors;
        // if errors, then add to log
        if (hasError) {
            m[tableName] = {
                columns: columnErrors,
                attributes: attributeErrors,
                pkErrors: pkErrors,
                fkErrors: fkErrors,
                constraintErrors: constraintErrors,
                auditErrors: auditErrors
            };
        }
        return m;
    }, {});

}
function validateTableAttributes(t: TableDefinition): string[] {
    let errors = [];
    if (t.name == null || t.name === '') {
        errors.push('Table has no name');
    }
    const props = invalidTableDefinitionProperties(t);
    if (props.length > 0) {
        errors.push('Table has invalid properties: ' + props.join(','));
    }
    return errors;
}
// Columns
function validateColumns(cs: ReadonlyArray<ColumnDefinition>): string[] {
    if (cs == null || cs.length === 0) {
        return ['No columns'];
    }
    return cs.reduce((m, c, i) => m.concat(validateColumn(c, i)), []);
}
function validateColumn(c: ColumnDefinition, i: number): string[] {
    const columnErrors = [];
    const colName = c.name ?? i.toString();
    // name
    emptyString(c.name) && columnErrors.push('Column <' + colName + '> has no name');
    // type
    Object.values(ColumnType).includes(c.type) || columnErrors.push('Column <' + colName + '> has invalid type: ' + c.type);
    // return errors
    return columnErrors;
}
// Keys

function validatePrimaryKey(k: PrimaryKeyDefinition, colNames: Set<string>) {
    const typeName = 'Primary Key';
    if (k == null) {
        return [`${typeName} not defined`];
    }
    const errors = [];
    // type
    Object.values(PrimaryKeyType).includes(k.type) || errors.push('Primary Key has invalid type: ' + k.type);
    // test props
    errors.push(...testProperties(typeName, k, invalidPrimaryKeyProperties));
    // cols
    errors.push(...testColumns(typeName, colNames, k.columns));
    // return errors;
    return errors;
}

function validateForeignKey(k: ForeignKeyDefinition, i: number, colNames: Set<string>) {
    let typeName = 'Foreign Key';
    if (k == null) {
        return [`${typeName} not defined`];
    }
    typeName = `${typeName} ${k.column ?? 'FK-' + (i + 1)}`;
    const errors = [];
    // test props
    errors.push(...testProperties(typeName, k, invalidForeignKeyProperties));
    // cols
    errors.push(...testColumns(typeName, colNames, [k.column]));
    // references
    if (k.reference == null) {
        errors.push(`${typeName} is missing reference`);
    } else {
        errors.push(...testProperties(typeName + ' reference', k.reference, invalidForeignKeyReferenceProperties));
    }
    // return errors;
    return errors;
}

function validateAudit(d: AuditDefinition) {
    const typeName = `AuditDefinition`;
    if (d == null) {
        return [];//[`${typeName} not defined`];
    }
    const errors = [];
    // test type
    Object.values(AuditType).includes(d.type) || errors.push(`${typeName} has invalid type: ${d.type}`);
    // test props
    errors.push(...testProperties(typeName, d, invalidAuditProperties));
    // return errors;
    return errors;
}


function validateConstraints<T>(d: ConstraintDefinition, i: number, colNames: Set<string>) {
    const typeName = `Constraint ${(i + 1)}`;
    if (d == null) {
        return [`${typeName} not defined`];
    }
    const errors = [];
    // test type
    Object.values(ConstraintType).includes(d.type) || errors.push(`${typeName} has invalid type: ${d.type}`);
    // test props
    errors.push(...testProperties(typeName, d, invalidConstraintProperties));
    // cols
    errors.push(...testColumns(typeName, colNames, d.columns));
    // return errors;
    return errors;
}

function testColumns(typeName: string, colNames: Set<string>, columns: ReadonlyArray<string>): string[] {
    const errors = [];
    if (emptyArray(columns)) {
        errors.push(`${typeName} has no columns`);
    } else {
        errors.push(...columns.reduce((e, c) => e.concat(colNames.has(c) ? [] : [`${typeName} column <${c}> does not exist`]), []));
    }
    return errors;
}


