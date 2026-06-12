import type { TableHTMLAttributes, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
export function Table(props: TableHTMLAttributes<HTMLTableElement>): JSX.Element { return <table {...props} />; }
export function TableHeader(props: HTMLAttributes<HTMLTableSectionElement>): JSX.Element { return <thead {...props} />; }
export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>): JSX.Element { return <tbody {...props} />; }
export function TableRow(props: HTMLAttributes<HTMLTableRowElement>): JSX.Element { return <tr {...props} />; }
export function TableHead(props: ThHTMLAttributes<HTMLTableCellElement>): JSX.Element { return <th {...props} />; }
export function TableCell(props: TdHTMLAttributes<HTMLTableCellElement>): JSX.Element { return <td {...props} />; }
