import { TableDefinition, PrimaryKeyType } from './model';
import { SchemaDefinition, ColumnType, ColumnDefinition } from "./model";

export interface SequelizeBuilder {
    createSequelizeModel(): string;
}

export class SequelizeBuilderImpl implements SequelizeBuilder {
    private readonly schemaDefinition: SchemaDefinition;

    constructor(schemaDefinition: SchemaDefinition) {
        this.schemaDefinition = schemaDefinition;
    }

    createSequelizeModel(): string {
        return this.schemaDefinition.tables.map(t =>
            [
                createInterface(t.name.toUpperCase(), t.columns),
                createModel(t.name.toUpperCase(), t)
            ].join('\n')
        ).join('\n');
    }
}

const sequelizeMap: Map<string, string> = new Map([
    [mapType(ColumnType.fixedstring), 'STRING'],
    [mapType(ColumnType.varstring), 'STRING'],
    [mapType(ColumnType.uuid), 'UUID'],
    [mapType(ColumnType.integer, '2'), 'SMALLINT'],
    [mapType(ColumnType.integer, '4'), 'INTEGER'],
    [mapType(ColumnType.integer, '8'), 'BIGINT'],
    [mapType(ColumnType.integer), 'INTEGER'],
    [mapType(ColumnType.decimal), 'DECIMAL'],
    [mapType(ColumnType.float), 'FLOAT'],
    [mapType(ColumnType.boolean), 'BOOLEAN'],
    [mapType(ColumnType.auditAction), 'STRING'],
    [mapType(ColumnType.auditTime), 'STRING'],
    [mapType(ColumnType.datetime), 'DATE'],
]);
function mapType(c: ColumnType, flag?: string) {
    return c.toString() + (flag == null ? '' : ':' + flag);
}

const columnMap: Map<ColumnType, string> = new Map([
    [ColumnType.fixedstring, 'string'],
    [ColumnType.varstring, 'string'],
    [ColumnType.uuid, 'string'],
    [ColumnType.integer, 'number'],
    [ColumnType.decimal, 'number'],
    [ColumnType.float, 'number'],
    [ColumnType.boolean, 'boolean'],
    [ColumnType.auditAction, 'number'],
    [ColumnType.auditTime, 'string'],
    [ColumnType.datetime, 'string'],
]);

function createInterface(name: string, cols: readonly ColumnDefinition[]): string {
    return [
        'interface ' + interfaceName(name) + ' extends Model {',
        ...cols.map(c => mapInterfaceColumn(c)),
        '}'
    ].join('\n');
}
function mapInterfaceColumn(col: ColumnDefinition): string {
    const tsType = columnMap.get(col.type);
    if (tsType == null) throw new Error('Unmapped column type ' + col.type);
    return ' readonly ' + col.name.toLowerCase() + ': ' + tsType + ';';
}
function createModel(name: string, t: TableDefinition): string {
    const iName = interfaceName(name);
    const staticName = 'Model_' + name + '_Static';
    return [
        'type ' + staticName + ' = typeof Model & {',
        '   new(values?: object, options?: BuildOptions): ' + iName + ';',
        '};',
        '',
        'function create' + name + 'Model(sq: Sequelize): ' + staticName + ' {',
        '  return <' + staticName + '>sq.define(\'' + t.name.toLowerCase() + '\', {',
        '\t //attributes',
        ...t.columns.map(c => mapModelColumn(c, t)),
        '}, {',
        '// options',
        '});',
        '}'
    ].join('\n');
}
function interfaceName(name: string) {
    return 'I' + name + '_Model';
}
function mapModelColumn(col: ColumnDefinition, t: TableDefinition): string {
    const isPrimary = new Set(t.primaryKey.columns).has(col.name);
    const primary = isPrimary ? 'primaryKey: true, \n' : '';
    const generated = t.primaryKey.type === PrimaryKeyType.generated && isPrimary ? 'autoIncrement: true,\n' : '';
    const name = col.name.toLowerCase();
    return [
        name + ': {',
        'type: ' + mapDataType(col) + ',',
        primary + generated +
        'allowNull:' + (col.isNullable ? 'true,' : 'false,'),
        '},',
    ].join('\n');
}
function mapDataType(col: ColumnDefinition) {
    let flag: string = null;
    switch (col.type) {
        case ColumnType.integer:
            flag = col.size?.toString();
    }
    const sqType = sequelizeMap.get(mapType(col.type, flag));
    if (sqType == null) throw new Error('Unmapped sequelized column type ' + col.type);
    return 'DataTypes.' + sqType;
}
