import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  useEffect(() => {
    // 检查是否是静态文件访问，如果是则重定向到静态文件
    const pathname = location.pathname;
    
    // 检查是否是.txt文件或其他静态文件扩展名
    const staticFileExtensions = ['.txt', '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.ico', '.css', '.js', '.json'];
    const isStaticFile = staticFileExtensions.some(ext => pathname.toLowerCase().endsWith(ext));
    
    if (isStaticFile) {
      // 直接访问静态文件
      window.location.href = pathname;
      return;
    }

    console.error(
      "404 Error: User attempted to access non-existent route:",
      pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-background">
      <div className="max-w-md w-full mx-4">
        <div className="text-center space-y-6 p-8 bg-card/80 backdrop-blur-sm rounded-2xl shadow-card border">
          {/* 404 图标 */}
          <div className="mx-auto w-24 h-24 bg-gradient-primary rounded-full flex items-center justify-center">
            <span className="text-4xl font-bold text-white">404</span>
          </div>
          
          {/* 标题和描述 */}
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-foreground">页面未找到</h1>
            <p className="text-muted-foreground">
              抱歉，您访问的页面不存在或已被移动。
            </p>
          </div>
          
          {/* 操作按钮 */}
          <div className="space-y-3">
            <a 
              href="/" 
              className="inline-block w-full py-3 px-6 bg-gradient-primary text-white font-medium rounded-lg hover:opacity-90 transition-all shadow-primary"
            >
              返回首页
            </a>
            <button 
              onClick={() => window.history.back()}
              className="inline-block w-full py-3 px-6 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-muted transition-all"
            >
              返回上一页
            </button>
            <button 
              onClick={handleLogout}
              className="inline-flex items-center justify-center w-full py-3 px-6 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all"
            >
              <LogOut className="h-4 w-4 mr-2" />
              退出登录
            </button>
          </div>
          
          {/* 帮助信息 */}
          <div className="text-sm text-muted-foreground">
            如果您认为这是一个错误，请联系系统管理员
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
