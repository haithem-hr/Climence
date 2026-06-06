/// <reference types="vite/client" />

declare module 'lucide-react';

/* eslint-disable */
declare module 'write-excel-file/browser' {
  export type CellObject = any;
  export type Sheet<T> = any;
  const writeExcelFile: any;
  export default writeExcelFile;
}
