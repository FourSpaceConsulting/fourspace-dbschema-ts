import { ColumnDefinition, TableDefinition, ColumnType } from './../../model';
import * as SchemaUtil from '../../schema-definition-util';
import camelcase from 'camelcase';

export class AbstractDaoBuilder {

    // DAO writer
    protected dbDaoHeader(objectName: string): string {
        return `
export class ${objectName}DbDao implements ${objectName}Dao {
    private readonly dbInterfaceProvider: DbInterfaceProvider;

    constructor(dbInterfaceProvider: DbInterfaceProvider) {
        this.dbInterfaceProvider = dbInterfaceProvider;
    }`;
    }
    protected daoHeader(objectName: string): string {
        return `
export interface ${objectName}Dao {`;
    }



    protected objectName(d: TableDefinition): string {
        return camelcase(d.name.toLowerCase(), { pascalCase: true });
    }
    protected objectProperties(d: TableDefinition): string[] {
        return d.columns.map(c => camelcase(c.name));
    }
    //     protected createObject(d: TableDefinition) {
    //         this.objectName(d);
    //         return `
    // export interface ${this.objectName(d)} { 
    //     ${this.objectPropertyDefinitions(SchemaUtil.getAllColumns(d)).join(',\n')}
    // }`;
    //     }

    // Code specific Helpers
    protected columnObjectNames(cols: ReadonlyArray<ColumnDefinition>) {
        return cols.map(c => camelcase(c.name.toLowerCase()));
    }

    // protected primaryColumnObjectDefinitions(d: TableDefinition) {
    //     const pk = new Set<string>(this.primaryColumnNames(d));
    //     const pkCols = d.columns.filter(c => pk.has(c.name.toLowerCase()));
    //     return this.objectPropertyDefinitions(pkCols);
    // }

    // def helpers
    protected tableName(d: TableDefinition) {
        return d.name.toLowerCase();
    }

    protected primaryKeyColumns(d: TableDefinition) {
        const pk = new Set<string>(this.primaryColumnNames(d));
        return d.columns.filter(c => pk.has(c.name.toLowerCase()));
    }

    protected columnsByName(d: TableDefinition, colNames: ReadonlyArray<string>) {
        const colSet = new Set<string>(colNames.map(c => c.toLowerCase()));
        return d.columns.filter(c => colSet.has(c.name.toLowerCase()));
    }

    protected primaryColumnNames(d: TableDefinition) {
        return d.primaryKey.columns.map(c => c.toLowerCase());
    }


    protected columnSelectAsPropertyList(cs: ReadonlyArray<ColumnDefinition>) {
        return cs.map(c => `t.${c.name.toLowerCase()} AS "${camelcase(c.name)}"`);
    }

    protected selectPrimaryKeyStatement(d: TableDefinition) {
        const primaryKeys = this.primaryColumnNames(d);
        const keyClauses = primaryKeys.map((k, i) => `${k} = $${i + 1}`);
        const selectList = this.columnSelectAsPropertyList(d.columns).join(',');
        return `SELECT ${selectList} FROM ${this.tableName(d)} WHERE ${keyClauses.join(' AND ')}`;

    }

    // protected selectStatement(table: string, selectColumns: string, clauseColNames: readonly string[]) {
    //     const clauses = clauseColNames.map((c, i) => `${c} = $${i + 1}`);
    //     const selectTableColumns = columnSelectAsPropertyList(selectColumns);

    //     const selectList = this.columnSelectAsPropertyList(d.columns).join(',');
    //     return `SELECT ${selectList} FROM ${this.tableName(d)} WHERE ${keyClauses.join(' AND ')}`;

    // }




}
