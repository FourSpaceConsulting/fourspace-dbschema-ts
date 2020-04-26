import { TableDaoBuilder } from './table-dao-builder';
import { AbstractDaoBuilder } from "./abstract-dao-builder";
import { TableDefinition, ColumnDefinition, CodeDefinition } from '../../model';
import * as SchemaUtil from '../../schema-definition-util';
import * as CodeUtil from './code-definition-util';
import { snakeCase, pascalCase } from 'change-case';

export class OneOwnsManyTableCodeBuilder extends AbstractDaoBuilder implements TableDaoBuilder {
    public createModel(codeDef: CodeDefinition, d: TableDefinition, r: readonly TableDefinition[]): { modelNames: string[], code: string } {
        return createParentChildModel(d, r[0], 'category');
    }
    public createDaoInterface(codeDef: CodeDefinition, d: TableDefinition): string {
        const objectName = this.objectName(d);

        return `
${this.daoHeader(objectName)}
    saveItem(item: ${objectName}): Promise<${objectName}>;
    ${(codeDef?.getKeys ?? []).map(k => CodeUtil.createGetMethodSignature(`getHeaderItemBy${pascalCase(k)}`, objectName, SchemaUtil.columnsByName(d, [k]))).join(';\n')}
    ${(codeDef?.getKeys ?? []).map(k => CodeUtil.createGetMethodSignature(`getFullItemBy${pascalCase(k)}`, objectName, SchemaUtil.columnsByName(d, [k]))).join(';\n')}
}`;
    }
    public createDaoImplementation(codeDef: CodeDefinition, d: TableDefinition, r: readonly TableDefinition[]): string {
        const allColumns = SchemaUtil.getAllColumns(d);
        const objectName = CodeUtil.getTableObjectName(d);
        const dbModel = `${objectName}DbModel`;
        const ctd = r[0];
        // get these from schema
        const childProperty = 'category';
        // --
        const headerGetKeyMethods = (codeDef?.getKeys ?? []).map(k => CodeUtil.createGetMethod(`getHeaderItemBy${pascalCase(k)}`, d.name, objectName, allColumns, SchemaUtil.columnsByName(d, [k])));
        const fullGetKeyMethods = (codeDef?.getKeys ?? []).map(k => createMultiGetter(`getFullItemBy${pascalCase(k)}`, d, ctd, SchemaUtil.columnsByName(d, [k])));
        return `
${this.dbDaoHeader(objectName)}

    public async saveItem(item: ${objectName}): Promise<${objectName}> {
        if (item == null) {
            throw new Error('SurveyResultDaoDb::saveResult argument is null');
        }
        const db = this.dbInterfaceProvider.getDbInterface();
        const input = mapParentToLiteral(item);
        const savedModel: readonly SignupSurveyResponseDbModel[] = await db.func('save_signup_survey_response', input);
        return mapDbToModel(savedModel)[0];
    }

    ${headerGetKeyMethods.map(m => m.method).join(';\n')}
    ${fullGetKeyMethods.map(m => m.method).join(';\n')}
    
}

${headerGetKeyMethods.map(m => m.constants).join(';\n')}
${fullGetKeyMethods.map(m => m.constants).join(';\n')}
// *** DB Mapping Functionality ***
${createDbModel(d, ctd, dbModel)}
${mapDbToDomainModel(d, ctd, childProperty)}
${mapDomainToDbModel(d, ctd, childProperty)}
`;
        //    const INSERT_STATEMENT = '${insertStatement}';
    }
}

function createMultiGetter(methodName: string, ptd: TableDefinition, ctd: TableDefinition, clauseColumns: readonly ColumnDefinition[]): { method: string, constants: string } {
    const objectModelName = CodeUtil.getTableObjectName(ptd);
    const dbModelName = `${objectModelName}DbModel`;
    const statementName = `${snakeCase(methodName).toUpperCase()}_STATEMENT`;
    const selectStatement = createFullSelect(clauseColumns, ptd, ctd);

    const clausePropertyDefinitions = CodeUtil.getColumnObjectDefinitions(clauseColumns);
    const clauseProperties = CodeUtil.getColumnObjectNames(clauseColumns);
    const clausePropertyDefinitionsList = clausePropertyDefinitions.join(',');
    const clausePropertyList = clauseProperties.join(',');
    const clauseNullCheckList = clauseProperties.map(p => `${p} == null`).join(' || ');
    const clauseMessage = clauseProperties.length === 1 ? clauseProperties[0] : `[${clausePropertyList}].join(',')`;
    return {
        method: `
public async ${methodName}(${clausePropertyDefinitionsList}): Promise<${objectModelName}> {
    if (${clauseNullCheckList}) {
        throw new Error('${objectModelName}::${methodName} invalid arguments');
    }
    const db = this.dbInterfaceProvider.getDbInterface();
    const model: ReadonlyArray<${dbModelName}> = await db.query(${statementName}, ${clausePropertyList});
    if (model.length == 0) {
        throwResourceNotFoundError(${clauseMessage});
    }
    return mapDbToModel(model)[0];
}`,
        constants: `const ${statementName}='${selectStatement}';`
    };

}

function createParentChildModel(ptd: TableDefinition, ctd: TableDefinition, childProperty: string) {
    const parentName = CodeUtil.getTableObjectName(ptd);
    const childName = CodeUtil.getTableObjectName(ctd);
    const parentPropertyDefs = CodeUtil.getColumnObjectDefinitions(SchemaUtil.getAllColumns(ptd));
    const childPropertyDefs = CodeUtil.getColumnObjectDefinitions(SchemaUtil.getAllColumns(ctd));
    const parentChildPropertyDef = `${childProperty}: ReadonlyArray<${childName}>`;
    // model
    const code = `
export interface ${parentName} { 
    ${parentPropertyDefs.concat([parentChildPropertyDef]).join(',\n')}
};
export interface ${childName} { 
    ${childPropertyDefs.join(',\n')}
}`;

    return {
        modelNames: [parentName, childName],
        code: code
    };

}

/**
 * DB model represents the superset of parent and child properties
 * @param ptd 
 * @param ctd 
 * @param dbModel 
 */
function createDbModel(ptd: TableDefinition, ctd: TableDefinition, dbModel: string) {
    const parentPropertyDefs = CodeUtil.getDbColumnObjectDefinitions(SchemaUtil.getAllColumns(ptd)).map(p => 'pt_' + p);
    const childPropertyDefs = CodeUtil.getDbColumnObjectDefinitions(SchemaUtil.getAllColumns(ctd)).map(p => 'ct_' + p);
    return `interface ${dbModel} {
        ${parentPropertyDefs.concat(childPropertyDefs).join(',\n')}
    }`;
}

/**
 * Creates a full parent child table select, mapping table cols to prefixed object names
 * e.g.
 * pt_parentColumnName
 * ct_childColumnName
 * @param ptd 
 * @param ctd 
 */
function createFullSelect(clauseColumns: readonly ColumnDefinition[], ptd: TableDefinition, ctd: TableDefinition): string {
    const parentTable = ptd.name;
    const childTable = ctd.name;
    const parentPrimaryKey = ptd.primaryKey.columns[0];
    const childForeignKey = ctd.primaryKey.columns[0];
    const parentSelectList = CodeUtil.getColumnSelectAsTablePrefixedList(SchemaUtil.getAllColumns(ptd), 'pt');
    const childSelectList = CodeUtil.getColumnSelectAsTablePrefixedList(SchemaUtil.getAllColumns(ctd), 'ct');
    const selectListString = parentSelectList.concat(childSelectList).join(',');
    const clauses = clauseColumns.map((c, i) => `pt.${c.name} = $${i + 1}`);
    return `SELECT ${selectListString} FROM ${parentTable} pt LEFT OUTER JOIN ${childTable} ct on ct.${childForeignKey} = pt.${parentPrimaryKey} WHERE ${clauses.join(' AND ')}`;
}

function mapDbToDomainModel(ptd: TableDefinition, ctd: TableDefinition, childProperty: string) {
    const parentName = CodeUtil.getTableObjectName(ptd);
    const childName = CodeUtil.getTableObjectName(ctd);
    const dbModel = `${parentName}DbModel`;

    const parentPrimaryKey = ptd.primaryKey.columns[0];
    const childForeignKey = ctd.primaryKey.columns[0];
    const parentMap = SchemaUtil.getAllColumns(ptd).map(c => `${CodeUtil.getColumnObjectName(c)}: i.pt_${c.name}`);
    const childMap = SchemaUtil.getAllColumns(ctd).map(c => `${CodeUtil.getColumnObjectName(c)}: i.ct_${c.name}`);
    const parentChildProperty = `${childProperty}: []`;
    const idType = 'number';

    return `
// --- Map DB To Domain Model ---
function mapDbToParent(i: ${dbModel}):${parentName} {
    return {
        ${parentMap.concat([parentChildProperty]).join(",\n")}
    }
};
function mapDbToChild(i: ${dbModel}):${childName} {
        return {
            ${childMap.join(",\n")}
        }
};
function mapDbToModel(item: ReadonlyArray<${dbModel}>): ReadonlyArray<${parentName}> {
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
                    parent.${childProperty} = parent.${childProperty}.concat(child);
                }
            }
            return m;    
        }, new Map<${idType}, ${parentName}>());
        return Array.from(itemMap.values());
}
// --------------------------------`;
}

function mapDomainToDbModel(ptd: TableDefinition, ctd: TableDefinition, childProperty: string) {
    const parentName = CodeUtil.getTableObjectName(ptd);
    const childName = CodeUtil.getTableObjectName(ctd);
    const propMap = (name: string, format: string) => format == null ? `(i.${name} ?? '')` : `(${format}(i.${name}) ?? '')`;
    const parentPropertyNames = SchemaUtil.getAllColumns(ptd).map(c => propMap(CodeUtil.getColumnObjectName(c), CodeUtil.getColumnFormat(c)));
    const childPropertyNames = SchemaUtil.getAllColumns(ctd).map(c => propMap(CodeUtil.getColumnObjectName(c), CodeUtil.getColumnFormat(c)));
    return `
// --- Map Domain Object to DB Mode ---
function mapParentToLiteral(i: ${parentName}) {
    return '(' +
        ${parentPropertyNames.map(c => `${c} + ',' +`).join('\n')}
        mapChildrenToLiteral(i.${childProperty}) +
        ')';
}
function mapChildrenToLiteral(items: ReadonlyArray<${childName}>) {
    return '"{' +
        (items == null ? '' : items.map(i => {
            return '""(' +
                ${childPropertyNames.map(c => `${c} +`).join('\',\' +\n')}
                ')""'
        }))
        + '}"';
}
// -------------------------------------`;
}
