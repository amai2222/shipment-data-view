// React类型声明 shim - 完整版本
// 包含所有必要的React类型定义

declare module 'react' {
  export function useState<S>(initialState: S | (() => S)): [S, (value: S | ((prevState: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly any[] | undefined): T;
  export function useCallback<T extends Function>(callback: T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(context: any): T;
  export function lazy<T>(factory: () => Promise<{ default: T }>): T;
  export function Fragment(props: { children?: any }): any;
  export function forwardRef<T, P = {}>(render: (props: P, ref: React.Ref<T>) => React.ReactElement | null): any;
  export function memo<P = {}>(component: (props: P) => any): any;
  
  // 类组件相关类型
  export abstract class Component<P = {}, S = {}> {
    props: P;
    state: S;
    context: any;
    refs: any;
    
    constructor(props: P, context?: any);
    
    setState<K extends keyof S>(
      state: ((prevState: S, props: P) => Pick<S, K> | S | null) | (Pick<S, K> | S | null),
      callback?: () => void
    ): void;
    
    forceUpdate(callback?: () => void): void;
    
    render(): ReactNode;
    
    componentDidMount?(): void;
    componentDidUpdate?(prevProps: P, prevState: S, snapshot?: any): void;
    componentWillUnmount?(): void;
    componentDidCatch?(error: Error, errorInfo: ErrorInfo): void;
    getSnapshotBeforeUpdate?(prevProps: P, prevState: S): any;
    shouldComponentUpdate?(nextProps: P, nextState: S): boolean;
    componentWillMount?(): void;
    componentWillReceiveProps?(nextProps: P, nextContext: any): void;
    componentWillUpdate?(nextProps: P, nextState: S, nextContext: any): void;
    UNSAFE_componentWillMount?(): void;
    UNSAFE_componentWillReceiveProps?(nextProps: P, nextContext: any): void;
    UNSAFE_componentWillUpdate?(nextProps: P, nextState: S, nextContext: any): void;
  }
  
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export type FormEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    preventDefault(): void;
  };
  export type ChangeEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    target: EventTarget & T;
  };
  export type MouseEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    button: number;
    clientX: number;
    clientY: number;
  };
  export type KeyboardEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    key: string;
    code: string;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  };
  export type ErrorInfo = {
    componentStack: string;
  };
  export type Ref<T> = any;
  export type ReactElement = any;
  export type ComponentProps<T> = any;
  export type ComponentType<P = any> = FC<P> | typeof Component;
  export type FormEventHandler<T = Element> = (event: FormEvent<T>) => void;
  export type ChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
  export type TouchEventHandler<T = Element> = (event: TouchEvent<T>) => void;
  export type TouchEvent<T = Element> = Event & {
    currentTarget: EventTarget & T;
    touches: any[];
    targetTouches: any[];
    changedTouches: any[];
  };
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prevState: S) => S);
  export type ElementRef<T> = any;
  export type ComponentPropsWithoutRef<T> = any;
  export interface HTMLAttributes<T> {
    className?: string;
    children?: ReactNode;
    style?: any;
    onClick?: (event: MouseEvent<T>) => void;
    onChange?: (event: ChangeEvent<T>) => void;
    onKeyDown?: (event: KeyboardEvent<T>) => void;
    [key: string]: any;
  }
  
  export namespace React {
    export type FormEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      preventDefault(): void;
    };
    export type ChangeEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      target: EventTarget & T;
    };
    export type MouseEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      button: number;
      clientX: number;
      clientY: number;
    };
    export type KeyboardEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      key: string;
      code: string;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      metaKey: boolean;
    };
    export type ReactNode = any;
    export type FC<P = {}> = (props: P) => any;
    export type ErrorInfo = {
      componentStack: string;
    };
    export const Fragment: any;
    export type Ref<T> = any;
    export type ReactElement = any;
    export type ComponentProps<T> = any;
    export type ComponentType<P = any> = FC<P> | typeof Component;
    export type FormEventHandler<T = Element> = (event: FormEvent<T>) => void;
    export type ChangeEventHandler<T = Element> = (event: ChangeEvent<T>) => void;
    export type TouchEventHandler<T = Element> = (event: TouchEvent<T>) => void;
    export type TouchEvent<T = Element> = Event & {
      currentTarget: EventTarget & T;
      touches: any[];
      targetTouches: any[];
      changedTouches: any[];
    };
    export type Dispatch<A> = (value: A) => void;
    export type SetStateAction<S> = S | ((prevState: S) => S);
    export type ElementRef<T> = any;
    export type ComponentPropsWithoutRef<T> = any;
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
  export const Building: any;
  export const Smartphone: any;
  export const AlertTriangle: any;
  export const RefreshCw: any;
  export const Clock: any;
  export const FileUp: any;
  export const Filter: any;
  export const Copy: any;
  export const RotateCcw: any;
  export const Phone: any;
  export const Zap: any;
  export const Info: any;
  export const Edit: any;
  export const Printer: any;
  export const LogOut: any;
  export const UserCheck: any;
  export const Send: any;
  export const Minus: any;
  export const Play: any;
  export const Pause: any;
  export const ArrowLeft: any;
  export const ArrowRight: any;
  export const Archive: any;
  export const TrendingUp: any;
  export const DollarSign: any;
  export const Tag: any;
  export const Bookmark: any;
  export const Crown: any;
  export const Wifi: any;
  export const WifiOff: any;
  export const Lock: any;
  export const Unlock: any;
  export const Bell: any;
  export const MessageSquare: any;
  export const Menu: any;
  export const ChevronLeft: any;
  export const ChevronUp: any;
  export const MoreHorizontal: any;
  export const MoreVertical: any;
  export const GitBranch: any;
  export const Navigation: any;
  export const Lightbulb: any;
  export const Target: any;
  export const CreditCard: any;
  export const Scale: any;
  export const Receipt: any;
  export const FileSignature: any;
  export const Inbox: any;
  export const Share2: any;
  export const ArrowDown: any;
  export const Camera: any;
  export const Image: any;
  export const SortAsc: any;
  export const SortDesc: any;
  export const Wallet: any;
  export const BarChartHorizontal: any;
  export const CheckSquare: any;
  export const Square: any;
  export const UserX: any;
  export const UserPlus: any;
  export const BookTemplate: any;
  export const UserCog: any;
  export const Settings2: any;
  export type LucideIcon = any;
}

declare module 'date-fns' {
  export function format(date: Date | number, formatStr: string, options?: { locale?: any }): string;
  export function addDays(date: Date | number, amount: number): Date;
  export function isAfter(date: Date | number, dateToCompare: Date | number): boolean;
  export function isBefore(date: Date | number, dateToCompare: Date | number): boolean;
  export function differenceInDays(dateLeft: Date | number, dateRight: Date | number): number;
  export function startOfYear(date: Date | number): Date;
  export function endOfYear(date: Date | number): Date;
  export function startOfMonth(date: Date | number): Date;
  export function endOfMonth(date: Date | number): Date;
  export function subMonths(date: Date | number, amount: number): Date;
  export function parseISO(dateString: string): Date;
  export function startOfDay(date: Date | number): Date;
  export function endOfDay(date: Date | number): Date;
}

declare module 'date-fns/locale' {
  export const zhCN: any;
}

declare module 'xlsx' {
  export interface WorkSheet {
    [key: string]: any;
  }
  
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [key: string]: WorkSheet };
  }
  
  export const utils: {
    sheet_to_json: (sheet: WorkSheet, options?: any) => any[];
    json_to_sheet: (data: any[]) => WorkSheet;
    aoa_to_sheet: (data: any[][]) => WorkSheet;
    book_new: () => WorkBook;
    book_append_sheet: (workbook: WorkBook, worksheet: WorkSheet, name: string) => void;
  };
  
  export function read(data: any, options?: any): WorkBook;
  export function writeFile(workbook: WorkBook, filename: string, options?: any): void;
}

