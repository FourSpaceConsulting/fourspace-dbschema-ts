import { CommonTypeMapper } from '../common-type-mapper';
import { SchemaDefinition, ConstraintDefinition, ConstraintType } from '../model';
import { AbstractSchemaBuilder, SchemaBuilder } from '../schema-builder';

export class OracleSchemaBuilder extends AbstractSchemaBuilder implements SchemaBuilder {
    protected createForeignKey(tableName: string, fk: import("../model").ForeignKeyDefinition): string {
        throw new Error("Method not implemented.");
    }
    private readonly schemaDefinition: SchemaDefinition;

    constructor(schemaDefinition: SchemaDefinition) {
        super(new CommonTypeMapper());
        this.schemaDefinition = schemaDefinition;
    }

    public createTables(): string {
        const tableSpace = '';
        let tableCreate: string[] = [];
        this.schemaDefinition.tables.map(t => {
            tableCreate.push('create table ' + t.name + '(');
            tableCreate = tableCreate.concat(t.columns.map(c => this.createColumn(c, t)));
            tableCreate.push(')' + tableSpace + ';');
        });
        return tableCreate.join('\n');
    }

    createDrop(): string {
        throw new Error("Method not implemented.");
    }

    protected createConstraint(c: ConstraintDefinition): string {
        if (c.type === ConstraintType.unique) {
            return 'UNIQUE (' + c.columns.join(',') + ')';
        }
        return '';
    }


}