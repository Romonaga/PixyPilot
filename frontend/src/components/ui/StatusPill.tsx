type Props = {
  tone: "good" | "warn" | "info";
  label: string;
};

export function StatusPill({ tone, label }: Props) {
  return <span className={`status-pill tone-${tone}`}>{label}</span>;
}
