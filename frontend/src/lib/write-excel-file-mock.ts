/* eslint-disable */
export interface CellObject {
  value: any;
  type?: any;
  fontWeight?: string;
}

export interface Sheet<T> {
  sheet: string;
  columns: any[];
  data: any[][];
  _dummy?: T;
}

export default function writeExcelFile(data: any[], _options?: any) {
  return {
    toFile: async (filename: string) => {
      let content = '';
      for (const sheet of data) {
        content += `### SHEET: ${sheet.sheet}\r\n`;
        for (const row of sheet.data) {
          const line = row.map((cell: any) => {
            const val = cell && typeof cell === 'object' ? cell.value : cell;
            if (val === undefined || val === null) return '';
            if (val instanceof Date) return val.toISOString();
            const strVal = String(val);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n') || strVal.includes('\r')) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
          }).join(',');
          content += line + '\r\n';
        }
        content += '\r\n';
      }
      
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename.replace('.xlsx', '.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };
}
