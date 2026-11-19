"use client";

import type { QualificationCriterion } from "@/types/api";
import { Button, Input, Textarea } from "@/components/ui";
import styles from "./QualificationCriteriaEditor.module.scss";

interface QualificationCriteriaEditorProps {
  criteria: QualificationCriterion[];
  onChange: (criteria: QualificationCriterion[]) => void;
}

const EMPTY_ROW: QualificationCriterion = { key: "", description: "", points: 10 };

export function QualificationCriteriaEditor({ criteria, onChange }: QualificationCriteriaEditorProps) {
  function updateRow(index: number, patch: Partial<QualificationCriterion>) {
    onChange(criteria.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(criteria.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...criteria, { ...EMPTY_ROW }]);
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.helperText}>
        Define what makes a lead qualified for your business. When a conversation reveals this information, the
        agent awards these points on top of its standard buying-intent scoring.
      </p>

      {criteria.length === 0 && <p className={styles.emptyText}>No custom criteria yet.</p>}

      {criteria.map((row, index) => (
        <div key={index} className={styles.row}>
          <Input
            label="Key"
            placeholder="e.g. location"
            value={row.key}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <div className={styles.descriptionField}>
            <Textarea
              label="Description"
              placeholder="e.g. Customer mentions which city or region they're in"
              value={row.description}
              onChange={(e) => updateRow(index, { description: e.target.value })}
            />
          </div>
          <Input
            label="Points"
            type="number"
            value={row.points}
            onChange={(e) => updateRow(index, { points: Number(e.target.value) || 0 })}
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => removeRow(index)}
            aria-label="Remove criterion"
          >
            Remove
          </Button>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        + Add criterion
      </Button>
    </div>
  );
}
