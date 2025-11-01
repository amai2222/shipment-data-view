// React类型声明 shim
// 这是临时解决方案，最终需要运行 bun install 来安装实际的类型定义

declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
  
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends Function>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;
  
  export type FC<P = {}> = (props: P & { children?: ReactNode }) => ReactElement | null;
  export type ReactNode = ReactChild | ReactFragment | ReactPortal | boolean | null | undefined;
  export type ReactElement = any;
  export type ReactChild = ReactElement | string | number;
  export type ReactFragment = {} | Iterable<ReactNode>;
  export type ReactPortal = ReactElement;
  
  export type FormEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    preventDefault(): void;
  };
  
  export type MouseEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
  };
  
  export type ChangeEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    target: EventTarget & T;
  };
  
  export interface HTMLAttributes<T> {
    className?: string;
    onClick?: (event: MouseEvent<T>) => void;
    onChange?: (event: ChangeEvent<T>) => void;
    children?: ReactNode;
  }
  
  export namespace React {
    export type FormEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      preventDefault(): void;
    };
    export type ReactNode = any;
    export type FC<P = {}> = (props: P) => any;
    export type ComponentType<P = {}> = FC<P>;
  }
  
  export default React;
}

declare module 'react-dom' {
  export function createRoot(container: Element | DocumentFragment): any;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}

declare module 'lucide-react' {
  export const CalendarIcon: any;
  export const Save: any;
  export const X: any;
  export const Plus: any;
  export const Package: any;
  export const Banknote: any;
  export const Weight: any;
  export const Check: any;
  export const ChevronsUpDown: any;
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: { locale?: any }): string;
}

declare module 'date-fns/locale' {
  export const zhCN: any;
}

