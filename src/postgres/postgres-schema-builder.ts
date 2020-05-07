import { SchemaBuilder, AbstractSchemaBuilder } from '../schema-builder';
import { SchemaDefinition, PrimaryKeyDefinition, ForeignKeyDefinition, ConstraintDefinition, ConstraintType } from '../model';
import { CommonTypeMapper } from '../common-type-mapper';

export class PostgresSchemaBuilder extends AbstractSchemaBuilder implements SchemaBuilder {
    private readonly schemaDefinition: SchemaDefinition;

    constructor(schemaDefinition: SchemaDefinition) {
        super(new CommonTypeMapper(), schemaDefinition.references?.auditUserId);
        this.schemaDefinition = schemaDefinition;
    }

    public createTables(): string {
        const tableCreate: string[] = [];
        this.orderTables(this.schemaDefinition).map(t => {
            console.log('CREATING', t.name);
            // Comment
            tableCreate.push(this.createComment('Creating ' + t.name));
            // Create table
            tableCreate.push('create table ' + t.name + '(');
            // Content
            const tableContent: string[] = [];
            // Columns
            tableContent.push(...this.createColumns(t));
            // PK
            tableContent.push(this.createPrimaryKey(t.primaryKey));
            // FK
            tableContent.push(...this.createForeignKeys(t.name, t.audit, t.foreignKeys));
            // constraints
            tableContent.push(...this.createConstraints(t.constraints));
            // append content            
            tableCreate.push(tableContent.map(c => '  ' + c).join(',\n'));
            // End
            tableCreate.push(')' + this.createTablespace() + ';');
        });
        return tableCreate.join('\n');
    }

    private createTablespace(): string {
        return '';
    }

    private createPrimaryKey(pk: PrimaryKeyDefinition) {
        return 'PRIMARY KEY (' + pk.columns.map(c => c.toLowerCase()).join(',') + ')';
    }

    protected createConstraint(c: ConstraintDefinition): string {
        if (c.type === ConstraintType.unique) {
            return 'UNIQUE (' + c.columns.join(',') + ')';
        }
        return '';
    }

    protected createForeignKey(tableName: string, fk: ForeignKeyDefinition) {
        console.log(fk, 'FK', fk.column);
        const col = fk.column.toLowerCase();
        const refTable = fk.reference.table.toLowerCase();
        const refColumn = fk.reference.column.toLowerCase();
        return `CONSTRAINT ${tableName}_${refTable}_${refColumn}_${col} FOREIGN KEY (${col})
                REFERENCES ${refTable} (${refColumn}) MATCH SIMPLE 
                ON UPDATE NO ACTION ON DELETE NO ACTION`;
    }


    createDrop(): string {
        throw new Error("Method not implemented.");
    }

}