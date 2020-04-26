import { CodeDefinition } from './../../model';
import { GeneratingKeyTableCodeBuilder } from './single-table-dao-builder';
import { DaoCodeGenerator, DaoCode } from '../../dao-code-generator';
import { CommonTypeMapper } from '../../common-type-mapper';
import { TableDefinition, SchemaDefinition, RelationshipDefinition, ColumnType } from '../../model';
import { mapColumnType } from '../../schema-builder';
import camelcase from 'camelcase';
import { OneOwnsManyTableCodeBuilder } from './owner-table-dao-builder';

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

export class PostgresTypescriptDaoBuilder implements DaoCodeGenerator {

    public generateDaoCode(d: SchemaDefinition): Map<string, DaoCode> {
        // create relationships
        const [relations, children] = createRelationships(d);
        const b = new GeneratingKeyTableCodeBuilder();
        const rb = new OneOwnsManyTableCodeBuilder();

        const codeDefs = (d.codeGenerator ?? []).reduce((m, d) => m.set(d.table.toLowerCase(), d), new Map<string, CodeDefinition>());
        // create single
        const indepTables = d.tables.filter(t => t.relationship == null && !children.has(t.name)).reduce((m, t) => {
            const daoDef = codeDefs.get(t.name.toLowerCase());
            return m.set(t.name.toLowerCase(), {
                model: b.createModel(daoDef, t),
                daoInterface: b.createDaoInterface(daoDef, t),
                daoImplementation: b.createDaoImplementation(daoDef, t),
            });
        }, new Map<string, DaoCode>());
        // 
        return Array.from(relations.values()).reduce((m, r) => {
            const daoDef = codeDefs.get(r.name.toLowerCase());
            const childTable = children.get(r.relationship.childTable);
            const model = rb.createModel(daoDef, r, [childTable]);
            const daoInterface = rb.createDaoInterface(daoDef, r);
            const daoImplementation = rb.createDaoImplementation(daoDef, r, [childTable]);
            return m.set(r.name.toLowerCase(), {
                model,
                daoInterface,
                daoImplementation,
            })
        }, indepTables);
    }
}

function createRelationships(d: SchemaDefinition) {
    // Get relationships
    const relations = d.tables.reduce((m, t) => t.relationship != null ? m.set(t.name, t) : m, new Map<string, TableDefinition>());
    const children = Array.from(relations.values()).reduce((m, r) => {
        const childName = r.relationship.childTable;
        const childDefinition = d.tables.find(t => t.name === childName);
        if (childDefinition == null) throw new Error('No child table: ' + childName);
        return m.set(childName, childDefinition);
    }, new Map<string, TableDefinition>());
    return [relations, children];
}


function createModel(ptd: TableDefinition, ctd: TableDefinition) {
    const childListProperty = 'category';
    const searchKeyColumn = 'response_guid';

    const parentName = camelcase(ptd.name.toLowerCase(), { pascalCase: true });
    const childName = camelcase(ctd.name.toLowerCase(), { pascalCase: true });
    const parentColumnNames = ptd.columns.map(c => camelcase(c.name));
    const childColumnNames = ctd.columns.map(c => camelcase(c.name));
    const parentJoinDef = ptd.columns.map(c => 'pt_' + c.name.toLowerCase() + ': ' + columnMap.get(c.type));
    const childJoinDef = ctd.columns.map(c => 'ct_' + c.name.toLowerCase() + ': ' + columnMap.get(c.type));
    const parentPropDef = ptd.columns.map(c => camelcase(c.name) + ': ' + columnMap.get(c.type));
    const childPropDef = ctd.columns.map(c => camelcase(c.name) + ': ' + columnMap.get(c.type));

    // select
    const parentTable = ptd.name.toLowerCase();
    const childTable = ctd.name.toLowerCase();
    const parentPrimaryKey = ptd.primaryKey.columns[0];
    const childForeignKey = ctd.primaryKey.columns[0];
    const parentSelect = ptd.columns.map(c => 'pt.' + c.name.toLowerCase() + ' AS pt_' + c.name.toLowerCase())
    const childSelect = ctd.columns.map(c => 'ct.' + c.name.toLowerCase() + ' AS ct_' + c.name.toLowerCase())
    const selectStatement = `SELECT ${parentSelect.concat(childSelect).join(',')} FROM ${parentTable} pt LEFT OUTER JOIN ${childTable} ct on ct.${childForeignKey} = pt.${parentPrimaryKey} WHERE pt.${searchKeyColumn} = $1`;


    // model mapping
    const dbModel = `${parentName}DbModel`;
    const parentMap = ptd.columns.map(c => camelcase(c.name) + ': i.pt_' + c.name.toLowerCase()).concat([`${childListProperty}: []`]);
    const childMap = ctd.columns.map(c => camelcase(c.name) + ': i.ct_' + c.name.toLowerCase());
    const idType = 'number';
    const parentMapFunc = `function mapDbToParent(i: ${dbModel}):${parentName} {
        return {
            ${parentMap.join(",\n")}
        }
    }`;
    const childMapFunc = `function mapDbToChild(i: ${dbModel}):${childName} {
        return {
            ${childMap.join(",\n")}
        }
    }`;
    const mapDbToModelFunc = `function mapDbToModel(item: ReadonlyArray<${dbModel}>): ReadonlyArray<${parentName}> {
        const itemMap = item.reduce((m, r) => {
            const parentId = r.pt_${parentPrimaryKey};
            const childId = r.ct_${childForeignKey};
            if (parentId != null && !m.has(parentId)) {
                // unknown parent key, so record contains a new parent object
                const parent = mapDbToParent(r);
                m.set(parentId, parent);
            }
            if (childId != null) {
                // child key, so record contains a child object                    
                const child = mapDbToChild(r);
                const parent = m.get(childId);
                if (parent != null) {
                    parent.${childListProperty} = parent.${childListProperty}.concat(child);
                }
            }
            return m;    
        }, new Map<${idType}, ${parentName}>());
        return Array.from(itemMap.values());
    }`;

    const mapModelToDbFunc = `function mapParentToLiteral(i: ${parentName}) {
        return '(' +
            ${parentColumnNames.map(c => '(i.' + c + ' ?? \'\') + \',\' +').join('\n')}
            mapChildrenToLiteral(i.${childListProperty}) +
            ')';
    }
    function mapChildrenToLiteral(items: ReadonlyArray<${childName}>) {
        return '"{' +
            (items == null ? '' : items.map(i => {
                return '""(' +
                    ${childColumnNames.map(c => '(i.' + c + ' ?? \'\') + ').join('\',\' +\n')}
                    ')""'
            }))
            + '}"';
    }    
    `;

    // model
    const parentDef = `export interface ${parentName} { 
        ${parentPropDef.concat([`${childListProperty}: ReadonlyArray<${childName}>`]).join(',\n')}
    }`;
    const childDef = `export interface ${childName} { 
        ${childPropDef.join(',\n')}
    }`;
    // dbmodel
    const dbModelDef = `interface ${dbModel} {
        ${parentJoinDef.concat(childJoinDef).join(',\n')}
    }`;


    return [`
    // Object Model
    ${parentDef}
    ${childDef}
    `, `
    // Dao functions
    ${dbModelDef}
    // Db To Model Mapping
    ${mapDbToModelFunc}
    ${parentMapFunc}
    ${childMapFunc}
    // Model to DB Mapping
    ${mapModelToDbFunc}
    // Get select
    const SELECT_STATEMENT='${selectStatement}';
    `];
}

// export function createParentChildDataTypes(ptd: TableDefinition, ctd: TableDefinition): string {
//     const typeMapper = new CommonTypeMapper();
//     // data type
//     const parentDataType = 't_' + ptd.name.toLowerCase();
//     const childDataType = 't_' + ctd.name.toLowerCase();
//     const childDataVariable = 'children';
//     const joinDataType = 't_' + ptd.name.toLowerCase() + '_' + ctd.name.toLowerCase() + '_join';
//     const parentDataTypeColumns = ptd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
//     const parentFullDataTypeColumns = parentDataTypeColumns.concat([childDataVariable + ' ' + childDataType + '[]']);
//     const childDataTypeColumns = ctd.columns.map(c => c.name + ' ' + mapColumnType(c, typeMapper));
//     const joinDataTypeColumns = parentDataTypeColumns.map(c => 'pt_' + c).concat(childDataTypeColumns.map(c => 'ct_' + c));
//     return `
//     -- CREATE PARENT AND CHILD TYPES
//     CREATE TYPE ${parentDataType} AS (
//         ${parentFullDataTypeColumns.join(',\n')}
//     );
//     CREATE TYPE ${childDataType} AS (
//         ${childDataTypeColumns.join(',\n')}
//     );
//     CREATE TYPE ${joinDataType} AS (
//         ${joinDataTypeColumns.join(',\n')}
//     );
// `;

// }

// export function createParentChildUpdateProcedure(ptd: TableDefinition, ctd: TableDefinition) {
//     const procName = 'save_' + ptd.name.toLowerCase();
//     const parentDataType = 't_' + ptd.name.toLowerCase();
//     const childDataVariable = 'children';
//     const joinDataType = 't_' + ptd.name.toLowerCase() + '_' + ctd.name.toLowerCase() + '_join';

//     // tables
//     const parentTable = ptd.name.toLowerCase();
//     const childTable = ctd.name.toLowerCase();
//     // columns
//     const parentColumnNames = ptd.columns.map(c => c.name);
//     const childColumnNames = ctd.columns.map(c => c.name);
//     const parentPrimaryKey = ptd.primaryKey.columns[0];
//     const childForeignKey = ctd.primaryKey.columns[0];
//     const updateKeyColumn = 'response_guid';
//     const childDiscriminator = ctd.primaryKey.columns[1];
//     // insert
//     const parentInsertColumns = parentColumnNames.filter(c => c != parentPrimaryKey);
//     const parentInsertColumnList = parentInsertColumns.join(',');
//     const parentInsertValues = parentInsertColumns.map(c => 'to_save.' + c).join(',');
//     const childInsertColumnsList = childColumnNames.join(',');
//     const childInsertValues = childColumnNames.filter(c => c != childForeignKey).join(',');
//     // update
//     const parentUpdateColumns = parentColumnNames.filter(c => c != parentPrimaryKey && c != updateKeyColumn);
//     const parentUpdateColumnList = parentUpdateColumns.join(',');
//     const parentUpdateValues = parentUpdateColumns.map(c => 'to_save.' + c).join(',');
//     const childUpdateColumns = childColumnNames.filter(c => c != childForeignKey && c != childDiscriminator);
//     const childUpdateColumnList = childUpdateColumns.join(',');
//     const childUpdateValuesList = childUpdateColumns.map(c => childTable + '.' + c).join(',');
//     // return
//     const returnParentList = parentColumnNames.map(c => 'pt.' + c).concat(childColumnNames.map(c => 'null')).join(',');
//     const returnChildList = parentColumnNames.map(c => 'null').concat(childColumnNames.map(c => 'ct.' + c)).join(',');

//     return `
//     -- CREATE UPDATE FUNCTION
// CREATE OR REPLACE FUNCTION ${procName}(to_save ${parentDataType})
// RETURNS setof ${joinDataType} AS $$
// declare
// 	v_parent_id bigint;
// BEGIN
//  SELECT ${parentPrimaryKey} INTO v_parent_id FROM ${parentTable} WHERE ${updateKeyColumn} = to_save.${updateKeyColumn};
//  IF (v_parent_id IS NULL) THEN
//  	-- insert records
//  	INSERT INTO ${parentTable} (${parentInsertColumnList})
//  		VALUES (${parentInsertValues}) returning ${parentPrimaryKey} into v_parent_id;
// 	 INSERT INTO ${childTable} (${childInsertColumnsList})
// 		SELECT v_parent_id, ${childInsertValues} FROM unnest(to_save.${childDataVariable});
//  ELSE
// 	 -- update records
//      UPDATE ${parentTable} SET 
//          (${parentUpdateColumnList}) = 
//          (${parentUpdateValues}) 
//          WHERE ${parentPrimaryKey} = v_parent_id;
//  	 DELETE FROM ${childTable} ct 
// 	 	WHERE 
// 		ct.${childForeignKey} = v_parent_id and
// 		ct.${childDiscriminator} not in (select ${childDiscriminator} FROM unnest(to_save.${childDataVariable}));
// 	 INSERT INTO ${childTable} (${childInsertColumnsList})
// 	 	SELECT v_parent_id, ${childInsertValues} FROM unnest(to_save.${childDataVariable})
// 		ON CONFLICT (${childForeignKey}, ${childDiscriminator}) 
// 		DO
// 		UPDATE SET (${childUpdateColumnList}) = (${childUpdateValuesList});
// END IF;
//  -- return values
//  RETURN QUERY 
//  	SELECT ${returnParentList}
// 	FROM ${parentTable} pt WHERE pt.${parentPrimaryKey} = v_parent_id
// 	UNION ALL
// 	SELECT ${returnChildList}
// 	FROM ${childTable} ct 
// 	WHERE ct.${childForeignKey} = v_parent_id;
// END;
// $$ LANGUAGE 'plpgsql'
// `;

// }
