import { FlaskConical, LockKeyhole } from "lucide-react";

export function ExperimentalPanel() {
  return (
    <section className="experimental-panel">
      <div className="panel-title-row">
        <FlaskConical size={18} />
        <h2>Future Deck</h2>
      </div>
      <div className="future-stack">
        <div className="future-row">
          <LockKeyhole size={16} />
          <div>
            <strong>UVC Extension</strong>
            <span>10 raw selectors need correlation</span>
          </div>
          <em>Read only</em>
        </div>
      </div>
    </section>
  );
}
