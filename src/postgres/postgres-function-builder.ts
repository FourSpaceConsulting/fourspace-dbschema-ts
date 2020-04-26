import { CommonTypeMapper } from '../common-type-mapper';
import { TableDefinition, SchemaDefinition, RelationshipDefinition, ColumnType } from '../model';
import { mapColumnType } from '../schema-builder';
import camelcase from 'camelcase';

export class PostgresFunctionBuilder {
    private readonly schemaDefinition: SchemaDefinition;

    constructor(schemaDefinition: SchemaDefinition) {
        this.schemaDefinition = schemaDefinition;
    }

    public createUpdateSchema(): string {
        // Get relationships
        const relations = this.schemaDefinition.tables.reduce((m, t) => t.relationship != null ? m.set(t.name, t) : m, new Map<string, TableDefinition>());
        const children = Array.from(relations.values()).reduce((m, r) => {
            const childName = r.relationship.childTable;
            const childDefinition = this.schemaDefinition.tables.find(t => t.name === childName);
            if (childDefinition == null) throw new Error('No child table: ' + childName);
            return m.set(childName, childDefinition);
        }, new Map<string, TableDefinition>());
        //
        return Array.from(relations.values()).map(r => {
            console.log('Function for', r.name, 'and', r.relationship.childTable);
            const childTable = children.get(r.relationship.childTable);
            console.log('Creating function ', r.name, childTable.name);
            return createParentChildDataTypes(r, childTable) +
                createParentChildUpdateProcedure(r, childTable)
        }).join('\n');
    }
}


export function createParentChildDataTypes(ptd: TableDefinition, ctd: TableDefinition): string {
    const typeMapper = new CommonTypeMapper();
    // where, what about 2 children
    const childDataVariable = 'children';
    // data type
    const parentDataType = 't_' + ptd.name.toLowerCase();
    const childDataType = 't_' + ctd.name.toLowerCase();
    const parentDataTypeColumns = ptd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
    const parentFullDataTypeColumns = parentDataTypeColumns.concat([childDataVariable + ' ' + childDataType + '[]']);
    const childDataTypeColumns = ctd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
    return `
    -- CREATE PARENT AND CHILD TYPES
    CREATE TYPE ${childDataType} AS (
        ${childDataTypeColumns.join(',\n')}
    );
    CREATE TYPE ${parentDataType} AS (
        ${parentFullDataTypeColumns.join(',\n')}
    );
`;

}

export function createParentChildUpdateProcedure(ptd: TableDefinition, ctd: TableDefinition) {
    const typeMapper = new CommonTypeMapper();
    // where to get these?
    const childDataVariable = 'children';
    const updateKeyColumn = 'response_uuid';
    //
    const procName = 'save_' + ptd.name.toLowerCase();
    const parentDataType = 't_' + ptd.name.toLowerCase();

    // col
    const parentDataTypeColumns = ptd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
    const childDataTypeColumns = ctd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
    const returnDataTypeColumns = parentDataTypeColumns.map(c => 'pt_' + c).concat(childDataTypeColumns.map(c => 'ct_' + c)).join(',\n');

    // tables
    const parentTable = ptd.name.toLowerCase();
    const childTable = ctd.name.toLowerCase();
    // columns
    const parentColumnNames = ptd.columns.map(c => c.name);
    const childColumnNames = ctd.columns.map(c => c.name);
    const parentPrimaryKey = ptd.primaryKey.columns[0];
    const childForeignKey = ctd.primaryKey.columns[0];
    const childDiscriminator = ctd.primaryKey.columns[1];
    // insert
    const parentInsertColumns = parentColumnNames.filter(c => c != parentPrimaryKey);
    const parentInsertColumnList = parentInsertColumns.join(',');
    const parentInsertValues = parentInsertColumns.map(c => 'to_save.' + c).join(',');
    const childInsertColumnsList = childColumnNames.join(',');
    const childInsertValues = childColumnNames.filter(c => c != childForeignKey).join(',');
    // update
    const parentUpdateColumns = parentColumnNames.filter(c => c != parentPrimaryKey && c != updateKeyColumn);
    const parentUpdateColumnList = parentUpdateColumns.join(',');
    const parentUpdateValues = parentUpdateColumns.map(c => 'to_save.' + c).join(',');
    const childUpdateColumns = childColumnNames.filter(c => c != childForeignKey && c != childDiscriminator);
    const childUpdateColumnList = childUpdateColumns.join(',');
    const childUpdateValuesList = childUpdateColumns.map(c => childTable + '.' + c).join(',');
    // return
    const returnParentList = parentColumnNames.map(c => 'pt.' + c).concat(childColumnNames.map(c => 'null')).join(',');
    const returnChildList = parentColumnNames.map(c => 'null').concat(childColumnNames.map(c => 'ct.' + c)).join(',');

    return `
    -- CREATE UPDATE FUNCTION
CREATE OR REPLACE FUNCTION ${procName}(to_save ${parentDataType})
RETURNS TABLE (
    ${returnDataTypeColumns}
) AS $$
declare
	v_parent_id bigint;
BEGIN
 SELECT ${parentPrimaryKey} INTO v_parent_id FROM ${parentTable} WHERE ${updateKeyColumn} = to_save.${updateKeyColumn};
 IF (v_parent_id IS NULL) THEN
 	-- insert records
 	INSERT INTO ${parentTable} (${parentInsertColumnList})
 		VALUES (${parentInsertValues}) returning ${parentPrimaryKey} into v_parent_id;
	 INSERT INTO ${childTable} (${childInsertColumnsList})
		SELECT v_parent_id, ${childInsertValues} FROM unnest(to_save.${childDataVariable});
 ELSE
	 -- update records
     UPDATE ${parentTable} SET 
         (${parentUpdateColumnList}) = 
         (${parentUpdateValues}) 
         WHERE ${parentPrimaryKey} = v_parent_id;
 	 DELETE FROM ${childTable} ct 
	 	WHERE 
		ct.${childForeignKey} = v_parent_id and
		ct.${childDiscriminator} not in (select ${childDiscriminator} FROM unnest(to_save.${childDataVariable}));
	 INSERT INTO ${childTable} (${childInsertColumnsList})
	 	SELECT v_parent_id, ${childInsertValues} FROM unnest(to_save.${childDataVariable})
		ON CONFLICT (${childForeignKey}, ${childDiscriminator}) 
		DO
		UPDATE SET (${childUpdateColumnList}) = (${childUpdateValuesList});
END IF;
 -- return values
 RETURN QUERY 
 	SELECT ${returnParentList}
	FROM ${parentTable} pt WHERE pt.${parentPrimaryKey} = v_parent_id
	UNION ALL
	SELECT ${returnChildList}
	FROM ${childTable} ct 
	WHERE ct.${childForeignKey} = v_parent_id;
END;
$$ LANGUAGE 'plpgsql'
`;

}
