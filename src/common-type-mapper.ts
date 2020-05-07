import { ColumnTypeMapper } from './schema-builder';
import { FixedStringColumn, VariableStringColumn, IntegerColumn, SimpleColumn } from "./model";

export class CommonTypeMapper implements ColumnTypeMapper {

    public convertGenerated(c: IntegerColumn): string {
        if (c.size === 2) {
            return 'smallserial';
        }
        if (c.size === 8) {
            return 'bigserial';
        }
        return 'serial';
    }

    public convertDateTime(c: SimpleColumn): string {
        return 'timestamp';
    }

    public convertBoolean(c: SimpleColumn): string {
        return 'boolean';
    }

    public convertBinary(c: SimpleColumn): string {
        return 'bytea';
    }

    public convertGuid(c: SimpleColumn): string {
        return 'uuid';
    }

    public convertInteger(c: IntegerColumn): string {
        if (c.size === 2) {
            return 'smallint';
        }
        if (c.size === 8) {
            return 'bigint';
        }
        return 'integer';
    }

    public convertFixedString(c: FixedStringColumn): string {
        return c.size == null ? 'char' : 'char(' + c.size + ')';
    }

    public convertVariableString(c: VariableStringColumn): string {
        return c.length == null ? 'varchar' : 'varchar(' + c.length + ')';
    }

}
