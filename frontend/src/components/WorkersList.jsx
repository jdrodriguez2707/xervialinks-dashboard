import { useState } from "react";
import { addProperty } from "../api/workers";

/**
 * @param {{
 *   workers: Array<{ id: number, name: string, email: string, percentage: number, properties: Array }>,
 *   onUpdate: () => void
 * }} props
 */
export default function WorkersList({ workers, onUpdate }) {
  if (workers.length === 0) {
    return (
      <p className="empty-state">
        No workers yet. Use the form above to add one.
      </p>
    );
  }

  return (
    <div className="workers-list">
      {workers.map((worker) => (
        <WorkerCard key={worker.id} worker={worker} onUpdate={onUpdate} />
      ))}
    </div>
  );
}

function WorkerCard({ worker, onUpdate }) {
  const [type, setType] = useState("domain");
  const [value, setValue] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAddProperty(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await addProperty(worker.id, { type, value: value.trim() });
      setValue("");
      onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const domains = worker.properties.filter((p) => p.type === "domain");
  const adUnits = worker.properties.filter((p) => p.type === "ad_unit");

  return (
    <div className="worker-card">
      <div className="worker-card-header">
        <div>
          <p className="worker-name">{worker.name}</p>
          <p className="worker-email">{worker.email}</p>
        </div>
        <span className="percentage-badge">{worker.percentage}%</span>
      </div>

      <div className="worker-properties">
        {domains.length > 0 && (
          <div className="property-group">
            <span className="property-group-label">Domains</span>
            <div className="domain-tags">
              {domains.map((p) => (
                <span key={p.id} className="tag">
                  {p.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {adUnits.length > 0 && (
          <div className="property-group">
            <span className="property-group-label">Ad Units</span>
            <div className="domain-tags">
              {adUnits.map((p) => (
                <span key={p.id} className="tag tag-adunit">
                  {p.value}
                </span>
              ))}
            </div>
          </div>
        )}

        {worker.properties.length === 0 && (
          <p className="no-domains">No properties assigned yet.</p>
        )}
      </div>

      <form className="property-form" onSubmit={handleAddProperty}>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="form-select"
        >
          <option value="domain">Domain</option>
          <option value="ad_unit">Ad Unit</option>
        </select>
        <input
          type="text"
          className="form-input"
          placeholder={type === "domain" ? "e.g. sports.example.com" : "e.g. /12345/homepage"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <button type="submit" className="btn btn-sm" disabled={submitting}>
          {submitting ? "Adding…" : "Add"}
        </button>
      </form>

      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
