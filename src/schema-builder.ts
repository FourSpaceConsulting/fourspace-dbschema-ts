import { AuditDefinition, AuditType, ColumnDefinition, ColumnType, ConstraintDefinition, CreatedDateColumn, FixedStringColumn, ForeignKeyDefinition, IntegerColumn, ModifiedByColumn, ModifiedDateColumn, PrimaryKeyType, SimpleColumn, TableDefinition, VariableStringColumn, ColumnReference, SchemaDefinition } from './model';
import { emptyArray } from './util';
import { createAuditColumns, getAllColumns } from './schema-definition-util';


export interface SchemaBuilder {
    createTables(): string;
    createDrop(): string;
}

export interface ColumnTypeMapper {
    convertBinary(c: SimpleColumn): string;
    convertBoolean(c: SimpleColumn): string;
    convertGenerated(c: IntegerColumn): string;
    convertInteger(c: IntegerColumn): string;
    convertDateTime(c: SimpleColumn): string;
    convertGuid(c: SimpleColumn): string;
    convertFixedString(c: FixedStringColumn): string;
    convertVariableString(c: VariableStringColumn): string;
}

export function mapColumnType(c: ColumnDefinition, columnTypeMapper: ColumnTypeMapper) {
    switch (c.type) {
        case ColumnType.binary:
            return columnTypeMapper.convertBinary(c);
        case ColumnType.boolean:
            return columnTypeMapper.convertBoolean(c);
        case ColumnType.datetime:
            return columnTypeMapper.convertDateTime(c);
        case ColumnType.integer:
            return columnTypeMapper.convertInteger(c);
        case ColumnType.uuid:
            return columnTypeMapper.convertGuid(c);
        case ColumnType.fixedstring:
            return columnTypeMapper.convertFixedString(c);
        case ColumnType.varstring:
            return columnTypeMapper.convertVariableString(c);
    }
    throw new Error('Unhandled type: ' + c.type);
}

export abstract class AbstractSchemaBuilder {
    protected readonly columnTypeMapper: ColumnTypeMapper;
    protected readonly userForeignKeyReference: ColumnReference;

    constructor(columnTypeMapper: ColumnTypeMapper, userForeignKeyReference: ColumnReference = null) {
        this.columnTypeMapper = columnTypeMapper;
        this.userForeignKeyReference = userForeignKeyReference;
    }

    protected createColumn(c: ColumnDefinition, d: TableDefinition): string {
        let columnType = this.createColumnType(c);
        if (c.type === ColumnType.integer && d.primaryKey.type === PrimaryKeyType.generated && d.primaryKey.columns.includes(c.name)) {
            columnType = this.columnTypeMapper.convertGenerated(c);
        }
        return c.name + ' ' + columnType + ' ' + this.createNullable(c);
    }

    protected createNullable(c: ColumnDefinition): string {
        return c.isNullable ? 'NULL' : 'NOT NULL';
    }

    protected createComment(comment: string): string {
        return '-- ' + comment;
    }

    protected createColumnType(c: ColumnDefinition): string {
        return mapColumnType(c, this.columnTypeMapper);
    }

    protected createForeignKeys(tableName: string, audit: AuditDefinition, fks: readonly ForeignKeyDefinition[]): string[] {
        const allKeys = this.appendForeignKeys(audit, fks);
        return allKeys.map(f => this.createForeignKey(tableName, f));
    }

    protected appendForeignKeys(audit: AuditDefinition, fks: readonly ForeignKeyDefinition[]): ForeignKeyDefinition[] {
        const allKeys = emptyArray(fks) ? [] : [...fks];
        allKeys.push(...this.createAuditForeignKeyDefinitions(audit));
        return allKeys;
    }

    protected createAuditForeignKeyDefinitions(audit: AuditDefinition): ForeignKeyDefinition[] {
        const auditKeys = [];
        if (audit?.type != null) {
            auditKeys.push(
                {
                    column: ModifiedByColumn.name,
                    reference: this.userForeignKeyReference
                }
            );
        }
        return auditKeys;
    }

    protected createConstraints(cs: readonly ConstraintDefinition[]): string[] {
        return emptyArray(cs) ? [] : cs.map(c => this.createConstraint(c));
    }

    protected createColumns(t: TableDefinition) {
        const cols = getAllColumns(t).map(c => this.createColumn(c, t));
        return cols;
    }

    protected orderTables(d: SchemaDefinition): readonly TableDefinition[] {
        const tableMap = d.tables.reduce((m, t) => m.set(t.name, t), new Map<string, TableDefinition>());
        const getPosition = (t: TableDefinition, m: Map<string, number>): number => {
            if (m.has(t.name)) return m.get(t.name);
            let pos = 1;
            const positions = this.appendForeignKeys(t.audit, t.foreignKeys)
                .filter(fk => fk.reference.table !== t.name) // tables can have self referencing foreign keys
                .map(fk => getPosition(tableMap.get(fk.reference.table), m));
            if (positions.length > 0) {
                pos = Math.max(...positions) + 1;
            }
            m.set(t.name, pos);
            return pos;
        }
        const positions = d.tables.reduce((m, t) => { getPosition(t, m); return m; }, new Map<string, number>());
        return Array.from(positions).sort((a, b) => a[1] - b[1]).map(a => tableMap.get(a[0]));
    }

    protected abstract createForeignKey(tableName: string, fk: ForeignKeyDefinition): string;
    protected abstract createConstraint(c: ConstraintDefinition): string;


}
