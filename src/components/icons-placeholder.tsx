/**
 * 图标占位符组件
 * 用于替代 lucide-react 图标，避免导入错误
 */

// 基础图标组件类型
interface IconProps {
  className?: string;
}

// ============================================================================
// 导出所有占位符图标
// ============================================================================

// 通用图标
export const Loader2 = ({ className }: IconProps) => <span className={className}>⏳</span>;
export const Search = ({ className }: IconProps) => <span className={className}>🔍</span>;
export const Plus = ({ className }: IconProps) => <span className={className}>➕</span>;
export const X = ({ className }: IconProps) => <span className={className}>✖️</span>;
export const Check = ({ className }: IconProps) => <span className={className}>✓</span>;
export const ChevronDown = ({ className }: IconProps) => <span className={className}>▼</span>;
export const ChevronUp = ({ className }: IconProps) => <span className={className}>▲</span>;
export const ChevronRight = ({ className }: IconProps) => <span className={className}>▶</span>;
export const ChevronLeft = ({ className }: IconProps) => <span className={className}>◀</span>;

// 文件和文档
export const FileText = ({ className }: IconProps) => <span className={className}>📄</span>;
export const FileSpreadsheet = ({ className }: IconProps) => <span className={className}>📊</span>;
export const FileImage = ({ className }: IconProps) => <span className={className}>🖼️</span>;
export const Download = ({ className }: IconProps) => <span className={className}>⬇️</span>;
export const Upload = ({ className }: IconProps) => <span className={className}>⬆️</span>;
export const ClipboardList = ({ className }: IconProps) => <span className={className}>📋</span>;

// 用户和权限
export const Users = ({ className }: IconProps) => <span className={className}>👥</span>;
export const User = ({ className }: IconProps) => <span className={className}>👤</span>;
export const Shield = ({ className }: IconProps) => <span className={className}>🛡️</span>;
export const Key = ({ className }: IconProps) => <span className={className}>🔑</span>;
export const Eye = ({ className }: IconProps) => <span className={className}>👁️</span>;
export const EyeOff = ({ className }: IconProps) => <span className={className}>🙈</span>;

// 状态图标
export const CheckCircle = ({ className }: IconProps) => <span className={className}>✅</span>;
export const CheckCircle2 = ({ className }: IconProps) => <span className={className}>✅</span>;
export const XCircle = ({ className }: IconProps) => <span className={className}>❌</span>;
export const AlertCircle = ({ className }: IconProps) => <span className={className}>⚠️</span>;
export const AlertTriangle = ({ className }: IconProps) => <span className={className}>⚠️</span>;

// 业务图标
export const Truck = ({ className }: IconProps) => <span className={className}>🚚</span>;
export const Package = ({ className }: IconProps) => <span className={className}>📦</span>;
export const MapPin = ({ className }: IconProps) => <span className={className}>📍</span>;
export const Banknote = ({ className }: IconProps) => <span className={className}>💰</span>;
export const CreditCard = ({ className }: IconProps) => <span className={className}>💳</span>;
export const Building = ({ className }: IconProps) => <span className={className}>🏢</span>;
export const Building2 = ({ className }: IconProps) => <span className={className}>🏢</span>;
export const Phone = ({ className }: IconProps) => <span className={className}>📞</span>;
export const Smartphone = ({ className }: IconProps) => <span className={className}>📱</span>;
export const Mail = ({ className }: IconProps) => <span className={className}>📧</span>;

// 图表和数据
export const BarChart3 = ({ className }: IconProps) => <span className={className}>📊</span>;
export const PieChart = ({ className }: IconProps) => <span className={className}>📈</span>;
export const Database = ({ className }: IconProps) => <span className={className}>💾</span>;
export const Calculator = ({ className }: IconProps) => <span className={className}>🧮</span>;
export const Weight = ({ className }: IconProps) => <span className={className}>⚖️</span>;

// 操作图标
export const Settings = ({ className }: IconProps) => <span className={className}>⚙️</span>;
export const History = ({ className }: IconProps) => <span className={className}>📜</span>;
export const RefreshCw = ({ className }: IconProps) => <span className={className}>🔄</span>;
export const RotateCcw = ({ className }: IconProps) => <span className={className}>↶</span>;
export const Trash2 = ({ className }: IconProps) => <span className={className}>🗑️</span>;
export const Edit = ({ className }: IconProps) => <span className={className}>✏️</span>;
export const Save = ({ className }: IconProps) => <span className={className}>💾</span>;
export const Copy = ({ className }: IconProps) => <span className={className}>📋</span>;
export const FileSpreadsheet = ({ className }: IconProps) => <span className={className}>📊</span>;

// 链接和导航
export const ExternalLink = ({ className }: IconProps) => <span className={className}>🔗</span>;
export const Home = ({ className }: IconProps) => <span className={className}>🏠</span>;
export const Calendar = ({ className }: IconProps) => <span className={className}>📅</span>;
export const CalendarIcon = ({ className }: IconProps) => <span className={className}>📅</span>;

// 特殊图标
export const Hash = ({ className }: IconProps) => <span className={className}>#</span>;
export const TreePine = ({ className }: IconProps) => <span className={className}>🌲</span>;

// 更多图标
export const ChevronsUpDown = ({ className }: IconProps) => <span className={className}>⇅</span>;
export const PlusCircle = ({ className }: IconProps) => <span className={className}>⊕</span>;
export const Edit2 = ({ className }: IconProps) => <span className={className}>✏️</span>;
export const Link = ({ className }: IconProps) => <span className={className}>🔗</span>;
export const Trash2 = ({ className }: IconProps) => <span className={className}>🗑️</span>;
export const Clock = ({ className }: IconProps) => <span className={className}>🕐</span>;
export const XCircle = ({ className }: IconProps) => <span className={className}>❌</span>;
export const Copy = ({ className }: IconProps) => <span className={className}>📋</span>;

// React 组件占位符
export { default as React } from 'react';

