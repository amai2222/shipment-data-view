import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

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
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-4">Oops! Page not found</p>
        <a href="/" className="text-blue-500 hover:text-blue-700 underline">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
