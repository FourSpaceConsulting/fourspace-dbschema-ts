import { TableDefinition, AuditDefinition, ColumnDefinition, AuditType, CreatedDateColumn, ModifiedByColumn, ModifiedDateColumn } from "./model";

export function primaryColumnNames(d: TableDefinition) {
    return d.primaryKey.columns;
}

export function primaryKeyColumns(d: TableDefinition) {
    return columnsByName(d, primaryColumnNames(d));
}

export function columnsByName(d: TableDefinition, colNames: ReadonlyArray<string>) {
    const colSet = new Set<string>(colNames.map(c => c.toLowerCase()));
    return d.columns.filter(c => colSet.has(c.name.toLowerCase()));
}

export function createAuditColumns(d: AuditDefinition): ColumnDefinition[] {
    const columns = [];
    console.log('Creating audit columns', d?.type);
    switch (d?.type) {
        case AuditType.createOnly:
            columns.push(CreatedDateColumn);
            columns.push(ModifiedByColumn);
            break;
        case AuditType.createUpdate:
            columns.push(CreatedDateColumn);
            columns.push(ModifiedDateColumn);
            columns.push(ModifiedByColumn);
            break;
        case AuditType.updateHistory:
            columns.push(CreatedDateColumn);
            columns.push(ModifiedDateColumn);
            columns.push(ModifiedByColumn);
            break;
    }
    return columns;
}
export function getAllColumns(d: TableDefinition) {
    return [...d.columns, ...createAuditColumns(d.audit)];
}

