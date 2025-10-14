// 模块类型声明文件
// 只声明缺失的模块，不重新声明React

// 添加缺失的React类型
declare module 'react' {
  export function memo<P = {}>(component: (props: P) => any): any;
  export type ComponentType<P = any> = any;
  export type KeyboardEvent<T = Element> = any;
  export type MouseEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;
  
  // 类组件支持
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
    
    render(): any;
    
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
  
  export type ErrorInfo = {
    componentStack: string;
  };
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
  export const Building: any;
  export const Calendar: any;
  export const LucideIcon: any;
  export type LucideIcon = any;
  export const Lock: any;
  export const Unlock: any;
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
  export function write(data: any, options?: any): any;
}

declare module 'react-window' {
  export class FixedSizeList extends React.Component<any> {
    constructor(props: any);
  }
}
