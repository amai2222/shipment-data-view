// 全局类型声明文件
// 解决TypeScript编译错误

declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends Function>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;
  export function lazy<T>(factory: () => Promise<{ default: T }>): T;
  export function Component<P = {}, S = {}>(props: P, context?: any): any;
  export function Fragment(props: { children?: any }): any;
  export function forwardRef<T, P = {}>(render: (props: P, ref: React.Ref<T>) => React.ReactElement | null): any;
  
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export type FormEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    preventDefault(): void;
  };
  export type ErrorInfo = any;
  export type Ref<T> = any;
  export type ReactElement = any;
  export type ComponentProps<T> = any;
  
  export namespace React {
    export type FormEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      preventDefault(): void;
    };
    export type ReactNode = any;
    export type FC<P = {}> = (props: P) => any;
    export type ErrorInfo = any;
    export const Fragment: any;
    export type Ref<T> = any;
    export type ReactElement = any;
    export type ComponentProps<T> = any;
  }
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
  export const ChevronDown: any;
  export const ChevronRight: any;
  export const BarChart3: any;
  export const Database: any;
  export const FileText: any;
  export const Calculator: any;
  export const PieChart: any;
  export const Truck: any;
  export const MapPin: any;
  export const Users: any;
  export const ClipboardList: any;
  export const Settings: any;
  export const Shield: any;
  export const History: any;
  export const Download: any;
  export const Loader2: any;
  export const CheckCircle: any;
  export const XCircle: any;
  export const Key: any;
  export const Eye: any;
  export const EyeOff: any;
  export const AlertCircle: any;
  export const PlusCircle: any;
  export const Upload: any;
  export const FileImage: any;
  export const Trash2: any;
  export const ExternalLink: any;
  export const Search: any;
  export const Home: any;
  export const User: any;
  export const Mail: any;
  export const Building2: any;
  export const Smartphone: any;
  export const AlertTriangle: any;
  export const RefreshCw: any;
  export const Clock: any;
  export const FileUp: any;
  export const Filter: any;
  export const PanelLeft: any;
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: { locale?: any }): string;
}

declare module 'date-fns/locale' {
  export const zhCN: any;
}

declare module 'xlsx' {
  export function read(data: any, options?: any): any;
  export function write(data: any, options?: any): any;
  export const utils: any;
}

declare module 'react-dom' {
  export function createRoot(container: Element | DocumentFragment): any;
}

declare module 'react/jsx-runtime' {
  export function jsx(type: any, props: any, key?: any): any;
  export function jsxs(type: any, props: any, key?: any): any;
  export const Fragment: any;
}
