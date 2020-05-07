export enum ColumnType {
    binary = "binary",
    boolean = "boolean",
    uuid = "uuid",
    integer = "integer",
    float = "float",
    decimal = "decimal",
    varstring = "variable-string",
    fixedstring = "fixed-string",
    datetime = "datetime",
    auditTime = "audit-time",
    auditAction = "audit-action"
}
export enum PrimaryKeyType {
    generated = "generated",
    natural = "natural"
}
export enum ConstraintType {
    unique = "unique"
}
export enum AuditType {
    createOnly = "create-only",
    createUpdate = "create-update",
    updateHistory = "update-history",

}
export enum RelationshipType {
    oneOwnsMany = "one-owns-many"
}

export interface Config {
    useAutoColumns: boolean;
    namespace: string;
    toUpper: boolean;
}

export interface SchemaDefinition {
    tables: ReadonlyArray<TableDefinition>;
    references: SchemaReferences;
    codeGenerator: ReadonlyArray<CodeDefinition>;
}

export interface CodeDefinition {
    table: string;
    getKeys: ReadonlyArray<ReadonlyArray<string>>;
    queryKeys: ReadonlyArray<ReadonlyArray<string>>;
}

export interface SchemaReferences {
    auditUserId: ColumnReference
}

export interface OneToManyRelationshipDefinition {
    type: RelationshipType.oneOwnsMany;
    childTable: string;
}
export type RelationshipDefinition = OneToManyRelationshipDefinition;

export interface TableDefinition {
    name: string;
    audit: AuditDefinition;
    columns: ReadonlyArray<ColumnDefinition>;
    primaryKey: PrimaryKeyDefinition;
    foreignKeys: ReadonlyArray<ForeignKeyDefinition>;
    constraints: ReadonlyArray<ConstraintDefinition>;
    relationship?: RelationshipDefinition;
}
export interface ColumnReference {
    table: string;
    column: string;
}
export interface StandardColumnDefinition {
    name: string;
    type: ColumnType;
    isNullable: boolean;
}
export interface VariableStringColumn extends StandardColumnDefinition {
    type: ColumnType.varstring;
    length: number;
    isSurrogatePairEncoding?: boolean;
}
export interface FixedStringColumn extends StandardColumnDefinition {
    type: ColumnType.fixedstring;
    size: number;
    isSurrogatePairEncoding?: boolean;
}

export interface IntegerColumn extends StandardColumnDefinition {
    type: ColumnType.integer;
    size?: number;
}
export interface FloatColumn extends StandardColumnDefinition {
    type: ColumnType.float;
    size?: number;
}
export interface DecimalColumn extends StandardColumnDefinition {
    type: ColumnType.decimal;
    precision?: number;
    scale?: number;
}
export interface SimpleColumn extends StandardColumnDefinition {
    type: ColumnType.binary | ColumnType.uuid | ColumnType.boolean | ColumnType.auditTime | ColumnType.datetime;
}
export type ColumnDefinition = FixedStringColumn | VariableStringColumn | IntegerColumn | FloatColumn | DecimalColumn | SimpleColumn;

export interface PrimaryKeyDefinition {
    type: PrimaryKeyType;
    columns: ReadonlyArray<string>;
}
export interface ForeignKeyDefinition {
    column: string;
    reference: ColumnReference;
}
export interface ConstraintDefinition {
    type: ConstraintType;
    columns: ReadonlyArray<string>;
}
export interface AuditDefinition {
    type: AuditType;
}

export const CreatedDateColumn: ColumnDefinition = {
    type: ColumnType.datetime,
    name: 'created_date',
    isNullable: false
}

export const ModifiedDateColumn: ColumnDefinition = {
    type: ColumnType.datetime,
    name: 'modified_date',
    isNullable: false
}
export const ModifiedByColumn: ColumnDefinition = {
    type: ColumnType.integer,
    size: 8,
    name: 'modified_by',
    isNullable: true
}