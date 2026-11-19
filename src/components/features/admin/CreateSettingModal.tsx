"use client";

import { useState } from "react";
import {
  adminApi,
  ApiError,
  type CreateSettingPayload,
  type SettingCategory,
  type SettingType,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Button, Input, Modal, Select, Switch, Textarea } from "@/components/ui";
import styles from "./CreateSettingModal.module.scss";

export function CreateSettingModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { show } = useToast();
  const [key, setKey] = useState("");
  const [type, setType] = useState<SettingType>("bool");
  const [category, setCategory] = useState<SettingCategory>("feature");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [boolDefault, setBoolDefault] = useState(true);
  const [limitDefault, setLimitDefault] = useState("");
  const [limitUnlimited, setLimitUnlimited] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function reset() {
    setKey("");
    setType("bool");
    setCategory("feature");
    setLabel("");
    setDescription("");
    setBoolDefault(true);
    setLimitDefault("");
    setLimitUnlimited(true);
  }

  async function handleSubmit() {
    if (!key.trim() || !label.trim()) {
      show("Key and label are required.", "error");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(key.trim())) {
      show("Key must be lowercase snake_case, starting with a letter.", "error");
      return;
    }
    const payload: CreateSettingPayload = {
      key: key.trim(),
      type,
      category,
      label: label.trim(),
      description: description.trim(),
      default: type === "bool" ? boolDefault : limitUnlimited ? null : Number(limitDefault) || 0,
    };
    setIsSubmitting(true);
    try {
      await adminApi.createSetting(payload);
      show("Setting created.", "success");
      reset();
      onClose();
      onCreated();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't create this setting.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create a new setting"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Create setting
          </Button>
        </>
      }
    >
      <p className={styles.note}>
        A new setting can be edited everywhere, but it does nothing in the product until a developer adds the code that
        checks it. For advanced use.
      </p>
      <div className={styles.grid}>
        <Input label="Key (snake_case)" value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. voice_calling_enabled" />
        <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Voice calling" />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value as SettingType)}>
          <option value="bool">On / off</option>
          <option value="int_or_null">A number (or no limit)</option>
        </Select>
        <Select label="Group" value={category} onChange={(e) => setCategory(e.target.value as SettingCategory)}>
          <option value="channel">Channel</option>
          <option value="limit">Limit</option>
          <option value="feature">Feature</option>
        </Select>
      </div>
      <Textarea
        label="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="What this setting controls"
      />
      {type === "bool" ? (
        <div className={styles.defaultRow}>
          <Switch checked={boolDefault} onChange={setBoolDefault} label="On for everyone by default" />
        </div>
      ) : (
        <div className={styles.limitRow}>
          <Input
            type="number"
            min={0}
            value={limitDefault}
            disabled={limitUnlimited}
            onChange={(e) => setLimitDefault(e.target.value)}
            aria-label="Default limit"
          />
          <label className={styles.check}>
            <input type="checkbox" checked={limitUnlimited} onChange={(e) => setLimitUnlimited(e.target.checked)} />
            No limit by default
          </label>
        </div>
      )}
    </Modal>
  );
}
