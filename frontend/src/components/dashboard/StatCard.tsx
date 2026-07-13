type StatCardProps = {
  label: string;
  value: string | number;
};

export function StatCard({
  label,
  value,
}: StatCardProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        padding: "20px",
        background: "white",
        minWidth: "180px",
      }}
    >
      <p
        style={{
          color: "#6b7280",
          fontSize: "14px",
          marginBottom: "8px",
        }}
      >
        {label}
      </p>

      <p
        style={{
          fontSize: "28px",
          fontWeight: 400,
        }}
      >
        {value}
      </p>
    </div>
  );
}