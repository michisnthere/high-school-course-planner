import React from "react";

type ResponsiveContainerProps = {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
};

export function ResponsiveContainer({ children, maxWidth = 1200, style }: ResponsiveContainerProps) {
  return (
    <div
      style={{
        maxWidth,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
