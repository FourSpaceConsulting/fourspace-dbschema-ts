import { ColumnDefinition, ColumnType, TableDefinition } from "../../model";
import { pascalCase, camelCase as camelcase, snakeCase } from 'change-case';
import * as SchemaUtil from '../../schema-definition-util';

const columnMap: Map<ColumnType, string> = new Map([
    [ColumnType.binary, 'Buffer'],
    [ColumnType.fixedstring, 'string'],
    [ColumnType.varstring, 'string'],
    [ColumnType.uuid, 'string'],
    [ColumnType.integer, 'number'],
    [ColumnType.decimal, 'number'],
    [ColumnType.float, 'number'],
    [ColumnType.boolean, 'boolean'],
    [ColumnType.auditAction, 'number'],
    [ColumnType.auditTime, 'string'],
    [ColumnType.datetime, 'Date'],
]);

const columnLiteralFormatMap: Map<ColumnType, string> = new Map([
    [ColumnType.datetime, 'toMilliUtcString'],
]);

// Code specific Helpers
export function getObjectName(o: string): string {
    return pascalCase(o.toLowerCase());
}
export function getColumnObjectName(c: ColumnDefinition) {
    return camelcase(c.name.toLowerCase());
}
export function getColumnFormat(c: ColumnDefinition) {
    return columnLiteralFormatMap.get(c.type);
}
export function getTableObjectName(d: TableDefinition): string {
    return pascalCase(d.name.toLowerCase());
}
export function getColumnObjectNames(cols: ReadonlyArray<ColumnDefinition>) {
    return cols.map(getColumnObjectName);
}
export function getColumnObjectDefinitions(cols: ReadonlyArray<ColumnDefinition>) {
    return cols.map(c => camelcase(c.name) + ': ' + columnMap.get(c.type) ?? 'ERROR:' + c.type);
}
export function getDbColumnObjectDefinitions(cols: ReadonlyArray<ColumnDefinition>) {
    return cols.map(c => c.name.toLowerCase() + ': ' + columnMap.get(c.type) ?? 'ERROR:' + c.type);
}

export function getColumnSelectAsPropertyList(cs: ReadonlyArray<ColumnDefinition>) {
    return cs.map(c => `t.${c.name} AS "${getColumnObjectName(c)}"`);
}
export function getColumnSelectAsTablePrefixedList(cs: ReadonlyArray<ColumnDefinition>, prefix: string) {
    return cs.map(c => `${prefix}.${c.name} AS ${prefix}_${c.name}`);
}
export function createModel(d: TableDefinition) {
    return `export interface ${getTableObjectName(d)} { 
    ${getColumnObjectDefinitions(SchemaUtil.getAllColumns(d)).join(',\n')}
};`;
}

// DB interaction
export function createSelectStatement(table: string, selectColumns: readonly ColumnDefinition[], clauseCols: readonly ColumnDefinition[]) {
    const clauses = clauseCols.map((c, i) => `t.${c.name} = $${i + 1}`);
    const selectList = getColumnSelectAsPropertyList(selectColumns).join(',');
    return `SELECT ${selectList} FROM ${table} t WHERE ${clauses.join(' AND ')}`;
}

// export function createChildJoinSelectStatement(table: string, selectColumns: readonly ColumnDefinition[], clauseCols: readonly ColumnDefinition[]) {
//     const clauses = clauseCols.map((c, i) => `${c} = $${i + 1}`);
//     const selectList = getColumnSelectAsPropertyList(selectColumns).join(',');
//     return `SELECT ${selectList} FROM ${table} WHERE ${clauses.join(' AND ')}`;
// }


// DAO methods
export function getterName(k: readonly string[], isUniqueReturn: boolean) {
    return (isUniqueReturn ? 'getItemBy' : 'getItemsBy') + k.map(i => pascalCase(i)).join('');
}
export function createGetMethodSignature(methodName: string, isUniqueReturn: boolean, objectName: string, clauseColumns: readonly ColumnDefinition[]): string {
    const clausePropertyDefinitions = getColumnObjectDefinitions(clauseColumns);
    const clausePropertyDefinitionsList = clausePropertyDefinitions.join(',');
    const retType = isUniqueReturn ? objectName : `ReadonlyArray<${objectName}>`;
    return `${methodName}(${clausePropertyDefinitionsList}): Promise<${retType}> `;
}

export function createGetMethod(methodName: string, isUniqueReturn: boolean, table: string, objectName: string, selectColumns: readonly ColumnDefinition[], clauseColumns: readonly ColumnDefinition[]): { method: string, constants: string } {
    // select
    const statementName = `${snakeCase(methodName).toUpperCase()}_GET_STATEMENT`;
    const selectStatement = createSelectStatement(table, selectColumns, clauseColumns);
    // clauses
    const clausePropertyDefinitions = getColumnObjectDefinitions(clauseColumns);
    const clauseProperties = getColumnObjectNames(clauseColumns);
    const clausePropertyDefinitionsList = clausePropertyDefinitions.join(',');
    const clausePropertyList = clauseProperties.length === 1 ? clauseProperties.join(',') : `[${clauseProperties.join(',')}]`;
    const clauseNullCheckList = clauseProperties.map(p => `${p} == null`).join(' || ');
    //
    const retType = isUniqueReturn ? objectName : `ReadonlyArray<${objectName}>`;
    const query = `await db.query(${statementName}, ${clausePropertyList})`;
    const retQuery = isUniqueReturn ? `(${query})[0]` : query;
    return {
        method: `
public async ${methodName}(${clausePropertyDefinitionsList}): Promise<${retType}> {
if (${clauseNullCheckList}) {
    throw new Error('${objectName}::${methodName} invalid arguments');
}
const db = this.dbInterfaceProvider.getDbInterface();
return ${retQuery};
}`
        ,
        constants: `const ${statementName} = '${selectStatement}'`
    };
}
