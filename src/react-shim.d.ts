// React类型声明 shim
// 这是临时解决方案，最终需要运行 bun install 来安装实际的类型定义

declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends Function>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;
  export function lazy<T extends React.ComponentType<any>>(
    factory: () => Promise<{ default: T }>
  ): T;
  export function memo<P>(component: React.FC<P>): React.FC<P>;
  export const Fragment: any;
  export class Component<P = {}, S = {}> {
    props: Readonly<P>;
    state: Readonly<S>;
    setState(state: Partial<S> | ((prevState: Readonly<S>) => Partial<S>)): void;
    render(): ReactNode;
  }
  export type ErrorInfo = {
    componentStack: string;
  };
  export type MouseEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
  };
  export type KeyboardEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    key: string;
  };
  
  export type FC<P = {}> = (props: P) => ReactElement | null;
  export type ReactNode = any;
  export type ReactElement = any;
  export type ComponentType<P = any> = React.FC<P> | React.ComponentClass<P>;
  export type FormEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    preventDefault(): void;
  };
  
  export namespace React {
    export type FormEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      preventDefault(): void;
    };
    export type MouseEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
    };
    export type KeyboardEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      key: string;
    };
    export type ReactNode = any;
    export type ReactElement = any;
    export type FC<P = {}> = (props: P) => ReactElement | null;
    export type ComponentType<P = any> = FC<P> | ComponentClass<P>;
    export type ComponentClass<P = any> = any;
  }
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
  export type LucideIcon = any;
  export const CalendarIcon: any;
  export const Calendar: any;
  export const Save: any;
  export const X: any;
  export const Plus: any;
  export const Package: any;
  export const Banknote: any;
  export const Weight: any;
  export const Check: any;
  export const ChevronsUpDown: any;
  export const BarChart3: any;
  export const Database: any;
  export const FileText: any;
  export const Calculator: any;
  export const PieChart: any;
  export const Truck: any;
  export const MapPin: any;
  export const Users: any;
  export const ChevronDown: any;
  export const ClipboardList: any;
  export const Settings: any;
  export const Shield: any;
  export const History: any;
  export const TreePine: any;
  export const CheckCircle2: any;
  export const CreditCard: any;
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
  export const ChevronRight: any;
  export const Home: any;
  export const User: any;
  export const Mail: any;
  export const Building2: any;
  export const Smartphone: any;
  export const AlertTriangle: any;
  export const RefreshCw: any;
  export const Clock: any;
  export const Trash: any;
  export const Edit: any;
  export const Copy: any;
  export const Filter: any;
  export const ArrowUpDown: any;
  export const MoreHorizontal: any;
  export const FileDown: any;
  export const TrendingUp: any;
  export const Target: any;
  export const Wallet: any;
  export const BarChartHorizontal: any;
  export const LayoutDashboard: any;
  export const ArrowLeft: any;
  export const RotateCcw: any;
  export const Phone: any;
  export const Landmark: any;
  export const Send: any;
  export const Zap: any;
  export const Info: any;
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: { locale?: any }): string;
}

declare module 'date-fns/locale' {
  export const zhCN: any;
}
