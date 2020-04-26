import { AbstractDaoBuilder } from './abstract-dao-builder';
import { TableDefinition, ColumnType, CodeDefinition } from "../../model";
import { pascalCase, camelCase as camelcase, snakeCase } from 'change-case';

import * as SchemaUtil from '../../schema-definition-util';
import * as CodeUtil from './code-definition-util';

export class GeneratingKeyTableCodeBuilder extends AbstractDaoBuilder {

    createModel(codeDef: CodeDefinition, d: TableDefinition): { modelNames: string[], code: string } {
        return {
            modelNames: [CodeUtil.getTableObjectName(d)],
            code: CodeUtil.createModel(d)
        };
    }

    createDaoInterface(codeDef: CodeDefinition, d: TableDefinition): string {
        const objectName = this.objectName(d);
        return `
${this.daoHeader(objectName)}
    saveItem(item: ${objectName}): Promise<${objectName}>;
    ${CodeUtil.createGetMethodSignature('getItem', objectName, SchemaUtil.primaryKeyColumns(d))}
    ${(codeDef?.getKeys ?? []).map(k => CodeUtil.createGetMethodSignature(`getItemBy${pascalCase(k)}`, objectName, SchemaUtil.columnsByName(d, [k]))).join(';\n')}
}`;
    }

    createDaoImplementation(codeDef: CodeDefinition, d: TableDefinition): string {
        const objectName = this.objectName(d);
        const primaryKey = d.primaryKey.columns[0].toLowerCase();
        const tableName = d.name.toLowerCase();
        const allColumns = SchemaUtil.getAllColumns(d);
        const allColumnNames = allColumns.map(c => c.name.toLowerCase());

        // create update parameters eg '$1, $2', o.id...
        const pkReturnColumns = allColumnNames.map(c => `${c} as "${camelcase(c)}"`);
        const noPkColumns = allColumnNames.filter(c => c !== primaryKey);
        const noPkNumberColumns = noPkColumns.map((c, i) => `$${i + 1}`);
        const noPkObjectColumns = noPkColumns.map(c => `item.${camelcase(c)}`);

        const insertStatement = `INSERT INTO ${tableName} (${noPkColumns.join(',')}) VALUES (${noPkNumberColumns.join(',')}) returning ${pkReturnColumns.join(',')};`;
        const insertParams = noPkObjectColumns.join(',');

        const getMethod = CodeUtil.createGetMethod('getItem', d.name, objectName, allColumns, SchemaUtil.primaryKeyColumns(d));
        const getKeyMethods = (codeDef?.getKeys ?? []).map(k => CodeUtil.createGetMethod(`getItemBy${pascalCase(k)}`, d.name, objectName, allColumns, SchemaUtil.columnsByName(d, [k])));

        return `
${this.dbDaoHeader(objectName)}
    
        public async saveItem(item: ${objectName}): Promise<${objectName}> {
            if (item == null) {
                throw new Error('${objectName}::saveItem argument is not valid');
            }
            const db = this.dbInterfaceProvider.getDbInterface();
            return (await db.query(INSERT_STATEMENT, [${insertParams}]))[0];
        }
    
        ${getMethod.method}
        ${getKeyMethods.map(m => m.method).join(';\n')}
    }

    ${getMethod.constants}
    ${getKeyMethods.map(m => m.constants).join(';\n')}
    const INSERT_STATEMENT = '${insertStatement}';
    
    `;

    }



}


