// 全局类型声明文件
declare module 'react' {
  import * as React from 'react';
  export = React;
  export as namespace React;
}

declare module 'react/jsx-runtime' {
  import { jsx, jsxs, Fragment } from 'react/jsx-runtime';
  export { jsx, jsxs, Fragment };
}

declare module 'lucide-react' {
  import { LucideProps } from 'lucide-react';
  export * from 'lucide-react';
}

declare module 'react-router-dom' {
  export * from 'react-router-dom';
}

// React 命名空间声明
declare namespace React {
  interface Component<P = {}, S = {}> {
    render(): React.ReactElement<any, any> | null;
  }
  
  interface FunctionComponent<P = {}> {
    (props: P, context?: any): React.ReactElement<any, any> | null;
  }
  
  type ReactElement = any;
  type ReactNode = any;
}
